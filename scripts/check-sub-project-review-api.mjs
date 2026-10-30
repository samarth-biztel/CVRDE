import assert from 'node:assert/strict';
import {request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const [pm,subOwner,taskOwner]=await Promise.all([0,1,2].map(()=>request.newContext({baseURL:origin,ignoreHTTPSErrors:true})));
const call=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
const upload=async(ctx,taskId,key)=>{const response=await ctx.post(`/api/v1/tasks/${taskId}/attachments`,{multipart:{document_key:key,file:{name:`${key}.txt`,mimeType:'text/plain',buffer:Buffer.from(`${key} evidence`)}}});assert.equal(response.status(),201,await response.text());return (await response.json()).id};
try{
  const users={};for(const [name,ctx] of [['pm.demo',pm],['scientist1.demo',subOwner],['scientist2.demo',taskOwner]]){const response=await call(ctx,'/auth/login','post',{username:name,password:'CVRDE-Demo-2026!'});assert.equal(response.status(),200);users[name]=(await response.json()).id}
  const project=(await (await call(pm,'/projects')).json()).find(item=>item.name.includes('Engine Component Development'));assert.ok(project);
  const date=new Date(project.target_date.slice(0,10)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-10);const due=date.toISOString().slice(0,10);
  const created=await call(pm,`/projects/${project.id}/sub-projects`,'post',{name:`Review verification ${Date.now()}`,objective:'Verify simulation sign-off',owner_id:users['scientist1.demo'],due_date:due});assert.equal(created.status(),201);const subProject=await created.json();
  const taskResponse=await call(subOwner,`/projects/${project.id}/tasks`,'post',{sub_project_id:subProject.id,title:'Simulation evidence review',description:'Run simulation',expected_deliverables:'Report',owner_id:users['scientist2.demo'],due_date:due,priority:'HIGH'});assert.equal(taskResponse.status(),201);const task=await taskResponse.json();
  assert.equal((await call(taskOwner,`/tasks/${task.id}/status`,'post',{})).status(),200);
  const firstFile=await upload(taskOwner,task.id,'simulation-first');
  const submitted=await call(taskOwner,`/tasks/${task.id}/results`,'post',{work_completed:'Initial simulation',outcome:'Ready',attachment_ids:[firstFile]});assert.equal(submitted.status(),201);const result=await submitted.json();
  assert.equal((await call(taskOwner,'/me/pending-actions')).status(),403);
  const reviewerQueue=(await (await call(subOwner,'/me/pending-actions')).json()).find(item=>item.task_id===task.id&&item.kind==='RESULT_REVIEW');
  const pmQueue=(await (await call(pm,'/me/pending-actions')).json()).find(item=>item.task_id===task.id&&item.kind==='RESULT_REVIEW');
  assert.equal(reviewerQueue?.sub_project_name,subProject.name);assert.ok(reviewerQueue.files.some(file=>file.id===firstFile));assert.ok(pmQueue);
  assert.ok((await (await call(subOwner,'/me/notifications')).json()).some(item=>item.task_id===task.id&&item.event_type==='SUBMITTED'));
  assert.equal((await call(taskOwner,`/results/${result.id}/review`,'post',{accept:true,comment:'Self-review'})).status(),403);
  assert.equal((await call(subOwner,`/results/${result.id}/review`,'post',{accept:false,comment:''})).status(),400);
  assert.equal((await call(subOwner,`/results/${result.id}/review`,'post',{accept:false,comment:'Revise the boundary conditions'})).status(),200);
  const returned=(await (await call(taskOwner,`/me/work?project_id=${project.id}`)).json()).tasks.find(item=>item.id===task.id);
  assert.equal(returned.status,'RETURNED');assert.equal(returned.return_reason,'Revise the boundary conditions');
  assert.ok((await (await call(taskOwner,'/me/notifications')).json()).some(item=>item.task_id===task.id&&item.event_type==='RETURNED'));
  const revisedFile=await upload(taskOwner,task.id,'simulation-revised');
  const revised=await call(taskOwner,`/tasks/${task.id}/results`,'post',{work_completed:'Revised simulation',outcome:'Ready for sign-off',attachment_ids:[revisedFile]});assert.equal(revised.status(),201);
  assert.equal((await call(subOwner,`/results/${(await revised.json()).id}/review`,'post',{accept:true,comment:'Signed off'})).status(),200);
  const progress=(await (await call(pm,`/sub-projects/${subProject.id}`)).json());
  assert.equal(progress.task_done,1);assert.equal(progress.task_total,1);
  console.log('Sub-project review API check passed: scoped queue, mandatory return reason, notification, sign-off, and progress.');
}finally{await Promise.all([pm.dispose(),subOwner.dispose(),taskOwner.dispose()])}

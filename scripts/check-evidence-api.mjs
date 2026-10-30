import assert from 'node:assert/strict';
import {request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const pm=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});
const owner=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});
const call=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
try{
  for(const [ctx,name] of [[pm,'pm.demo'],[owner,'scientist2.demo']])assert.equal((await call(ctx,'/auth/login','post',{username:name,password:'CVRDE-Demo-2026!'})).status(),200);
  const project=(await (await call(pm,'/projects')).json()).find(p=>p.name.includes('Engine Component Development'));assert.ok(project);
  const task=(await (await call(pm,`/projects/${project.id}/tasks`)).json()).find(t=>t.title==='Thermal analysis report');assert.ok(task);
  const original=(await (await call(pm,`/tasks/${task.id}/results`)).json());
  assert.ok(original.length>=2&&original.every(result=>result.files?.length));
  const pending=original.find(result=>result.review_status==='PENDING');assert.ok(pending);
  const initialAction=(await (await call(pm,'/me/pending-actions')).json()).find(action=>action.kind==='RESULT_REVIEW'&&action.task_id===task.id);
  assert.ok(initialAction?.files?.[0]?.name&&initialAction.files[0].mime_type&&initialAction.files[0].uploaded_at);
  assert.equal((await call(pm,`/results/${pending.id}/review`,'post',{accept:false,comment:'Please revise the assumptions'})).status(),200);
  assert.equal((await call(owner,`/tasks/${task.id}/results`,'post',{work_completed:'No proof',outcome:'No proof',attachment_ids:[]})).status(),400);
  const file=await owner.post(`/api/v1/tasks/${task.id}/attachments`,{multipart:{document_key:'revised-report',file:{name:'revised-report.txt',mimeType:'text/plain',buffer:Buffer.from('Revised simulation results')}}});
  assert.equal(file.status(),201,await file.text());const fileId=(await file.json()).id;
  const resubmit=await call(owner,`/tasks/${task.id}/results`,'post',{work_completed:'Revised simulation',outcome:'Ready for review',attachment_ids:[fileId]});
  assert.equal(resubmit.status(),201,await resubmit.text());
  const resubmittedResult=await resubmit.json();
  const versions=(await (await call(pm,`/tasks/${task.id}/results`)).json());
  assert.equal(versions.length,original.length+1);
  assert.ok(versions.find(result=>result.id===pending.id).files.some(item=>item.name==='thermal_results.xlsx'));
  assert.ok(versions.find(result=>result.id===resubmittedResult.id).files.some(item=>item.id===fileId));
  assert.equal((await call(owner,`/attachments/${fileId}`,'delete')).status(),409);
  const review=(await (await call(pm,'/me/pending-actions')).json()).find(action=>action.kind==='RESULT_REVIEW'&&action.task_id===task.id);
  assert.ok(review.files.some(item=>item.id===fileId&&item.mime_type==='text/plain'&&item.uploaded_at));
  console.log('Evidence API check passed: file required, immutable versions, reviewer metadata, and resubmission history.');
}finally{await Promise.all([pm.dispose(),owner.dispose()])}

import assert from 'node:assert/strict';
import {request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const contexts=await Promise.all([0,1,2].map(()=>request.newContext({baseURL:origin,ignoreHTTPSErrors:true})));
const [pm,owner,other]=contexts;
const call=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
try{
  const users={};
  for(const [name,ctx] of [['pm.demo',pm],['scientist1.demo',owner],['scientist2.demo',other]]){
    const response=await call(ctx,'/auth/login','post',{username:name,password:'CVRDE-Demo-2026!'});
    assert.equal(response.status(),200);users[name]=(await response.json()).id;
  }
  const projects=await (await call(pm,'/projects')).json(),project=projects.find(p=>p.name.includes('Engine Component Development'));
  assert.ok(project);
  const date=(daysBefore)=>{const value=new Date(project.target_date.slice(0,10)+'T00:00:00Z');value.setUTCDate(value.getUTCDate()-daysBefore);return value.toISOString().slice(0,10)};
  const create=async(name,ownerId)=>{
    const response=await call(pm,`/projects/${project.id}/sub-projects`,'post',{name,objective:'Deliver verified engineering work',owner_id:ownerId,due_date:date(10)});
    assert.equal(response.status(),201,await response.text());return response.json();
  };
  const design=await create(`Design verification ${Date.now()}`,users['scientist1.demo']);
  const build=await create(`Build verification ${Date.now()}`,users['scientist2.demo']);
  assert.equal((await call(owner,`/sub-projects/${design.id}`)).status(),200);
  assert.equal((await call(owner,`/sub-projects/${design.id}`,'patch',{objective:'Unauthorized edit'})).status(),403);
  assert.equal((await call(pm,`/sub-projects/${design.id}`,'patch',{objective:'PM approved objective'})).status(),200);
  assert.equal((await call(owner,`/sub-projects/${build.id}`)).status(),404);
  const payload={title:'Simulation report verification',description:'Run model',expected_deliverables:'Simulation report',owner_id:users['scientist2.demo'],due_date:date(20),priority:'MEDIUM'};
  assert.equal((await call(owner,`/projects/${project.id}/tasks`,'post',payload)).status(),403);
  assert.equal((await call(owner,`/projects/${project.id}/tasks`,'post',{...payload,sub_project_id:build.id})).status(),403);
  const created=await call(owner,`/projects/${project.id}/tasks`,'post',{...payload,sub_project_id:design.id});
  assert.equal(created.status(),201,await created.text());const task=await created.json();
  assert.equal(task.sub_project_id,design.id);
  assert.equal((await call(owner,`/tasks/${task.id}`,'patch',{description:'Updated by sub-project owner'})).status(),200);
  assert.equal((await call(other,`/tasks/${task.id}`,'patch',{description:'Task owner edit attempt'})).status(),403);
  assert.equal((await call(other,`/tasks/${task.id}/comments`,'post',{body:'I can comment on assigned work.'})).status(),201);
  const otherTask=await call(pm,`/projects/${project.id}/tasks`,'post',{...payload,title:'Build task verification',sub_project_id:build.id});
  assert.equal(otherTask.status(),201,await otherTask.text());const buildTask=await otherTask.json();
  assert.equal((await call(owner,`/tasks/${buildTask.id}`,'patch',{description:'Outside scope'})).status(),403);
  assert.equal((await call(other,`/tasks/${buildTask.id}`,'patch',{description:'Edited by its sub-project owner'})).status(),200);
  assert.equal((await call(other,`/tasks/${task.id}/status`,'post',{})).status(),200);
  const submitted=await call(other,`/tasks/${task.id}/results`,'post',{work_completed:'Simulation complete',outcome:'Report ready',attachment_ids:[]});
  assert.equal(submitted.status(),201,await submitted.text());
  const result=await submitted.json();
  assert.equal((await call(pm,`/results/${result.id}/review`,'post',{accept:true,comment:'Approved'})).status(),200);
  const summary=(await (await call(pm,`/projects/${project.id}/sub-projects`)).json()).find(item=>item.id===design.id);
  assert.equal(summary.task_total,1);assert.equal(summary.task_done,1);
  assert.equal((await call(owner,`/sub-projects/${design.id}/tasks`)).status(),200);
  console.log('Sub-project API check passed: PM ownership, scoped creation/editing, member visibility, and progress.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()))}

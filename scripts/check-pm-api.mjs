import assert from 'node:assert/strict';
import {request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const pm=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});
const member=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});
const admin=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});
const call=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
try{
  assert.equal((await call(pm,'/auth/login','post',{username:'pm.demo',password:'CVRDE-Demo-2026!'})).status(),200);
  assert.equal((await call(member,'/auth/login','post',{username:'scientist1.demo',password:'CVRDE-Demo-2026!'})).status(),200);
  assert.equal((await call(admin,'/auth/login','post',{username:'admin.demo',password:'CVRDE-Demo-2026!'})).status(),200);
  const projects=await (await call(pm,'/projects')).json(),project=projects.find(p=>p.name.includes('Engine Component Development'));
  assert.ok(project);
  assert.equal((await call(pm,`/projects/${project.id}/risk`)).status(),200);
  const actions=await (await call(pm,'/me/pending-actions')).json();
  assert.ok(actions.length>0);assert.ok(actions.every(a=>a.requested_at&&a.project_id));
  assert.deepEqual(actions.map(a=>a.requested_at),[...actions].map(a=>a.requested_at).sort());
  assert.equal((await call(member,`/projects/${project.id}/risk`)).status(),404);
  assert.equal((await call(member,`/projects/${project.id}/users`,'post',{username:'blocked.user',full_name:'Blocked User',email:'blocked@example.invalid',password:'password12345'})).status(),404);
  const tasks=await (await call(pm,`/projects/${project.id}/tasks`)).json(),task=tasks.find(t=>t.status==='NOT_STARTED');assert.ok(task);
  assert.equal((await call(member,`/tasks/${task.id}/assignment`,'patch',{owner_id:task.owner_id})).status(),404);
  const result=actions.find(a=>a.kind==='RESULT_REVIEW');if(result){assert.equal((await call(pm,`/results/${result.id}/review`,'post',{accept:false,comment:''})).status(),400)}
  const extension=actions.find(a=>a.kind==='EXTENSION');if(extension)assert.equal((await call(pm,`/extension-requests/${extension.id}/decision`,'post',{approve:false,comment:''})).status(),400);
  const username=`pm_check_${Date.now()}`;
  const created=await call(pm,`/projects/${project.id}/users`,'post',{username,full_name:'PM Check Account',email:`${username}@example.invalid`,password:'InitialPass123!'});
  assert.equal(created.status(),201,await created.text());const account=await created.json();
  assert.equal((await call(member,`/users/${account.id}/active`,'patch',{active:false})).status(),403);
  assert.ok((await (await call(admin,'/users')).json()).some(u=>u.id===account.id&&u.active));
  assert.equal((await call(admin,`/users/${account.id}/active`,'patch',{active:false})).status(),200);
  assert.ok((await (await call(admin,'/users')).json()).some(u=>u.id===account.id&&!u.active));
  assert.equal((await call(admin,`/users/${account.id}/active`,'patch',{active:true})).status(),200);
  assert.equal((await call(admin,`/users/${(await (await call(admin,'/auth/me')).json()).id}/active`,'patch',{active:false})).status(),400);
  const own=await call(pm,`/projects/${project.id}/tasks`,'post',{title:'PM own task check',owner_id:Number((await (await call(pm,'/auth/me')).json()).id),priority:'MEDIUM',description:'',expected_deliverables:''});
  assert.equal(own.status(),201,await own.text());const newTask=await own.json();
  assert.equal((await call(pm,`/tasks/${newTask.id}/assignment`,'patch',{owner_id:account.id})).status(),200);
  assert.equal((await call(pm,`/tasks/${newTask.id}`,'patch',{due_date:'2026-11-03'})).status(),200);
  if(result){assert.equal((await call(pm,`/results/${result.id}/review`,'post',{accept:true,comment:'Checked'})).status(),200);const undone=await call(pm,'/decisions/undo','post',{kind:'RESULT_REVIEW',id:result.id});assert.equal(undone.status(),200,await undone.text());assert.equal((await (await call(pm,`/tasks/${result.task_id}`)).json()).status,'SUBMITTED')}
  if(extension){const original=(await (await call(pm,`/tasks/${extension.task_id}`)).json()).due_date;assert.equal((await call(pm,`/extension-requests/${extension.id}/decision`,'post',{approve:true,comment:'Checked'})).status(),200);const undone=await call(pm,'/decisions/undo','post',{kind:'EXTENSION',id:extension.id});assert.equal(undone.status(),200,await undone.text());assert.equal((await (await call(pm,`/tasks/${extension.task_id}`)).json()).due_date,original)}
  const material=tasks.find(t=>t.title==='Material sample testing');
  const request=await call(member,`/tasks/${material.id}/reassignments`,'post',{new_owner_id:account.id,reason:'PM verification',work_from:'2026-11-01',work_until:'2026-11-02'});
  assert.equal(request.status(),201,await request.text());const reassignment=await request.json();
  assert.equal((await call(pm,`/reassignments/${reassignment.id}/decision`,'post',{approve:true,comment:'Checked'})).status(),200);
  const undoReassignment=await call(pm,'/decisions/undo','post',{kind:'REASSIGNMENT',id:reassignment.id});assert.equal(undoReassignment.status(),200,await undoReassignment.text());
  assert.equal((await (await call(pm,`/tasks/${material.id}`)).json()).owner_id,material.owner_id);
  console.log('PM API check passed: queue, risk, permissions, account creation, admin oversight, PM-owned task, inline changes, decision and undo.');
}finally{await pm.dispose();await member.dispose();await admin.dispose()}

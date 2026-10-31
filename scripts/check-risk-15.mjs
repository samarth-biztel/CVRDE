import assert from 'node:assert/strict';
import {request} from 'playwright';
const origin=process.env.CVRDE_UI_URL||'https://localhost',contexts=[];
async function login(username){const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200);return ctx}
const call=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
async function expected(response,status,label){assert.equal(response.status(),status,`${label}: ${await response.text()}`);return response.json()}
try{
  const pm=await login('pm.demo'),owner=await login('scientist2.demo'),other=await login('task2.demo');
  const project=(await expected(await call(pm,'/projects'),200,'Projects')).find(p=>p.name==='Engine Development Programme');
  const task=(await expected(await call(pm,`/projects/${project.id}/tasks`),200,'Tasks')).find(t=>t.title==='Cooling jacket design');assert.ok(task);
  assert.equal((await call(owner,`/tasks/${task.id}/risk`,'post',{flagged:true})).status(),400);
  assert.equal((await call(other,`/tasks/${task.id}/risk`,'post',{flagged:true,reason:'Unauthorized'})).status(),403);
  await expected(await call(owner,`/tasks/${task.id}/risk`,'post',{flagged:true,reason:'Cooling channel geometry needs another simulation pass.'}),200,'Flag risk');
  const detail=await expected(await call(pm,`/tasks/${task.id}`),200,'Task detail');assert.equal(detail.risk_flag,true);assert.match(detail.risk_reason,/geometry/);
  const list=(await expected(await call(pm,`/projects/${project.id}/tasks`),200,'Task list')).find(t=>t.id===task.id);assert.equal(list.risk_flag,true);
  const overview=(await expected(await call(pm,`/projects/${project.id}/risk`),200,'PM Overview')).tasks.find(t=>t.id===task.id);assert.equal(overview.risk_flag,true);
  assert.equal((await call(other,`/tasks/${task.id}/risk`,'post',{flagged:false})).status(),403);
  await expected(await call(pm,`/tasks/${task.id}/risk`,'post',{flagged:false}),200,'PM clears risk');
  const events=await expected(await call(pm,`/tasks/${task.id}/history`),200,'Activity');
  assert.ok(events.some(event=>event.event_type==='TASK_RISK_FLAGGED'&&/geometry/.test(event.details.reason)));
  assert.ok(events.some(event=>event.event_type==='TASK_RISK_CLEARED'));
  await expected(await call(owner,`/tasks/${task.id}/risk`,'post',{flagged:true,reason:'Awaiting revised CFD mesh.'}),200,'Owner flags again');
  await expected(await call(owner,`/tasks/${task.id}/risk`,'post',{flagged:false}),200,'Owner clears risk');
  console.log('Risk flag #15 passed: required reason, visibility, permissions, and logged clears by PM and owner.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()))}

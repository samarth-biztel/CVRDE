import assert from 'node:assert/strict';
import {request} from 'playwright';
const origin=process.env.CVRDE_UI_URL||'https://localhost',contexts=[];
async function login(username){const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200);return {ctx,user:await response.json()}}
const call=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
async function expected(response,status,label){assert.equal(response.status(),status,`${label}: ${await response.text()}`);return response.json()}
try{
  const pm=await login('pm.demo'),sub=await login('scientist1.demo'),owner=await login('scientist2.demo');
  const project=(await expected(await call(pm.ctx,'/projects'),200,'Projects')).find(p=>p.name==='Engine Development Programme');assert.ok(project);
  const seeded=await expected(await call(pm.ctx,`/projects/${project.id}/milestones`),200,'Seeded milestones');assert.ok(seeded.some(m=>m.name==='Design baseline ready'&&m.task_total===4&&m.task_done===2));
  const due=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  assert.equal((await call(sub.ctx,`/projects/${project.id}/milestones`,'post',{name:'Unauthorized',due_date:due})).status(),404);
  const milestone=await expected(await call(pm.ctx,`/projects/${project.id}/milestones`,'post',{name:'Valve train readiness',due_date:due}),201,'Create milestone');
  const design=(await expected(await call(pm.ctx,`/projects/${project.id}/sub-projects`),200,'Sub-projects')).find(s=>s.name==='Design & Simulation');
  const task=await expected(await call(sub.ctx,`/projects/${project.id}/tasks`,'post',{sub_project_id:design.id,title:'Verify valve train milestone',owner_id:owner.user.id,due_date:due,priority:'MEDIUM'}),201,'Create task');
  assert.equal((await call(owner.ctx,`/tasks/${task.id}/milestone`,'patch',{milestone_id:milestone.id})).status(),403);
  await expected(await call(pm.ctx,`/tasks/${task.id}/milestone`,'patch',{milestone_id:milestone.id}),200,'Link task');
  const before=(await expected(await call(pm.ctx,`/projects/${project.id}/milestones`),200,'Milestone progress')).find(m=>m.id===milestone.id);assert.deepEqual([before.task_total,before.task_done],[1,0]);
  await expected(await call(owner.ctx,`/tasks/${task.id}/status`,'post',{}),200,'Start task');
  const file=await expected(await owner.ctx.post(`/api/v1/tasks/${task.id}/attachments`,{multipart:{document_key:'milestone-proof',file:{name:'proof.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional milestone proof')}}}),201,'Upload evidence');
  const result=await expected(await call(owner.ctx,`/tasks/${task.id}/results`,'post',{work_completed:'Valve train milestone verified',outcome:'Ready',attachment_ids:[file.id]}),201,'Submit');
  await expected(await call(sub.ctx,`/results/${result.id}/review`,'post',{accept:true,comment:'Approved'}),200,'Sign off');
  const after=(await expected(await call(pm.ctx,`/projects/${project.id}/milestones`),200,'Updated progress')).find(m=>m.id===milestone.id);assert.deepEqual([after.task_total,after.task_done],[1,1]);
  console.log('Milestone #14 passed: create, link, permissions, and progress after sign-off.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()))}

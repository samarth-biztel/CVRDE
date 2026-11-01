import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV='test';
const {app}=await import('../backend/dist/server.js');
const {db,query,pool}=await import('../backend/dist/db.js');
const {taskAccess,taskById}=await import('../backend/dist/core.js');
const login=async username=>{
  const client=request.agent(app);
  const response=await client.post('/api/v1/auth/login').send({username,password:'CVRDE-Demo-2026!'});
  assert.equal(response.status,200,`Login ${username}`);
  return {client,user:response.body};
};

try{
  const pm=await login('pm.demo'),subOwner=await login('scientist1.demo'),taskOwner=await login('scientist2.demo');
  const allProjects=await query(db,'SELECT id FROM projects ORDER BY id');
  const pmProjects=await pm.client.get('/api/v1/projects');
  assert.equal(pmProjects.status,200);
  assert.deepEqual(pmProjects.body.map(p=>Number(p.id)).sort((a,b)=>a-b),allProjects.map(p=>Number(p.id)));

  const ownerProjects=await taskOwner.client.get('/api/v1/projects');
  assert.equal(ownerProjects.status,200);
  const expectedProjects=await query(db,`SELECT DISTINCT p.id FROM projects p WHERE EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.owner_id=$1) OR EXISTS(SELECT 1 FROM sub_projects sp WHERE sp.project_id=p.id AND sp.owner_id=$1) ORDER BY p.id`,[taskOwner.user.id]);
  assert.deepEqual(ownerProjects.body.map(p=>Number(p.id)).sort((a,b)=>a-b),expectedProjects.map(p=>Number(p.id)));
  const foreign=allProjects.find(p=>!expectedProjects.some(own=>Number(own.id)===Number(p.id)));
  if(foreign){
    assert.equal((await taskOwner.client.get(`/api/v1/projects/${foreign.id}`)).status,404);
    assert.equal((await taskOwner.client.get(`/api/v1/projects/${foreign.id}/sub-projects`)).status,404);
    assert.equal((await taskOwner.client.get(`/api/v1/projects/${foreign.id}/tasks`)).status,404);
    assert.equal((await taskOwner.client.get(`/api/v1/projects/${foreign.id}/documents`)).status,404);
  }

  const project=ownerProjects.body.find(p=>p.name==='Engine Development Programme')||ownerProjects.body[0];
  assert.ok(project,'Task owner needs an assigned project');
  const subProjects=await taskOwner.client.get(`/api/v1/projects/${project.id}/sub-projects`);
  assert.equal(subProjects.status,200);
  const expectedSubProjects=await query(db,`SELECT sp.id FROM sub_projects sp WHERE sp.project_id=$1 AND (sp.owner_id=$2 OR EXISTS(SELECT 1 FROM tasks t WHERE t.sub_project_id=sp.id AND t.owner_id=$2))`,[project.id,taskOwner.user.id]);
  assert.deepEqual(subProjects.body.map(sp=>Number(sp.id)).sort((a,b)=>a-b),expectedSubProjects.map(sp=>Number(sp.id)).sort((a,b)=>a-b));

  const ownTasks=await taskOwner.client.get(`/api/v1/projects/${project.id}/tasks`);
  assert.equal(ownTasks.status,200);
  assert.ok(ownTasks.body.length>0);
  assert.ok(ownTasks.body.every(task=>Number(task.owner_id)===taskOwner.user.id));
  const members=await taskOwner.client.get(`/api/v1/projects/${project.id}/members`);
  assert.equal(members.status,200);
  assert.ok(members.body.some(person=>Number(person.id)===taskOwner.user.id));
  assert.ok(members.body.some(person=>Number(person.id)===Number(project.manager_id)));
  const unrelatedMember=await query(db,`SELECT pm.user_id FROM project_members pm WHERE pm.project_id=$1 AND pm.user_id<>$2 AND NOT EXISTS(
    SELECT 1 FROM tasks t WHERE t.owner_id=pm.user_id AND t.sub_project_id IN(
      SELECT sub_project_id FROM tasks WHERE owner_id=$2 AND sub_project_id IS NOT NULL)) AND NOT EXISTS(
    SELECT 1 FROM sub_projects sp WHERE sp.owner_id=pm.user_id AND sp.id IN(
      SELECT sub_project_id FROM tasks WHERE owner_id=$2 AND sub_project_id IS NOT NULL)) LIMIT 1`,[project.id,taskOwner.user.id]);
  if(unrelatedMember.length)assert.ok(!members.body.some(person=>Number(person.id)===Number(unrelatedMember[0].user_id)));
  const related=await taskOwner.client.get(`/api/v1/projects/${project.id}/tasks?scope=dependencies`);
  assert.equal(related.status,200);
  assert.ok(related.body.every(task=>task.owner_id!==taskOwner.user.id&&ownTasks.body.some(own=>own.sub_project_id&&Number(own.sub_project_id)===Number(task.sub_project_id))));
  assert.ok(related.body.every(task=>!Object.hasOwn(task,'description')&&!Object.hasOwn(task,'expected_deliverables')));
  assert.ok(subProjects.body.every(sp=>Number(sp.owner_id)===taskOwner.user.id||!Object.hasOwn(sp,'objective')));
  if(related.body.length){
    const peer=related.body[0];
    assert.equal(await taskAccess(taskOwner.user,await taskById(peer.id),'LINK'),'FULL');
    const detail=await taskOwner.client.get(`/api/v1/tasks/${peer.id}`);
    assert.equal(detail.status,200);
    assert.equal(detail.body.limited,true);
    assert.equal((await taskOwner.client.get(`/api/v1/tasks/${peer.id}/comments`)).status,403);
    assert.equal((await taskOwner.client.post(`/api/v1/tasks/${peer.id}/comments`).send({body:'Unauthorized peer comment'})).status,404);
    assert.equal((await taskOwner.client.post(`/api/v1/tasks/${peer.id}/status`).send({})).status,403);
    assert.equal((await taskOwner.client.patch(`/api/v1/tasks/${peer.id}`).send({title:'Unauthorized peer edit'})).status,403);
  }
  assert.equal((await taskOwner.client.get(`/api/v1/projects/${project.id}/meetings`)).body.length,0);

  const subProjectsOwned=await subOwner.client.get(`/api/v1/projects/${project.id}/sub-projects`);
  const owned=subProjectsOwned.body.find(sp=>Number(sp.owner_id)===subOwner.user.id);
  assert.ok(owned,'Sub-project owner needs an owned sub-project');
  const subTasks=await subOwner.client.get(`/api/v1/sub-projects/${owned.id}/tasks`);
  assert.equal(subTasks.status,200);
  assert.ok(subTasks.body.length>0);
  assert.ok(subTasks.body.every(task=>Number(task.sub_project_id)===Number(owned.id)&&Object.hasOwn(task,'description')));
  console.log('Role scope passed: PM project list, task-owner project and sub-project scope, own tasks, dependency-only peer context, and sub-project-owner tasks.');
}finally{await pool.end()}

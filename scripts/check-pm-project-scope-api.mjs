import assert from 'node:assert/strict';
import request from 'supertest';
process.env.NODE_ENV='test';
const {app}=await import('../backend/dist/server.js');
const {db,one,pool}=await import('../backend/dist/db.js');
const {projectMember}=await import('../backend/dist/core.js');
try{
  const pm=request.agent(app);
  assert.equal((await pm.post('/api/v1/auth/login').send({username:'pm.demo',password:'CVRDE-Demo-2026!'})).status,200);
  const projects=(await pm.get('/api/v1/projects')).body;
  assert.deepEqual(projects.map(project=>project.name),['Engine Development Programme']);
  const pugazh=await one(db,"SELECT id,username,full_name,email,role FROM users WHERE username='pugazh@biztel.ai'");
  const foreign=await one(db,"SELECT id FROM projects WHERE name='BiztelAI_Work'");
  const teal=await one(db,"SELECT id FROM projects WHERE name='TEAL_DEMO'");
  assert.ok(pugazh&&foreign&&teal);
  const engine=projects[0];
  await projectMember(pugazh,foreign.id);
  await projectMember(pugazh,teal.id);
  await assert.rejects(projectMember(pugazh,engine.id),error=>error.status===404);
  for(const path of [`/projects/${foreign.id}`,`/projects/${foreign.id}/risk`,`/projects/${foreign.id}/members`,`/projects/${foreign.id}/milestones`,`/projects/${foreign.id}/documents`,`/projects/${foreign.id}/sub-projects`,`/projects/${foreign.id}/tasks`,`/projects/${foreign.id}/meetings`]){
    assert.equal((await pm.get(`/api/v1${path}`)).status,404,path);
  }
  const task=await one(db,'SELECT id FROM tasks WHERE project_id=$1 LIMIT 1',[foreign.id]);
  if(task)assert.equal((await pm.get(`/api/v1/tasks/${task.id}`)).status,404);
  const notifications=(await pm.get('/api/v1/me/notifications')).body;
  assert.ok(notifications.every(item=>item.project_id===engine.id));
  console.log('PM project scope API checks passed: Pugazh owns BiztelAI_Work and TEAL_DEMO; Engine is inaccessible.');
}finally{await pool.end()}

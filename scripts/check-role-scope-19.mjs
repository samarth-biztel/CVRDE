import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV='test';
const {app}=await import('../backend/dist/server.js');
const {pool}=await import('../backend/dist/db.js');
const login=async username=>{const client=request.agent(app);const response=await client.post('/api/v1/auth/login').send({username,password:'CVRDE-Demo-2026!'});assert.equal(response.status,200,username);return client};
try{
  const pm=await login('pm.demo'),owner=await login('scientist1.demo'),worker=await login('scientist2.demo');
  const projects=await pm.get('/api/v1/projects');assert.equal(projects.status,200);
  const project=projects.body.find(p=>p.name==='Engine Development Programme');assert.ok(project);
  const pid=project.id,subs=(await pm.get(`/api/v1/projects/${pid}/sub-projects`)).body;
  const design=subs.find(s=>s.name==='Design & Simulation'),prototype=subs.find(s=>s.name==='Prototype Build');assert.ok(design&&prototype);
  for(const endpoint of [`/projects`,`/projects/${pid}`,`/projects/${pid}/sub-projects`,`/sub-projects/${design.id}`,`/sub-projects/${design.id}/tasks`,`/projects/${pid}/members`,`/projects/${pid}/documents`,`/projects/${pid}/milestones`,`/projects/${pid}/groups`]){
    const response=await worker.get(`/api/v1${endpoint}`);assert.equal(response.status,404,`Worker ${endpoint}`);
  }
  assert.equal((await owner.get(`/api/v1/sub-projects/${prototype.id}`)).status,404);
  assert.equal((await owner.get(`/api/v1/sub-projects/${prototype.id}/tasks`)).status,404);
  assert.equal((await owner.get(`/api/v1/projects/${pid}`)).status,404);
  const ownerSubs=await owner.get(`/api/v1/projects/${pid}/sub-projects`);assert.equal(ownerSubs.status,200);assert.deepEqual(ownerSubs.body.map(s=>s.id),[design.id]);
  const tasks=await worker.get(`/api/v1/projects/${pid}/tasks`);assert.equal(tasks.status,200);const me=(await worker.get('/api/v1/auth/me')).body;assert.ok(tasks.body.length&&tasks.body.every(t=>t.owner_id===me.id));
  const own=tasks.body.find(t=>t.sub_project_id===design.id),peer=(await pm.get(`/api/v1/sub-projects/${design.id}/tasks`)).body.find(t=>t.owner_id!==me.id);assert.ok(own&&peer);
  assert.equal((await worker.get(`/api/v1/tasks/${peer.id}`)).status,404);
  assert.equal((await worker.get(`/api/v1/projects/${pid}/tasks?scope=dependencies`)).status,400);
  const picker=await worker.get(`/api/v1/projects/${pid}/tasks?scope=dependencies&task_id=${own.id}`);assert.equal(picker.status,200);assert.ok(picker.body.some(t=>t.id===peer.id));
  const meetings=await worker.get(`/api/v1/projects/${pid}/meetings`);assert.equal(meetings.status,200);assert.ok(meetings.body.length);
  const meeting=meetings.body[0];assert.equal((await worker.get(`/api/v1/meetings/${meeting.id}`)).status,200);
  assert.equal((await worker.patch(`/api/v1/meetings/${meeting.id}`).send({minutes:'No'})).status,403);
  assert.equal((await worker.post(`/api/v1/projects/${pid}/meetings`).send({title:'Unauthorized',meeting_date:'2026-11-01',sub_project_id:design.id,minutes:'No',attendee_ids:[me.id],actions:[]})).status,403);
  assert.equal((await worker.get('/api/v1/me/pending-actions')).status,403);
  console.log('Issue #19 role API checks passed. Projects in DB:',projects.body.map(p=>p.name).join(', '));
}finally{await pool.end()}

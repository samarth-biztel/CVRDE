import assert from 'node:assert/strict';
import request from 'supertest';
process.env.NODE_ENV='test';
const { app }=await import('../backend/dist/server.js');
const { demoPassword }=await import('../backend/dist/demo.js');
const { pool }=await import('../backend/dist/db.js');

const pm=request.agent(app),owner=request.agent(app),viewer=request.agent(app);
for(const [agent,username] of [[pm,'pm.demo'],[owner,'scientist1.demo'],[viewer,'scientist2.demo']]){
  const response=await agent.post('/api/v1/auth/login').send({username,password:demoPassword});
  assert.equal(response.status,200,`${username} login`);
}
const projects=await pm.get('/api/v1/projects');
const project=projects.body.find(p=>p.name.includes('Engine Component Development'));
assert.ok(project,'demo project');
const tasks=await pm.get(`/api/v1/projects/${project.id}/tasks`);
const task=tasks.body.find(t=>t.title==='Material sample testing');
assert.ok(task,'shared demo task');
assert.equal((await viewer.get(`/api/v1/tasks/${task.id}`)).status,200);
assert.equal((await viewer.post(`/api/v1/tasks/${task.id}/status`).send({})).status,403);
assert.equal((await viewer.post(`/api/v1/tasks/${task.id}/progress`).send({percent:50,justification:'viewer'})).status,403);
assert.equal((await viewer.patch(`/api/v1/tasks/${task.id}`).send({title:'viewer'})).status,404);
assert.equal((await viewer.post(`/api/v1/tasks/${task.id}/attachments`).field('document_key','viewer').attach('file',Buffer.from('%PDF-1.4\n'),'viewer.pdf')).status,403);
assert.equal((await owner.post(`/api/v1/tasks/${task.id}/progress`).send({percent:45})).status,400);
assert.equal((await owner.post(`/api/v1/tasks/${task.id}/progress`).send({percent:45,justification:'Samples checked'})).status,200);
assert.equal((await viewer.post(`/api/v1/tasks/${task.id}/comments`).send({body:'Reviewed the sample notes.'})).status,201);
const upload=await owner.post(`/api/v1/tasks/${task.id}/attachments`).field('document_key','check').attach('file',Buffer.from('%PDF-1.4\n'),'check.pdf');
assert.equal(upload.status,201);
const submission=await owner.post(`/api/v1/tasks/${task.id}/results`).send({work_completed:'Sample report complete',outcome:'Ready for review',attachment_ids:[upload.body.id]});
assert.equal(submission.status,201);
const submitted=await owner.get(`/api/v1/tasks/${task.id}/results`);
assert.ok(submitted.body[0].attachment_names.includes('check.pdf'));
const notifications=await owner.get('/api/v1/me/notifications');
assert.ok(notifications.body.some(n=>n.event_type==='COMMENT'&&n.task_id===task.id));
const audit=await pm.get(`/api/v1/projects/${project.id}/audit`);
assert.ok(audit.body.some(a=>a.action==='PROGRESS_CHANGED'&&a.task_id===task.id));
console.log('Foundation API checks passed: shared viewer permissions, progress reason, comment notification, submission files, audit log.');
await pool.end();

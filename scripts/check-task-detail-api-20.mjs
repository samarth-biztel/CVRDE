import assert from 'node:assert/strict';
import request from 'supertest';
process.env.NODE_ENV='test';
const {app}=await import('../backend/dist/server.js');
const {pool}=await import('../backend/dist/db.js');
const login=async name=>{const agent=request.agent(app);const response=await agent.post('/api/v1/auth/login').send({username:name,password:'CVRDE-Demo-2026!'});assert.equal(response.status,200,name);return agent};
try{
  const pm=await login('pm.demo'),owner=await login('scientist2.demo'),reviewer=await login('scientist1.demo');
  const context=(await pm.get('/api/v1/me/context')).body,taskList=(await pm.get(`/api/v1/projects/${context.project.id}/tasks`)).body;
  const task=title=>{const item=taskList.find(row=>row.title===title);assert.ok(item,title);return item};
  const cfd=task('Combustion chamber CFD simulation'),done=task('Define engine performance targets'),cooling=task('Cooling jacket design');
  const result=(await owner.get(`/api/v1/tasks/${cfd.id}/results`)).body[0];assert.ok(result);assert.equal(result.review_status,'PENDING');assert.ok(result.files.length);
  assert.ok(result.files[0].size_bytes>0);assert.equal(typeof result.files[0].uploaded_by_name,'string');
  const attachment=(await owner.get(`/api/v1/tasks/${cfd.id}/attachments`)).body[0];assert.ok(attachment.size_bytes>0);assert.equal(typeof attachment.uploaded_by_name,'string');assert.equal(Object.hasOwn(attachment,'document_key'),false);
  const queue=(await reviewer.get('/api/v1/me/pending-actions')).body.find(item=>item.task_id===cfd.id);assert.ok(queue.files[0].size_bytes>0);
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
  assert.equal((await owner.post(`/api/v1/tasks/${cfd.id}/attachments`).attach('file',pdf,'extra.pdf')).status,409);
  assert.equal((await pm.post(`/api/v1/tasks/${cfd.id}/attachments`).attach('file',pdf,'extra.pdf')).status,403);
  assert.equal((await owner.patch(`/api/v1/tasks/${cfd.id}`).send({title:'Changed'})).status,403);
  assert.equal((await reviewer.patch(`/api/v1/tasks/${cfd.id}`).send({title:'Changed'})).status,409);
  assert.equal((await pm.patch(`/api/v1/tasks/${done.id}`).send({title:'Changed'})).status,409);
  assert.equal((await owner.post(`/api/v1/tasks/${cfd.id}/risk`).send({flagged:true,reason:'No'})).status,409);
  assert.equal((await owner.post(`/api/v1/tasks/${cooling.id}/progress`).send({percent:50,justification:''})).status,400);
  assert.equal((await reviewer.post(`/api/v1/results/${result.id}/review`).send({accept:false,comment:''})).status,400);
  assert.equal((await owner.delete(`/api/v1/attachments/${attachment.id}`)).status,409);
  console.log('Issue #20 task detail API guards and file metadata passed.');
}finally{await pool.end()}

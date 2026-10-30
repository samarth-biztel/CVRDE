import assert from 'node:assert/strict';
import {request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const contexts=await Promise.all([0,1,2].map(()=>request.newContext({baseURL:origin,ignoreHTTPSErrors:true})));
const [owner,viewer,pm]=contexts;
const call=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
try{
  const accounts=[['scientist1.demo',owner],['scientist2.demo',viewer],['pm.demo',pm]];
  const ids={};for(const [name,ctx] of accounts){const response=await call(ctx,'/auth/login','post',{username:name,password:'CVRDE-Demo-2026!'});assert.equal(response.status(),200);ids[name]=(await response.json()).id}
  const projects=await (await call(owner,'/projects')).json(),project=projects.find(p=>p.name.includes('Engine Component Development'));assert.ok(project);
  const workResponse=await call(owner,`/me/work?project_id=${project.id}`);assert.equal(workResponse.status(),200);const work=await workResponse.json();
  assert.ok(work.tasks.length>0);assert.ok(work.tasks.every(t=>t.owner_id===ids['scientist1.demo']));
  assert.ok(work.activity.every(a=>work.tasks.some(t=>t.id===a.task_id)));
  const ownSubmissions=await (await call(owner,'/me/submissions')).json();assert.ok(ownSubmissions.some(s=>s.kind==='EXTENSION'));
  const viewerSubmissions=await (await call(viewer,'/me/submissions')).json();assert.ok(viewerSubmissions.some(s=>s.state==='RETURNED'&&s.reviewer_comment==='Revise assumptions'));
  assert.deepEqual(viewerSubmissions.map(s=>s.created_at),[...viewerSubmissions].map(s=>s.created_at).sort().reverse());
  assert.equal((await call(owner,'/me/pending-actions')).status(),403);
  assert.equal((await call(owner,'/review')).status(),404);
  const material=work.tasks.find(t=>t.title==='Material sample testing');assert.ok(material);
  assert.equal((await call(viewer,`/tasks/${material.id}/status`,'post',{})).status(),403);
  assert.equal((await call(viewer,`/tasks/${material.id}/progress`,'post',{percent:70,justification:'Viewer attempt'})).status(),403);
  assert.equal((await call(viewer,`/tasks/${material.id}/results`,'post',{work_completed:'Viewer attempt',outcome:'Viewer attempt'})).status(),403);
  assert.equal((await call(viewer,`/tasks/${material.id}/comments`,'post',{body:'Shared comment check'})).status(),201);
  const pending=(await (await call(pm,'/me/pending-actions')).json()).find(a=>a.kind==='RESULT_REVIEW'&&a.title==='Instrumentation readiness review');assert.ok(pending);
  assert.equal((await call(viewer,`/results/${pending.id}/review`,'post',{accept:true,comment:'Viewer attempt'})).status(),404);
  const returned=await call(pm,`/results/${pending.id}/review`,'post',{accept:false,comment:'Please revise the channel map'});assert.equal(returned.status(),200,await returned.text());
  const returnedWork=await (await call(viewer,`/me/work?project_id=${project.id}`)).json(),returnedTask=returnedWork.tasks.find(t=>t.id===pending.task_id);
  assert.equal(returnedTask.status,'RETURNED');assert.equal(returnedTask.return_reason,'Please revise the channel map');
  assert.ok((await (await call(viewer,'/me/submissions')).json()).some(s=>s.task_id===pending.task_id&&s.state==='RETURNED'&&s.reviewer_comment==='Please revise the channel map'));
  assert.equal((await call(viewer,`/tasks/${pending.task_id}/results`,'post',{work_completed:'No file',outcome:'No file',attachment_ids:[]})).status(),400);
  const revisedFile=await viewer.post(`/api/v1/tasks/${pending.task_id}/attachments`,{multipart:{document_key:'revised-channel-map',file:{name:'revised-channel-map.txt',mimeType:'text/plain',buffer:Buffer.from('Revised channel map')}}});assert.equal(revisedFile.status(),201);
  const resubmitted=await call(viewer,`/tasks/${pending.task_id}/results`,'post',{work_completed:'Revised channel map',outcome:'Revised channel map',attachment_ids:[(await revisedFile.json()).id]});assert.equal(resubmitted.status(),201,await resubmitted.text());
  assert.ok((await (await call(viewer,'/me/submissions')).json()).some(s=>s.task_id===pending.task_id&&s.state==='PENDING'&&s.summary==='Revised channel map'));
  const extensions=(await (await call(pm,'/me/pending-actions')).json()).filter(a=>a.kind==='EXTENSION');
  const approved=extensions.find(a=>a.title==='Material sample testing'),declined=extensions.find(a=>a.title==='Sensor calibration records');assert.ok(approved&&declined);
  assert.equal((await call(pm,`/extension-requests/${approved.id}/decision`,'post',{approve:true,comment:'Approved for the new sample batch'})).status(),200);
  assert.equal((await call(pm,`/extension-requests/${declined.id}/decision`,'post',{approve:false,comment:'Please keep the original date'})).status(),200);
  assert.ok((await (await call(owner,'/me/submissions')).json()).some(s=>s.kind==='EXTENSION'&&s.state==='APPROVED'&&s.reviewer_comment==='Approved for the new sample batch'));
  assert.ok((await (await call(viewer,'/me/submissions')).json()).some(s=>s.kind==='EXTENSION'&&s.state==='REJECTED'&&s.reviewer_comment==='Please keep the original date'));
  assert.ok((await (await call(pm,'/me/submissions')).json()).some(s=>s.kind==='REASSIGNMENT'));
  console.log('User API check passed: owner-only work, submissions and comments, returned reason, resubmission, shared permission denials, and Review denial.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()))}

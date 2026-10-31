import assert from 'node:assert/strict';
import {request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost',contexts=[];
async function login(username){const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200,username);return {ctx,user:await response.json()}}
try{
  const accounts={};for(const username of ['pm.demo','scientist1.demo','prototype.demo','testing.demo','scientist2.demo','task2.demo'])accounts[username]=await login(username);
  const pm=accounts['pm.demo'],designOwner=accounts['scientist1.demo'],taskOwner=accounts['scientist2.demo'];
  assert.deepEqual(Object.values(accounts).map(account=>account.user.full_name),['R. Sharma','A. Iyer','K. Menon','P. Rao','S. Nair','V. Kulkarni']);
  const projects=await (await pm.ctx.get('/api/v1/projects')).json(),project=projects.find(item=>item.name==='Engine Development Programme');assert.ok(project);
  const subs=await (await pm.ctx.get(`/api/v1/projects/${project.id}/sub-projects`)).json();assert.deepEqual(subs.map(item=>item.name),['Design & Simulation','Prototype Build','Testing & Validation']);
  assert.deepEqual(subs.map(item=>[item.task_total,item.task_done]),[[9,3],[4,2],[3,0]]);
  const tasks=await (await pm.ctx.get(`/api/v1/projects/${project.id}/tasks`)).json();assert.equal(tasks.length,16);
  const find=title=>{const item=tasks.find(task=>task.title===title);assert.ok(item,title);return item};
  assert.equal(find('Combustion chamber CFD simulation').status,'SUBMITTED');assert.equal(find('Cylinder head thermal analysis').status,'RETURNED');assert.equal(find('Crankshaft stress analysis').status,'IN_PROGRESS');
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-2);assert.equal(find('Crankshaft stress analysis').due_date.slice(0,10),yesterday.toISOString().slice(0,10));
  const thermal=find('Cylinder head thermal analysis');const results=await (await accounts['task2.demo'].ctx.get(`/api/v1/tasks/${thermal.id}/results`)).json();assert.match(results[0].review_comment,/Boundary conditions don't match revised targets/);
  const cfd=find('Combustion chamber CFD simulation');const evidence=await (await taskOwner.ctx.get(`/api/v1/tasks/${cfd.id}/attachments`)).json();assert.ok(evidence.some(file=>file.original_name==='combustion-cfd-report.pdf'));
  const queue=await (await designOwner.ctx.get('/api/v1/me/pending-actions')).json();assert.ok(queue.some(item=>item.task_id===cfd.id&&item.kind==='RESULT_REVIEW'));
  const meetingList=await (await pm.ctx.get(`/api/v1/projects/${project.id}/meetings`)).json();assert.equal(meetingList.length,1);const meeting=await (await pm.ctx.get(`/api/v1/meetings/${meetingList[0].id}`)).json();assert.equal(meeting.attendees.length,4);assert.equal(meeting.actions.length,2);assert.ok(meeting.actions.every(item=>find(item.description).source_meeting_title?.startsWith('Design review')));
  const notifications=await (await accounts['task2.demo'].ctx.get('/api/v1/me/notifications')).json();assert.ok(notifications.some(item=>item.task_id===thermal.id&&item.event_type==='RETURNED'));
  const risk=await (await pm.ctx.get(`/api/v1/projects/${project.id}/risk`)).json();assert.equal(risk.sub_projects.length,3);
  console.log('Demo seed #13 passed: six logins, three staged sub-projects, 16 tasks, evidence, review, meeting actions, and notifications.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()))}

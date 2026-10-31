import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost',contexts=[];
async function login(username){const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200);return {ctx,user:await response.json()}}
const browser=await chromium.launch({headless:true});
try{
  const pm=await login('pm.demo'),subOwner=await login('scientist1.demo'),taskOwner=await login('scientist2.demo');
  const project=(await (await pm.ctx.get('/api/v1/projects')).json()).find(item=>item.name.includes('Engine Component Development'));assert.ok(project);
  const target=new Date(project.target_date.slice(0,10)+'T00:00:00Z'),date=days=>{const value=new Date(target);value.setUTCDate(value.getUTCDate()-days);return value.toISOString().slice(0,10)};
  const subResponse=await pm.ctx.post(`/api/v1/projects/${project.id}/sub-projects`,{data:{name:'Meeting verification sub-project',objective:'Review simulation',owner_id:subOwner.user.id,due_date:date(8)}});assert.equal(subResponse.status(),201);const sp=await subResponse.json();
  const payload={title:'Simulation review',meeting_date:new Date().toISOString().slice(0,10),sub_project_id:sp.id,minutes:'Review boundary conditions and evidence.',attendee_ids:[pm.user.id,subOwner.user.id,taskOwner.user.id],actions:[{description:'Revise simulation report',owner_id:taskOwner.user.id,due_date:date(10)}]};
  assert.equal((await taskOwner.ctx.post(`/api/v1/projects/${project.id}/meetings`,{data:payload})).status(),403);
  assert.equal((await subOwner.ctx.post(`/api/v1/projects/${project.id}/meetings`,{data:{...payload,sub_project_id:null}})).status(),403);
  const created=await subOwner.ctx.post(`/api/v1/projects/${project.id}/meetings`,{data:payload});assert.equal(created.status(),201);const {id:meetingId,task_ids:taskIds}=await created.json();assert.equal(taskIds.length,1);
  let meeting=await (await taskOwner.ctx.get(`/api/v1/meetings/${meetingId}`)).json();assert.equal(meeting.can_edit,false);assert.equal(meeting.actions[0].status,'NOT_STARTED');assert.equal(meeting.attendees.length,3);
  assert.equal((await taskOwner.ctx.patch(`/api/v1/meetings/${meetingId}`,{data:{minutes:'Unauthorized'}})).status(),403);
  const action=(await (await taskOwner.ctx.get(`/api/v1/tasks/${taskIds[0]}`)).json());assert.match(action.source_meeting_title,/Simulation review, /);
  assert.ok((await (await taskOwner.ctx.get('/api/v1/me/notifications')).json()).some(item=>item.task_id===taskIds[0]&&item.subject.startsWith('Meeting action assigned:')));
  const subList=await (await subOwner.ctx.get(`/api/v1/sub-projects/${sp.id}/meetings`)).json();assert.equal(subList[0].id,meetingId);
  const updated=await subOwner.ctx.patch(`/api/v1/meetings/${meetingId}`,{data:{title:'Final simulation review',minutes:'Boundary conditions approved.'}});assert.equal(updated.status(),200);
  const renamed=(await (await taskOwner.ctx.get(`/api/v1/tasks/${taskIds[0]}`)).json());assert.match(renamed.source_meeting_title,/Final simulation review/);
  const added=await subOwner.ctx.post(`/api/v1/meetings/${meetingId}/actions`,{data:{actions:[{description:'Archive simulation evidence',owner_id:taskOwner.user.id,due_date:date(9)}]}});assert.equal(added.status(),201);
  const secondId=(await added.json()).task_ids[0];assert.ok(secondId);
  assert.equal((await taskOwner.ctx.post(`/api/v1/tasks/${taskIds[0]}/status`,{data:{}})).status(),200);
  const file=await taskOwner.ctx.post(`/api/v1/tasks/${taskIds[0]}/attachments`,{multipart:{document_key:'simulation',file:{name:'simulation.txt',mimeType:'text/plain',buffer:Buffer.from('Revised evidence')}}});assert.equal(file.status(),201);
  const result=await taskOwner.ctx.post(`/api/v1/tasks/${taskIds[0]}/results`,{data:{work_completed:'Simulation revised',outcome:'Ready',attachment_ids:[(await file.json()).id]}});assert.equal(result.status(),201);
  assert.equal((await subOwner.ctx.post(`/api/v1/results/${(await result.json()).id}/review`,{data:{accept:true,comment:'Signed off'}})).status(),200);
  meeting=await (await taskOwner.ctx.get(`/api/v1/meetings/${meetingId}`)).json();assert.equal(meeting.actions.find(item=>item.id===taskIds[0]).status,'DONE');assert.equal(meeting.actions.find(item=>item.id===secondId).status,'NOT_STARTED');
  const projectList=await (await pm.ctx.get(`/api/v1/projects/${project.id}/meetings`)).json();assert.ok(projectList.some(item=>item.id===meetingId&&item.action_done===1&&item.action_total===2));
  const audit=await (await pm.ctx.get(`/api/v1/projects/${project.id}/audit`)).json();
  for(const kind of ['MEETING_CREATED','MEETING_UPDATED'])assert.ok(audit.some(item=>item.action===kind&&item.details?.meeting_id===meetingId),`Missing ${kind} audit record`);

  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId('login-username').fill('pm.demo');await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');await page.getByTestId('login-submit').click();await page.getByTestId('nav-projects').click();
  await page.locator('.meeting-list-row').filter({hasText:'Final simulation review'}).first().click();
  await page.getByRole('heading',{name:'Final simulation review'}).waitFor();await page.getByText('Boundary conditions approved.').waitFor();
  await page.getByText('Revise simulation report').waitFor();await page.getByText('Done',{exact:true}).first().waitFor();
  assert.equal((await taskOwner.ctx.post(`/api/v1/tasks/${secondId}/status`,{data:{}})).status(),200);
  await page.locator('.meeting-action-row').filter({hasText:'Archive simulation evidence'}).getByText('In progress').waitFor({timeout:12000});
  await page.getByRole('button',{name:'Back to project'}).click();
  await page.getByRole('button',{name:'Record meeting'}).last().click();
  const form=page.locator('.meeting-form').last();await form.locator('input[name=title]').fill('Browser project review');await form.locator('textarea[name=minutes]').fill('PM recorded the review decision.');await form.getByRole('button',{name:'Add action item'}).click();await form.locator('.meeting-action-draft input').first().fill('Send follow-up note');await form.locator('.meeting-action-draft select').selectOption(String(taskOwner.user.id));await form.locator('.meeting-action-draft input[type=date]').fill(date(11));await form.getByRole('button',{name:'Save meeting'}).click();
  await page.getByRole('heading',{name:'Browser project review'}).waitFor();await page.getByText('Send follow-up note').waitFor();
  const viewer=await browser.newPage({ignoreHTTPSErrors:true});await viewer.goto(origin);await viewer.getByTestId('login-username').fill('scientist2.demo');await viewer.getByTestId('login-password').fill('CVRDE-Demo-2026!');await viewer.getByTestId('login-submit').click();await viewer.getByTestId('nav-projects').click();
  await viewer.locator('.meeting-list-row').filter({hasText:'Final simulation review'}).first().click();await viewer.getByRole('heading',{name:'Final simulation review'}).waitFor();
  assert.equal(await viewer.getByRole('button',{name:'Edit meeting'}).count(),0);assert.equal(await viewer.getByRole('button',{name:'Add action item'}).count(),0);
  console.log('Meeting #11 passed: owner permissions, minutes/attendees, task actions, notifications, live status, and browser creation.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()));await browser.close()}

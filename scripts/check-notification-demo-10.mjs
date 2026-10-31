import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const contexts=[];
async function login(username){const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200);return {ctx,user:await response.json()}}
const browser=await chromium.launch({headless:true});
try{
  const pm=await login('pm.demo'),subOwner=await login('scientist1.demo'),taskOwner=await login('scientist2.demo');
  const project=(await (await pm.ctx.get('/api/v1/projects')).json()).find(item=>item.name.includes('Engine Component Development'));assert.ok(project);
  const due=new Date(project.target_date.slice(0,10)+'T00:00:00Z');due.setUTCDate(due.getUTCDate()-10);const dueDate=due.toISOString().slice(0,10);
  const spResponse=await pm.ctx.post(`/api/v1/projects/${project.id}/sub-projects`,{data:{name:`Notification review ${Date.now()}`,objective:'Review',owner_id:subOwner.user.id,due_date:dueDate}});assert.equal(spResponse.status(),201);const sp=await spResponse.json();
  const taskResponse=await subOwner.ctx.post(`/api/v1/projects/${project.id}/tasks`,{data:{sub_project_id:sp.id,title:'Notification loop task',description:'',owner_id:taskOwner.user.id,due_date:dueDate,priority:'MEDIUM'}});assert.equal(taskResponse.status(),201);const task=await taskResponse.json();
  assert.equal((await taskOwner.ctx.post(`/api/v1/tasks/${task.id}/status`,{data:{}})).status(),200);
  async function upload(name){const response=await taskOwner.ctx.post(`/api/v1/tasks/${task.id}/attachments`,{multipart:{document_key:name,file:{name,mimeType:'text/plain',buffer:Buffer.from(name)}}});assert.equal(response.status(),201);return (await response.json()).id}
  async function submit(name){const fileId=await upload(name);const response=await taskOwner.ctx.post(`/api/v1/tasks/${task.id}/results`,{data:{work_completed:name,outcome:name,attachment_ids:[fileId]}});assert.equal(response.status(),201);return (await response.json()).id}
  const first=await submit('first.txt');assert.equal((await subOwner.ctx.post(`/api/v1/results/${first}/review`,{data:{accept:false,comment:'Revise'}})).status(),200);
  const second=await submit('revised.txt');assert.equal((await subOwner.ctx.post(`/api/v1/results/${second}/review`,{data:{accept:true,comment:'Signed off'}})).status(),200);
  assert.equal((await taskOwner.ctx.post(`/api/v1/tasks/${task.id}/comments`,{data:{body:'Thanks for reviewing'}})).status(),201);
  const ownerNotifications=(await (await taskOwner.ctx.get('/api/v1/me/notifications')).json()).filter(item=>item.task_id===task.id);
  const reviewerNotifications=(await (await subOwner.ctx.get('/api/v1/me/notifications')).json()).filter(item=>item.task_id===task.id);
  for(const kind of ['ASSIGNED','RETURNED','ACCEPTED'])assert.ok(ownerNotifications.some(item=>item.event_type===kind),`Task owner missing ${kind}`);
  for(const kind of ['SUBMITTED','COMMENT'])assert.ok(reviewerNotifications.some(item=>item.event_type===kind),`Sub-project owner missing ${kind}`);
  const unread=ownerNotifications.find(item=>!item.read_at);assert.ok(unread);
  assert.equal((await taskOwner.ctx.post(`/api/v1/me/notifications/${unread.id}/read`,{data:{}})).status(),200);
  assert.ok((await (await taskOwner.ctx.get('/api/v1/me/notifications')).json()).find(item=>item.id===unread.id).read_at);

  const page=await browser.newPage({ignoreHTTPSErrors:true});await page.goto(origin);await page.getByTestId('login-username').fill('scientist2.demo');await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');await page.getByTestId('login-submit').click();
  const bell=page.getByRole('button',{name:/Notifications, \d+ unread/});await bell.waitFor();const count=Number((await bell.getAttribute('aria-label')).match(/(\d+) unread/)?.[1]);
  const actionResponse=await pm.ctx.post(`/api/v1/projects/${project.id}/meetings`,{data:{title:'Notification review meeting',meeting_date:new Date().toISOString().slice(0,10),minutes:'Assign the follow-up.',attendee_ids:[pm.user.id,taskOwner.user.id],actions:[{description:'Meeting action notification task',owner_id:taskOwner.user.id,due_date:dueDate}]}});assert.equal(actionResponse.status(),201);const actionId=(await actionResponse.json()).task_ids[0];
  await page.waitForFunction(expected=>Number(document.querySelector('.bell-button')?.getAttribute('aria-label')?.match(/(\d+) unread/)?.[1])===expected,count+1,{timeout:15000});
  await bell.click();await page.getByText('Meeting action assigned: Meeting action notification task').click();
  await page.getByRole('heading',{name:'Task detail'}).waitFor();await page.getByText('Meeting action notification task').first().waitFor();
  assert.equal((await (await taskOwner.ctx.get('/api/v1/me/notifications')).json()).find(item=>item.task_id===actionId).read_at!==null,true);
  assert.equal((await taskOwner.ctx.post('/api/v1/me/notifications/read-all',{data:{}})).status(),200);
  assert.equal((await (await taskOwner.ctx.get('/api/v1/me/notifications')).json()).filter(item=>!item.read_at).length,0);
  console.log('Notification #10 passed: correct recipients, live bell count, task click, read and read-all.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()));await browser.close()}

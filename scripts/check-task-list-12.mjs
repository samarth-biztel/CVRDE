import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost',contexts=[];
async function login(username){const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200);return {ctx,user:await response.json()}}
const browser=await chromium.launch({headless:true});
try{
  const pm=await login('pm.demo'),owner=await login('scientist2.demo'),subOwner=await login('scientist1.demo');
  const project=(await (await pm.ctx.get('/api/v1/projects')).json()).find(item=>item.name.includes('Engine Component Development'));assert.ok(project);
  const future=new Date(project.target_date.slice(0,10)+'T00:00:00Z');future.setUTCDate(future.getUTCDate()-8);const subDue=future.toISOString().slice(0,10);
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const lateDue=yesterday.toISOString().slice(0,10);
  const subResponse=await pm.ctx.post(`/api/v1/projects/${project.id}/sub-projects`,{data:{name:'Task table verification',objective:'Check list filters',owner_id:subOwner.user.id,due_date:subDue}});assert.equal(subResponse.status(),201);const sp=await subResponse.json();
  const taskResponse=await subOwner.ctx.post(`/api/v1/projects/${project.id}/tasks`,{data:{sub_project_id:sp.id,title:'Overdue table verification',description:'',owner_id:owner.user.id,due_date:lateDue,priority:'HIGH'}});assert.equal(taskResponse.status(),201);
  const meetingResponse=await pm.ctx.post(`/api/v1/projects/${project.id}/meetings`,{data:{title:'Task table review',meeting_date:new Date().toISOString().slice(0,10),minutes:'Track follow-up.',attendee_ids:[pm.user.id,owner.user.id],actions:[{description:'Meeting table verification',owner_id:owner.user.id,due_date:subDue}]}});assert.equal(meetingResponse.status(),201);
  const tasks=await (await pm.ctx.get(`/api/v1/projects/${project.id}/tasks`)).json();assert.equal(tasks.find(item=>item.title==='Overdue table verification')?.sub_project_name,sp.name);
  const openPage=async username=>{const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId('login-username').fill(username);await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');await page.getByTestId('login-submit').click();await page.getByTestId('nav-tasks').click();return page};
  const page=await openPage('pm.demo');const table=page.locator('.pm-task-list');await table.getByRole('button',{name:/Due date/}).waitFor();
  const expected=tasks.filter(item=>item.due_date).sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.id-b.id)[0];assert.ok((await table.locator('tbody tr').first().innerText()).includes(expected.title));
  await table.getByRole('columnheader',{name:/Sub-project/}).waitFor();
  const meetingRow=table.locator('tbody tr').filter({hasText:'Meeting table verification'});await meetingRow.getByText(/From: Task table review/).waitFor();
  await table.getByLabel('Filter sub-project').selectOption(String(sp.id));await table.getByLabel('Filter owner').selectOption(String(owner.user.id));await table.getByLabel('Filter status').selectOption('NOT_STARTED');await table.getByLabel('Filter due date').selectOption('overdue');
  assert.equal(await table.locator('tbody tr').count(),1);const row=table.locator('tbody tr').first();assert.match(await row.innerText(),/Overdue table verification/);await row.locator('td.due-overdue').waitFor();
  const userPage=await openPage('scientist2.demo');const userTable=userPage.locator('section.card').filter({has:userPage.getByRole('heading',{name:'My tasks',exact:true})});await userTable.getByLabel('Filter sub-project').selectOption(String(sp.id));
  assert.ok((await userTable.locator('tbody tr').allInnerTexts()).some(value=>value.includes('Overdue table verification')));
  await userTable.getByLabel('Filter sub-project').selectOption('direct');await userTable.locator('tbody tr').filter({hasText:'Meeting table verification'}).getByText(/From: Task table review/).waitFor();
  console.log('Task list #12 passed: sub-project column/filter, owner/status/due filters, due sort/urgency, and meeting marker for PM and user.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()));await browser.close()}

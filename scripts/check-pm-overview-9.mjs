import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const contexts=[];
const login=async username=>{const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200);return {ctx,user:await response.json()}};
const browser=await chromium.launch({headless:true});
try{
  const pm=await login('pm.demo'),subOwner=await login('scientist1.demo'),taskOwner=await login('scientist2.demo');
  const project=(await (await pm.ctx.get('/api/v1/projects')).json()).find(item=>item.name.includes('Engine Component Development'));assert.ok(project);
  const endpoint=`/api/v1/projects/${project.id}`;
  assert.equal((await (await pm.ctx.get(endpoint)).json()).stale_after_days,14);
  assert.ok([403,404].includes((await subOwner.ctx.patch(endpoint,{data:{stale_after_days:1}})).status()));
  assert.equal((await pm.ctx.patch(endpoint,{data:{stale_after_days:0}})).status(),400);
  assert.equal((await pm.ctx.patch(endpoint,{data:{stale_after_days:61}})).status(),400);
  assert.equal((await pm.ctx.patch(endpoint,{data:{stale_after_days:1}})).status(),200);
  assert.equal((await (await pm.ctx.get(`${endpoint}/risk`)).json()).stale_after_days,1);
  const target=project.target_date.slice(0,10);const date=new Date(`${target}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-8);const due=date.toISOString().slice(0,10);
  const spResponse=await pm.ctx.post(`${endpoint}/sub-projects`,{data:{name:'PM overview verification',objective:'Review progress',owner_id:subOwner.user.id,due_date:due}});assert.equal(spResponse.status(),201);const sp=await spResponse.json();
  const taskResponse=await subOwner.ctx.post(`${endpoint}/tasks`,{data:{sub_project_id:sp.id,title:'PM progress verification task',description:'',owner_id:taskOwner.user.id,due_date:due,priority:'MEDIUM'}});assert.equal(taskResponse.status(),201);const task=await taskResponse.json();
  const actionResponse=await pm.ctx.post(`${endpoint}/tasks`,{data:{title:'Follow up from PM overview meeting',description:'',owner_id:subOwner.user.id,due_date:due,priority:'MEDIUM',source_meeting_title:'PM overview meeting'}});assert.equal(actionResponse.status(),201);const action=await actionResponse.json();
  let risk=await (await pm.ctx.get(`${endpoint}/risk`)).json();assert.equal(risk.sub_projects.find(item=>item.id===sp.id)?.task_done,0);assert.ok(risk.tasks.find(item=>item.id===action.id)?.source_meeting_title);
  assert.equal((await taskOwner.ctx.post(`/api/v1/tasks/${task.id}/status`,{data:{}})).status(),200);
  const uploaded=await taskOwner.ctx.post(`/api/v1/tasks/${task.id}/attachments`,{multipart:{document_key:'evidence',file:{name:'simulation.txt',mimeType:'text/plain',buffer:Buffer.from('Evidence')}}});assert.equal(uploaded.status(),201);
  const result=await taskOwner.ctx.post(`/api/v1/tasks/${task.id}/results`,{data:{work_completed:'Done',outcome:'Ready',attachment_ids:[(await uploaded.json()).id]}});assert.equal(result.status(),201);
  assert.equal((await subOwner.ctx.post(`/api/v1/results/${(await result.json()).id}/review`,{data:{accept:true,comment:'Signed off'}})).status(),200);
  risk=await (await pm.ctx.get(`${endpoint}/risk`)).json();assert.equal(risk.sub_projects.find(item=>item.id===sp.id)?.task_done,1);
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId('login-username').fill('pm.demo');await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');await page.getByTestId('login-submit').click();
  await page.getByRole('heading',{name:'Sub-project progress'}).waitFor();await page.getByRole('heading',{name:/Open action items/}).waitFor();
  const row=page.locator('.sub-project-overview-row').filter({hasText:sp.name});await row.getByText('1 / 1').waitFor();
  await page.locator('.pm-action-items').getByText('Follow up from PM overview meeting').waitFor();await row.click();await page.getByRole('heading',{name:sp.name}).waitFor();
  await page.getByTestId('nav-settings').click();await page.getByLabel('Flag tasks with no update after X days').waitFor();assert.equal(await page.getByLabel('Flag tasks with no update after X days').inputValue(),'1');
  console.log('PM Overview #9 passed: owner permissions, stale range, project progress, meeting actions, and navigation.');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()));await browser.close()}

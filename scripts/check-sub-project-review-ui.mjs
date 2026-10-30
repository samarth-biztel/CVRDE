import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const api=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});
const browser=await chromium.launch({headless:true});
try{
  const loginApi=async name=>{const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});const response=await ctx.post('/api/v1/auth/login',{data:{username:name,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200);return {ctx,id:(await response.json()).id}};
  const pmApi=await loginApi('pm.demo'),subApi=await loginApi('scientist1.demo'),taskApi=await loginApi('scientist2.demo');
  const project=(await (await pmApi.ctx.get('/api/v1/projects')).json()).find(item=>item.name.includes('Engine Component Development'));assert.ok(project);
  const date=new Date(project.target_date.slice(0,10)+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-10);const due=date.toISOString().slice(0,10);
  const subResponse=await pmApi.ctx.post(`/api/v1/projects/${project.id}/sub-projects`,{data:{name:`Browser review ${Date.now()}`,objective:'Review simulation',owner_id:subApi.id,due_date:due}});assert.equal(subResponse.status(),201);const subProject=await subResponse.json();
  const taskResponse=await subApi.ctx.post(`/api/v1/projects/${project.id}/tasks`,{data:{sub_project_id:subProject.id,title:'Browser simulation review',description:'Simulation',expected_deliverables:'Report',owner_id:taskApi.id,due_date:due,priority:'HIGH'}});assert.equal(taskResponse.status(),201);const task=await taskResponse.json();
  assert.equal((await taskApi.ctx.post(`/api/v1/tasks/${task.id}/status`,{data:{}})).status(),200);
  const file=await taskApi.ctx.post(`/api/v1/tasks/${task.id}/attachments`,{multipart:{document_key:'simulation',file:{name:'simulation.txt',mimeType:'text/plain',buffer:Buffer.from('Simulation evidence')}}});assert.equal(file.status(),201);
  assert.equal((await taskApi.ctx.post(`/api/v1/tasks/${task.id}/results`,{data:{work_completed:'Simulation done',outcome:'Ready',attachment_ids:[(await file.json()).id]}})).status(),201);
  const login=async name=>{const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId('login-username').fill(name);await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');await page.getByTestId('login-submit').click();return page};
  const subOwner=await login('scientist1.demo');
  await subOwner.getByTestId('nav-pending').waitFor();
  await subOwner.getByTestId('nav-pending').click();
  const card=subOwner.locator('.review-card').filter({hasText:'Browser simulation review'});
  await card.getByText(subProject.name).waitFor();
  await card.getByRole('link',{name:'simulation.txt'}).waitFor();
  await card.getByRole('button',{name:'Return'}).click();
  await subOwner.getByText('Enter a reason before this decision').waitFor();
  await card.getByLabel('Decision reason for Browser simulation review').fill('Correct the boundary conditions');
  await card.getByRole('button',{name:'Return'}).click();
  await subOwner.getByText('Result returned').waitFor();
  const taskOwner=await login('scientist2.demo');
  await taskOwner.getByRole('heading',{name:/Returned to you/}).waitFor();
  await taskOwner.getByText('Correct the boundary conditions').first().waitFor();
  await taskOwner.getByTestId('nav-tasks').click();
  await taskOwner.locator('.workspace-table tbody tr').filter({hasText:'Browser simulation review'}).click();
  await taskOwner.getByText('Correct the boundary conditions').first().waitFor();
  assert.equal(await taskOwner.getByTestId('nav-pending').count(),0);
  await Promise.all([pmApi.ctx.dispose(),subApi.ctx.dispose(),taskApi.ctx.dispose()]);
  console.log('Sub-project review UI check passed: owner Review queue, evidence, required return reason, and Returned banner.');
}finally{await api.dispose();await browser.close()}

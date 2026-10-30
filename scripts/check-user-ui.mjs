import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const api=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});
const browser=await chromium.launch({headless:true});
try{
  assert.equal((await api.post('/api/v1/auth/login',{data:{username:'pm.demo',password:'CVRDE-Demo-2026!'}})).status(),200);
  const pending=await (await api.get('/api/v1/me/pending-actions')).json();
  const result=pending.find(a=>a.kind==='RESULT_REVIEW'&&a.title==='Instrumentation readiness review');assert.ok(result);
  assert.equal((await api.post(`/api/v1/results/${result.id}/review`,{data:{accept:false,comment:'Please revise the channel map'}})).status(),200);
  const project=(await (await api.get('/api/v1/projects')).json()).find(p=>p.name.includes('Engine Component Development'));assert.ok(project);
  const material=(await (await api.get(`/api/v1/projects/${project.id}/tasks`)).json()).find(t=>t.title==='Material sample testing');assert.ok(material);
  assert.equal((await api.post(`/api/v1/tasks/${material.id}/comments`,{data:{body:'Please check the latest sample notes'}})).status(),201);

  const second=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  await second.goto(origin);
  await second.getByTestId('login-username').fill('scientist2.demo');await second.getByTestId('login-password').fill('CVRDE-Demo-2026!');await second.getByTestId('login-submit').click();
  await second.getByRole('heading',{name:/Returned to you/}).waitFor();
  await second.getByText('Please revise the channel map').first().waitFor();
  assert.equal(await second.getByText('Material sample testing').count(),0);
  await second.getByTestId('nav-submissions').click();
  await second.getByText('Please revise the channel map').first().waitFor();
  await second.getByText('Revise assumptions').waitFor();
  await second.getByTestId('nav-tasks').click();
  await second.getByRole('button',{name:'Shared with me'}).click();
  await second.locator('.shared-task-table').waitFor();
  assert.equal(await second.getByRole('button',{name:'Start',exact:true}).count(),0);
  assert.equal(await second.getByRole('button',{name:'Submit for review'}).count(),0);
  await second.getByTestId('nav-projects').click();
  await second.getByRole('heading',{name:'Team',exact:true}).waitFor();
  assert.equal(await second.getByRole('button',{name:'Edit project'}).count(),0);
  await second.goto(`${origin}/review`);
  await second.getByRole('heading',{name:'My work'}).waitFor();
  assert.equal(await second.getByTestId('nav-pending').count(),0);

  const first=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  await first.goto(origin);
  await first.getByTestId('login-username').fill('scientist1.demo');await first.getByTestId('login-password').fill('CVRDE-Demo-2026!');await first.getByTestId('login-submit').click();
  await first.getByRole('heading',{name:'My open tasks'}).waitFor();
  await first.getByText('Please check the latest sample notes').waitFor();
  assert.equal(await first.getByText('Nothing needs your action').count(),0);
  assert.equal(await first.locator('.stat-grid').count(),0);
  const startRow=first.locator('.work-task-row').filter({hasText:'Fatigue test setup'});
  await startRow.getByRole('button',{name:'Start',exact:true}).click();
  await first.getByText('Task started').waitFor();
  await first.getByTestId('nav-tasks').click();
  await first.getByRole('button',{name:'My tasks',exact:true}).waitFor();
  const row=first.locator('.workspace-table tbody tr').filter({hasText:'Material sample testing'});
  await row.getByRole('button',{name:'Submit for review'}).click();
  await row.getByLabel('Result summary for Material sample testing').fill('Sample tests completed for review');
  await row.getByRole('button',{name:'Submit',exact:true}).click();
  await first.getByText('Submitted for review').waitFor();
  await first.getByTestId('nav-submissions').click();
  await first.getByText('Sample tests completed for review').waitFor();
  await first.getByText('Pending',{exact:true}).first().waitFor();
  console.log('User UI check passed: landing, returned reason, owner-only lists, inline actions, shared view, submissions, read-only project, and Review URL.');
}finally{await api.dispose();await browser.close()}

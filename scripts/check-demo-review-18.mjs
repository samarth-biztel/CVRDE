import assert from 'node:assert/strict';
import {request,chromium} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const password='CVRDE-Demo-2026!';
const contexts=[];
async function login(username){const context=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(context);const response=await context.post('/api/v1/auth/login',{data:{username,password}});assert.equal(response.status(),200,`${username}: ${await response.text()}`);return context}
let browser;
try{
  const pm=await login('pm.demo'),owner=await login('scientist1.demo');
  const project=(await (await pm.get('/api/v1/projects')).json()).find(item=>item.name==='Engine Development Programme');assert.ok(project);
  const design=(await (await pm.get(`/api/v1/projects/${project.id}/sub-projects`)).json()).find(item=>item.name==='Design & Simulation');assert.ok(design);
  const denied=await owner.patch(`/api/v1/sub-projects/${design.id}`,{data:{objective:design.objective}});assert.equal(denied.status(),403,'sub-project owner must not edit details');
  const allowed=await pm.patch(`/api/v1/sub-projects/${design.id}`,{data:{objective:design.objective}});assert.equal(allowed.status(),200,'PM must edit details');
  const risk=await (await pm.get(`/api/v1/projects/${project.id}/risk`)).json();
  const named=title=>{const task=risk.tasks.find(item=>item.title===title);assert.ok(task,title);return task};
  assert.ok(new Date(named('Crankshaft stress analysis').due_date)<new Date());
  assert.equal(named('Friction loss estimation').status,'NOT_STARTED');
  assert.ok(Date.now()-new Date(named('Cooling jacket design').last_activity_at).getTime()>5*86400000);
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  await page.goto(origin);
  await page.getByTestId('demo-pm-demo').click();await page.getByTestId('login-submit').click();
  const panel=page.locator('.pm-risk');await panel.waitFor();
  for(const title of ['Crankshaft stress analysis','Friction loss estimation','Cooling jacket design'])await panel.getByText(title).waitFor();
  assert.ok(await panel.getByText('No update in',{exact:false}).count());
  await panel.getByText('Crankshaft stress analysis').click();
  await page.getByText('Activity',{exact:true}).waitFor();
  assert.equal(await page.getByText('Prerequisites',{exact:true}).count(),0);
  assert.equal(await page.getByText('Linked to',{exact:true}).count(),0);
  assert.equal(await page.getByText(/"owner_id"/).count(),0,'task page must not show raw JSON');
  assert.equal(await page.getByText(/"task_id"/).count(),0,'task page must not show raw JSON');
  console.log(`Issue #18 checks passed at ${origin}: PM edit, owner 403, three risk rules visible.`);
}finally{await browser?.close();await Promise.all(contexts.map(context=>context.dispose()))}

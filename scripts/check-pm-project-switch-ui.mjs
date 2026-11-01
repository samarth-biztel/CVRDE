import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(origin);
  await page.getByTestId('demo-pm-demo').click();
  await page.getByTestId('login-submit').click();
  const picker=page.locator('.sidebar-project select');
  await picker.waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.sidebar-project select option').length>=2);
  await page.waitForFunction(()=>document.querySelector('.sidebar-project select')?.selectedOptions[0]?.textContent==='Engine Development Programme');
  const options=await picker.locator('option').allTextContents();
  assert.ok(options.includes('Engine Development Programme'));
  assert.ok(!options.includes('BiztelAI_Work'));
  assert.ok(!options.includes('TEAL_DEMO'));
  await page.getByTestId('nav-settings').waitFor();
  await page.getByTestId('nav-pending').waitFor();
  const projectId=Number(await picker.inputValue());
  assert.equal((await page.request.get(`${origin}/api/v1/projects/${projectId}`)).status(),200);
  await page.getByRole('button',{name:'Project details'}).click();
  await page.getByRole('heading',{name:'Project details'}).waitFor();
  await page.locator('.project-overview-facts').waitFor();
  await page.getByRole('heading',{name:'Team'}).waitFor();
  await page.getByRole('heading',{name:'Documents'}).waitFor();
  if(process.env.CVRDE_SCREENSHOTS){await page.waitForTimeout(400);await page.screenshot({path:'.project-overview-preview.png'})}
  await page.getByTestId('nav-tasks').click();
  assert.equal(await picker.inputValue(),String(projectId));
  if(process.env.CVRDE_SCREENSHOTS)await page.route('**/api/v1/me/notifications',route=>route.fulfill({json:Array.from({length:8},(_,i)=>({id:i+1,event_type:'ASSIGNED',task_id:null,project_id:projectId,subject:i===0?'Task assigned: A detailed engineering task with a longer title that must wrap cleanly':`Result submitted: Project work item ${i+1}`,sent_at:'2026-11-01T10:30:00Z',read_at:null}))}));
  await page.reload();
  await picker.waitFor();
  await page.waitForFunction(id=>document.querySelector('.sidebar-project select')?.value===id,String(projectId));
  assert.equal(await picker.inputValue(),String(projectId));
  await page.getByRole('button',{name:/Notifications/}).click();
  await page.locator('.notification-popover').waitFor();
  if(process.env.CVRDE_SCREENSHOTS){await page.locator('.notification-row').first().waitFor();await page.screenshot({path:'.notification-preview.png'})}
  assert.equal(await page.locator('.notification-popover').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.equal(await page.locator('.notification-list').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.getByTestId('nav-overview').click();
  await page.locator('.demo-subproject-grid button').first().waitFor();
  assert.equal(await page.locator('.demo-subproject-grid button').count(),3);
  console.log('PM project picker scope, project layout, and notification panel passed.');
}finally{await browser.close()}

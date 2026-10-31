import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  await page.goto(process.env.CVRDE_UI_URL||'https://localhost');
  if(process.env.CVRDE_SCREENSHOT_LOGIN==='1')await page.screenshot({path:'docs/login-redesign-preview.png',fullPage:true});
  await page.setViewportSize({width:375,height:812});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'login should fit a narrow screen');
  if(process.env.CVRDE_SCREENSHOT_LOGIN==='1')await page.screenshot({path:'docs/login-mobile-preview.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  const chooser=page.locator('.demo-logins');
  assert.doesNotMatch(await chooser.innerText(),/pm\.demo|CVRDE-Demo-2026!/);
  await page.getByTestId('demo-pm-demo').click();
  assert.equal(await page.getByTestId('login-username').inputValue(),'pm.demo');
  assert.equal(await page.getByTestId('login-password').getAttribute('type'),'password');
  await page.getByRole('button',{name:'Show password'}).click();
  assert.equal(await page.getByTestId('login-password').getAttribute('type'),'text');
  await page.getByRole('button',{name:'Hide password'}).click();
  assert.equal(await page.getByTestId('login-password').getAttribute('type'),'password');
  await page.getByTestId('login-submit').click();
  await page.getByRole('heading',{name:'Team workload'}).waitFor();
  const box=async selector=>{const value=await page.locator(selector).boundingBox();assert.ok(value,selector);return value};
  const decision=await box('.pm-decision'),risk=await box('.pm-risk'),workload=await box('.pm-workload'),progress=await box('.pm-progress'),mine=await box('.pm-my-tasks'),activity=await box('.pm-recent-activity');
  assert.ok(decision.x<risk.x&&workload.x<progress.x);
  assert.ok(workload.y>decision.y&&mine.y>progress.y);
  assert.ok(activity.y>=Math.max(workload.y+workload.height,mine.y+mine.height)+16);
  await page.getByTestId('nav-projects').click();
  await page.locator('.project-detail-head').waitFor();
  assert.ok((await box('.project-summary-grid')).y>(await box('.project-detail-head')).y);
  await page.getByRole('button',{name:'View tasks'}).click();
  await page.getByRole('heading',{name:'Tasks',exact:true}).last().waitFor();
  const tabs=await box('.pm-tasks-toolbar .pm-tabs'),newTask=await box('.pm-tasks-toolbar .pm-new-task');
  assert.ok(Math.abs(tabs.y-newTask.y)<12,'task tabs and New task should share one row');
  if(process.env.CVRDE_SCREENSHOT_LOGIN==='1'){await page.locator('.pm-tasks-toolbar').evaluate(node=>node.scrollIntoView({block:'start'}));const toolbar=await box('.pm-tasks-toolbar');await page.screenshot({path:'docs/tasks-toolbar-preview.png',clip:{x:toolbar.x,y:Math.max(0,toolbar.y),width:toolbar.width,height:toolbar.height}})}
  await page.setViewportSize({width:375,height:812});
  const mobileTabs=await box('.pm-tasks-toolbar .pm-tabs'),mobileNewTask=await box('.pm-tasks-toolbar .pm-new-task');
  assert.ok(Math.abs(mobileTabs.y-mobileNewTask.y)<12,'task toolbar should stay on one row on mobile');
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('columnheader',{name:'Select'}).waitFor();
  assert.equal(await page.getByRole('columnheader',{name:'Select'}).count(),1);
  assert.equal(await page.locator('.pm-row-edit').count(),0);
  await page.getByLabel(/^Select /).first().check();
  if(process.env.CVRDE_SCREENSHOT_LOGIN==='1'){await page.locator('.pm-task-list').evaluate(node=>node.scrollIntoView({block:'start'}));const table=await box('.pm-task-list');await page.screenshot({path:'docs/tasks-selection-preview.png',clip:{x:table.x,y:Math.max(0,table.y),width:table.width,height:Math.min(table.height,530)}})}
  assert.ok((await box('.pm-bulk-toolbar')).y<(await box('.table-filters')).y);
  await page.getByLabel('Bulk owner').waitFor();
  await page.setViewportSize({width:760,height:900});
  await page.getByTestId('nav-overview').click();
  await page.getByRole('heading',{name:'Team workload'}).waitFor();
  assert.ok(Math.abs((await box('.pm-decision')).x-(await box('.pm-risk')).x)<2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
  console.log('PM layout check passed: overview card grid, section spacing, project summary, and task toolbar.');
}finally{await browser.close()}

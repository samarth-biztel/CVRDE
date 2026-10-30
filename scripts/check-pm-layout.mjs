import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  await page.goto(process.env.CVRDE_UI_URL||'https://localhost');
  await page.getByTestId('login-username').fill('pm.demo');
  await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');
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
  await page.getByLabel(/^Select /).first().check();
  assert.ok((await box('.pm-bulk-toolbar')).y<(await box('.table-filters')).y);
  await page.locator('.pm-row-edit summary').first().click();
  await page.getByLabel(/^Reassign /).first().waitFor();
  await page.setViewportSize({width:760,height:900});
  await page.getByTestId('nav-overview').click();
  await page.getByRole('heading',{name:'Team workload'}).waitFor();
  assert.ok(Math.abs((await box('.pm-decision')).x-(await box('.pm-risk')).x)<2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
  console.log('PM layout check passed: overview card grid, section spacing, project summary, and task toolbar.');
}finally{await browser.close()}

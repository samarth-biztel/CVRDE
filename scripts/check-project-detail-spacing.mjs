import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  await page.goto(process.env.CVRDE_UI_URL||'https://localhost');
  await page.getByTestId('demo-pm-demo').click();
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-projects').click();
  const legacy=page.locator('.project-list-row').filter({hasText:'Engine Component Development'});
  await legacy.waitFor();await legacy.click();
  const detail=page.locator('.project-detail');await detail.waitFor();
  for(const selector of ['.project-summary-grid','.sub-projects','.milestones','.meetings-panel'])await detail.locator(selector).waitFor();
  const borders=await detail.evaluate(node=>{
    const widths=(selector)=>{const style=getComputedStyle(node.querySelector(selector));return [style.borderTopWidth,style.borderBottomWidth]};
    return {summary:widths('.project-summary-grid'),subProjects:widths('.sub-projects'),milestones:widths('.milestones'),meetings:widths('.meetings-panel'),meetingTitle:widths('.meetings-panel h3')};
  });
  assert.equal(borders.summary[1],'0px');
  for(const section of ['subProjects','milestones','meetings'])assert.deepEqual(borders[section],['1px','0px'],section);
  assert.deepEqual(borders.meetingTitle,['0px','0px']);
  if(process.env.CVRDE_SCREENSHOT_PROJECT==='1')await detail.screenshot({path:'docs/project-detail-spacing-preview.png'});
  console.log('Project detail spacing passed: one divider per section and consistent meeting heading.');
}finally{await browser.close()}

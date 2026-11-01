import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
async function login(username){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(origin);
  await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-projects').waitFor();
  return page;
}
try{
  const taskOwner=await login('scientist2.demo');
  await taskOwner.getByTestId('nav-projects').click();
  await taskOwner.locator('.user-projects').waitFor();
  await taskOwner.locator('.user-projects .project-detail-head').waitFor();
  const projectText=await taskOwner.locator('.user-projects').innerText();
  assert.match(projectText,/Engine Development Programme/);
  assert.doesNotMatch(projectText,/Design & Simulation|Prototype Build|Testing & Validation/);
  assert.equal(await taskOwner.locator('.project-list-row').count(),0);
  await taskOwner.getByTestId('nav-tasks').click();
  await taskOwner.getByRole('heading',{name:'My tasks',exact:true}).waitFor();
  await taskOwner.getByRole('button',{name:'Sub-project tasks'}).click();
  await taskOwner.locator('.dependency-peer').first().waitFor();
  assert.equal(await taskOwner.locator('.dependency-peer a').count(),0);
  await taskOwner.locator('.dependency-peer').first().getByRole('button',{name:'Raise dependency'}).click();
  assert.ok(await taskOwner.locator('.dependency-peer').first().getByRole('combobox',{name:'My task'}).locator('option').count()>1);

  const subOwner=await login('scientist1.demo');
  await subOwner.getByTestId('nav-projects').click();
  await subOwner.locator('.user-projects .sub-projects').waitFor();
  await subOwner.locator('.user-projects .sub-projects').getByText('Design & Simulation',{exact:true}).waitFor();
  const subText=await subOwner.locator('.user-projects .sub-projects').innerText();
  assert.match(subText,/Design & Simulation/);
  assert.doesNotMatch(subText,/Prototype Build|Testing & Validation/);
  await subOwner.getByRole('button',{name:'Design & Simulation'}).first().click();
  await subOwner.getByRole('button',{name:'New task'}).waitFor();

  const pm=await login('pm.demo');
  await pm.getByTestId('nav-projects').click();
  await pm.locator('.project-list-row').first().waitFor();
  assert.ok(await pm.locator('.project-list-row').count()>=2);
  console.log('Role scope UI passed: task-owner project and dependency views, sub-project-owner management view, PM project list.');
}finally{await browser.close()}

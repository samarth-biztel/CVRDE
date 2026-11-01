import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
async function login(username,landing){const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();await page.getByTestId('login-submit').click();await page.getByTestId(`nav-${landing}`).waitFor();return page}
try{
  const pm=await login('pm.demo','overview');
  assert.equal(await pm.getByTestId('nav-projects').count(),0);assert.equal(await pm.locator('.sidebar-project').count(),0);assert.equal(await pm.getByTestId('nav-reports').count(),0);
  await pm.locator('.demo-project-home').waitFor();await pm.locator('.demo-subproject-grid button').first().waitFor();assert.equal(await pm.locator('.demo-subproject-grid button').count(),3);
  for(const text of ['At risk','Open meeting actions','Milestones','Sub-projects'])assert.ok((await pm.locator('.demo-project-home').innerText()).includes(text));
  await pm.locator('.demo-home-grid').getByRole('button',{name:/Share CFD assumptions/}).click();await pm.locator('.meeting-source').waitFor();await pm.locator('.meeting-source').click();await pm.getByRole('heading',{name:'Minutes'}).waitFor();
  const sub=await login('scientist1.demo','subproject');
  assert.equal(await sub.getByTestId('nav-projects').count(),0);await sub.locator('.role-home').waitFor();await sub.getByRole('heading',{name:'Design & Simulation'}).waitFor();assert.doesNotMatch(await sub.locator('.role-home').innerText(),/Prototype Build|Testing & Validation/);await sub.getByRole('button',{name:'New task'}).waitFor();
  const task=await login('scientist2.demo','mine');
  assert.equal(await task.getByTestId('nav-projects').count(),0);assert.equal(await task.getByTestId('nav-tasks').count(),0);assert.equal(await task.getByTestId('nav-submissions').count(),0);assert.equal(await task.getByTestId('nav-pending').count(),0);
  await task.getByRole('heading',{name:'Submitted and outcomes'}).waitFor();
  await task.getByTestId('open-command-palette').click();assert.equal(await task.getByTestId('command-page-projects').count(),0);assert.equal(await task.getByTestId('command-page-tasks').count(),0);await task.keyboard.press('Escape');
  await task.locator('.work-task-open').first().click();await task.getByRole('heading',{name:'Raise a dependency'}).waitFor();await task.waitForFunction(()=>document.querySelectorAll('select[aria-label="Task this depends on"] option').length>1);
  await task.getByTestId('nav-mine').click();
  await task.getByTestId('nav-meetings').click();await task.getByText('Design review',{exact:false}).first().waitFor();assert.equal(await task.getByRole('button',{name:'Record meeting'}).count(),0);
  await task.locator('.meeting-list-row').first().click();await task.getByRole('heading',{name:'Minutes'}).waitFor();assert.equal(await task.getByRole('button',{name:'Edit meeting'}).count(),0);
  console.log('Issue #19 role home UI checks passed.');
}finally{await browser.close()}

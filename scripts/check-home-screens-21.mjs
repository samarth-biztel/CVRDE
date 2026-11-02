import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const waitForHome=async(page,name)=>{await page.getByRole('heading',{name,exact:true}).first().waitFor();await page.locator('.home-context-line').waitFor()};
async function login(page,username){await page.goto(origin);await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();await page.getByTestId('login-submit').click()}
try{
  const pm=await browser.newPage({viewport:{width:1440,height:900}});
  await login(pm,'pm.demo');await waitForHome(pm,'Overview');
  await pm.getByRole('heading',{name:'Engine Development Programme',exact:true}).waitFor();
  await pm.getByRole('heading',{name:/Waiting for your review/}).waitFor();
  const sections=await pm.locator('.demo-project-home > *').evaluateAll(elements=>elements.map(element=>element.textContent||''));
  assert.match(sections[0],/Develop and validate a new 1\.5 L petrol engine/);
  assert.match(sections[1],/Waiting for your review/);
  assert.match(sections[2],/At risk/);assert.match(sections[2],/Open meeting actions/);
  assert.match(sections[3],/Sub-projects/);assert.match(sections[4],/Milestones/);
  for(const title of ['Crankshaft stress analysis','Friction loss estimation','Cooling jacket design','Assemble first prototype engine'])await pm.locator('.demo-home-grid').getByText(title,{exact:true}).waitFor();
  assert.equal(await pm.locator('.demo-project-home button:disabled').count(),0);
  assert.equal((await pm.locator('.home-context-line').innerText()).trim(),'Engine Development Programme');

  const owner=await browser.newPage({viewport:{width:1440,height:900}});
  await login(owner,'scientist1.demo');await waitForHome(owner,'My sub-project');
  await owner.locator('.home-task-table tbody tr').first().waitFor();
  assert.match(await owner.locator('.home-context-line').innerText(),/Engine Development Programme › Design & Simulation/);
  assert.deepEqual(await owner.locator('.home-task-table thead th').allTextContents(),['Task','Owner','Status','Due','Action']);
  assert.match(await owner.locator('.home-task-table tbody tr').first().innerText(),/Combustion chamber CFD simulation/);
  await owner.locator('.home-task-table tbody tr').first().getByRole('button',{name:'Review'}).waitFor();
  await owner.getByRole('button',{name:'Record meeting'}).waitFor();
  assert.equal(await owner.locator('.role-home button:disabled').count(),0);
  assert.equal(await owner.getByRole('heading',{name:'Waiting for my review'}).count(),0);
  const done=owner.locator('.home-task-table tbody tr').filter({hasText:'Define engine performance targets'});
  assert.match(await done.innerText(),/Completed \d+ \w+ \d{4}/);
  assert.doesNotMatch(await done.innerText(),/overdue/i);

  const task=await browser.newPage({viewport:{width:1440,height:900}});
  await login(task,'task2.demo');await waitForHome(task,'My work');
  await task.locator('.home-task-table tbody tr').first().waitFor();
  assert.deepEqual(await task.locator('.home-task-table thead th').allTextContents(),['Task','Sub-project','Status','Due','Action']);
  assert.match(await task.locator('.home-task-table tbody tr').first().innerText(),/Cylinder head thermal analysis/);
  await task.locator('.home-task-table tbody tr').first().getByRole('button',{name:'Fix and resubmit'}).waitFor();
  assert.equal(await task.locator('.user-home').count(),0);
  assert.equal(await task.locator('.home-tasks-card button:disabled').count(),0);
  await task.getByRole('button',{name:'Sign out'}).click();
  await task.getByText('Signed out',{exact:true}).waitFor();
  await task.getByTestId('demo-scientist2-demo').click();await task.getByTestId('login-submit').click();await waitForHome(task,'My work');
  assert.equal(await task.getByText('Signed out',{exact:true}).count(),0);
  await task.getByRole('columnheader',{name:'Sub-project'}).waitFor();
  assert.equal((await task.locator('.home-context-line').innerText()).trim(),'Engine Development Programme');
  console.log('Issue #21 home screen checks passed.');
}finally{await browser.close()}

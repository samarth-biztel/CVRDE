import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
async function login(username,home){const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();await page.getByTestId('login-submit').click();await page.getByRole('heading',{name:home,exact:true}).first().waitFor();return page}
try{
  const task=await login('scientist2.demo','My work');
  await task.locator('.home-task-table thead th').first().waitFor();
  const headers=await task.locator('.home-task-table thead th').allTextContents();
  assert.deepEqual(headers,['Task','Sub-project','Status','Due date','Timing','Action']);
  const fuel=task.locator('.home-task-table tbody tr').filter({hasText:'Fuel injection system bench test'});
  await fuel.waitFor();
  const cells=fuel.locator('td');
  assert.match(await cells.nth(3).innerText(),/^\d{1,2} \w+ \d{4}$/);
  assert.match(await cells.nth(4).innerText(),/^\d+ days? overdue$/);
  assert.doesNotMatch(await cells.nth(3).innerText(),/overdue|left/);
  const cooling=task.locator('.home-task-table tbody tr').filter({hasText:'Cooling jacket design'});
  assert.match(await cooling.locator('td').nth(4).innerText(),/^\d+ days? left$/);
  await fuel.getByRole('button',{name:'Add evidence'}).click();
  await task.getByRole('heading',{name:'Fuel injection system bench test'}).waitFor();
  await task.getByRole('button',{name:'Go back'}).click();
  await task.getByRole('heading',{name:'My work',exact:true}).waitFor();
  await fuel.waitFor();
  await task.getByTestId('nav-meetings').click();
  await task.getByRole('heading',{name:'Meetings',exact:true}).first().waitFor();
  await task.getByRole('button',{name:'Go back'}).click();
  await task.getByRole('heading',{name:'My work',exact:true}).waitFor();

  const sub=await login('prototype.demo','My sub-project');
  await sub.locator('.home-task-table tbody tr').first().getByRole('button',{name:'Review'}).click();
  await sub.getByRole('heading',{name:'Review submission'}).waitFor();
  await sub.getByRole('button',{name:'Go back'}).click();
  await sub.getByRole('heading',{name:'My sub-project',exact:true}).waitFor();

  const pm=await login('pm.demo','Overview');
  await pm.getByRole('button',{name:'Project details'}).click();
  await pm.getByRole('heading',{name:'Project details',exact:true}).waitFor();
  assert.equal(await pm.getByRole('button',{name:'Back to overview'}).count(),0);
  await pm.getByRole('button',{name:'Go back'}).click();
  await pm.getByRole('heading',{name:'Overview',exact:true}).waitFor();
  await pm.getByTestId('nav-tasks').click();
  await pm.getByRole('heading',{name:'Tasks',exact:true}).first().waitFor();
  await pm.locator('.workspace-table thead th.timing-column').waitFor();
  const pmFuel=pm.locator('.workspace-table tbody tr').filter({hasText:'Fuel injection system bench test'});
  await pmFuel.waitFor();
  assert.match(await pmFuel.locator('.timing-column').innerText(),/^\d+ days? overdue$/);
  await pm.getByRole('button',{name:'Go back'}).click();
  await pm.getByRole('heading',{name:'Overview',exact:true}).waitFor();
  console.log('Compact back navigation and separate due timing checks passed.');
}finally{await browser.close()}

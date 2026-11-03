import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(origin);
  await page.getByTestId('demo-prototype-demo').click();
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-pending').waitFor();
  await page.getByTestId('nav-pending').click();
  await page.getByLabel('Decision reason for Cylinder block machining inspection').fill('Measurements verified');
  const response=page.waitForResponse(value=>value.url().includes('/api/v1/results/')&&value.url().endsWith('/review'));
  await page.getByRole('button',{name:'Sign off'}).click();
  await page.getByRole('button',{name:'Signing off…'}).waitFor();
  const decision=await response;
  assert.equal(decision.status(),200,await decision.text());
  assert.equal((await decision.json()).status,'DONE');
  await page.getByText('Submission signed off').waitFor({timeout:30000});
  await page.getByText('No submissions or requests are waiting for your decision.').waitFor({timeout:30000});
  console.log('Review sign-off check passed.');
}finally{await browser.close()}

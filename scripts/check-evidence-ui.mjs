import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const login=async name=>{const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});await page.goto(process.env.CVRDE_UI_URL||'https://localhost');await page.getByTestId('login-username').fill(name);await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');await page.getByTestId('login-submit').click();return page};
  const owner=await login('scientist2.demo');
  await owner.getByTestId('nav-tasks').click();
  await owner.locator('.workspace-table tbody tr').filter({hasText:'Thermal analysis report'}).click();
  await owner.getByRole('heading',{name:'Submission'}).waitFor();
  const submissions=owner.locator('#submission-panel .result');
  await submissions.first().getByText('Version 3').waitFor();
  assert.ok(await submissions.count()>=3);
  await submissions.first().getByRole('link',{name:'revised-report.txt'}).waitFor();
  await submissions.first().getByText(/TXT · Uploaded/).waitFor();
  await submissions.nth(1).getByRole('link',{name:'thermal_results.xlsx'}).waitFor();
  const pm=await login('pm.demo');
  await pm.getByTestId('nav-pending').click();
  const card=pm.locator('.review-card').filter({hasText:'Thermal analysis report'});
  await card.getByRole('link',{name:'revised-report.txt'}).waitFor();
  await card.getByText(/TXT · Uploaded/).waitFor();
  console.log('Evidence UI check passed: historical file versions and reviewer file metadata are visible.');
}finally{await browser.close()}

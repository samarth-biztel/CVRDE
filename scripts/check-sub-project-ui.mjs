import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const login=async username=>{
    const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
    await page.goto(process.env.CVRDE_UI_URL||'https://localhost');
    await page.getByTestId('login-username').fill(username);
    await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');
    await page.getByTestId('login-submit').click();
    await page.getByTestId('nav-projects').click();
    await page.getByRole('heading',{name:'Sub-projects'}).waitFor();
    return page;
  };
  const pm=await login('pm.demo');
  await pm.getByRole('button',{name:/Design verification/}).click();
  await pm.getByText('PM approved objective').waitFor();
  assert.equal(await pm.getByRole('button',{name:'Edit sub-project'}).count(),1);
  const owner=await login('scientist1.demo');
  await owner.getByRole('button',{name:/Design verification/}).click();
  await owner.getByText('PM approved objective').waitFor();
  assert.equal(await owner.getByRole('button',{name:'Edit sub-project'}).count(),0);
  await owner.getByRole('button',{name:'New task'}).click();
  await owner.getByRole('button',{name:'Assign task'}).waitFor();
  await owner.getByLabel('Task title').fill('UI hierarchy verification');
  await owner.getByLabel('Task owner').selectOption({label:'Demo Scientist Two'});
  const due=new Date();due.setDate(due.getDate()+5);
  await owner.locator('.sub-project-form input[name="due_date"]').fill(due.toISOString().slice(0,10));
  await owner.getByRole('button',{name:'Assign task'}).click();
  await owner.getByText('Task assigned').waitFor();
  await owner.getByRole('button',{name:'UI hierarchy verification'}).click();
  await owner.getByRole('button',{name:'Edit task'}).click();
  await owner.getByLabel('Task owner').waitFor();
  console.log('Sub-project UI check passed: PM detail editing and owner task creation, editing, and assignment.');
}finally{await browser.close()}

import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const origin=process.env.CVRDE_UI_URL||'https://biztel-ai-cvrde.vercel.app';
const out=join(process.cwd(),'docs','screenshots');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=async()=>await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const shot=async(view,name)=>{await view.screenshot({path:join(out,`demo-${name}.png`),animations:'disabled'});console.log(`Captured demo-${name}.png`)};
async function login(view,username){await view.goto(origin);await view.getByTestId(`demo-${username.replaceAll('.','-')}`).click();await view.getByTestId('login-submit').click()}
try{
  const pm=await page();await pm.goto(origin);await pm.getByTestId('demo-pm-demo').waitFor();await shot(pm,'01-login');
  await login(pm,'pm.demo');await pm.getByRole('heading',{name:'Engine Development Programme',exact:true}).waitFor();await pm.locator('.risk-table tbody tr').first().waitFor();await pm.locator('.pm-home-reviews tbody tr').first().waitFor();await shot(pm,'02-overview');
  await pm.setViewportSize({width:1600,height:900});await pm.getByTestId('nav-tasks').click();await pm.getByRole('columnheader',{name:/Reviewer/}).waitFor();await shot(pm,'03-tasks');
  await pm.setViewportSize({width:1440,height:900});await pm.getByTestId('nav-meetings').click();await pm.locator('.meeting-list-row').first().click();await pm.getByText(/Minutes recorded/).first().waitFor();await pm.locator('.meeting-action-row').filter({hasText:'Update simulation inputs'}).getByText(/Completed/).waitFor();await shot(pm,'08-meeting');
  await pm.getByTestId('nav-settings').click();await pm.getByRole('heading',{name:'Members',exact:true}).waitFor();await pm.locator('td').getByText('Sub-project owner',{exact:true}).first().waitFor();await shot(pm,'09-settings');

  const sub=await page();await login(sub,'scientist1.demo');await sub.getByRole('heading',{name:'Design & Simulation',exact:true}).waitFor();await sub.locator('.home-task-table tbody tr').first().waitFor();await shot(sub,'04-subproject');
  await sub.getByTestId('nav-pending').click();await sub.getByText('Combustion chamber CFD simulation').first().waitFor();await shot(sub,'07-review');

  const owner=await page();await login(owner,'task2.demo');await owner.getByRole('heading',{name:'My work',exact:true}).first().waitFor();await owner.locator('.home-task-table tbody tr').first().waitFor();await shot(owner,'05-my-work');
  await owner.locator('.home-task-table tbody tr').filter({hasText:'Cylinder head thermal analysis'}).first().getByRole('button',{name:'Fix and resubmit'}).click();await owner.getByRole('heading',{name:'Cylinder head thermal analysis'}).waitFor();await shot(owner,'06-task-detail');
  console.log('Current demo screenshots captured.');
}finally{await browser.close()}

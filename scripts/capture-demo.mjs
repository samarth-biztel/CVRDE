import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const demoResponse=await fetch('http://localhost:5173/api/v1/auth/demo');
if(!demoResponse.ok)throw new Error('Demo API is unavailable');
const {password}=await demoResponse.json();
const out=join(process.cwd(),'docs','screenshots');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--no-sandbox']});
async function login(page,username){await page.goto('http://localhost:5173');await page.getByLabel('Username').fill(username);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await page.getByText('PILOT DEMO').waitFor();}
async function shot(page,name){await page.screenshot({path:join(out,name+'.png')});console.log('Captured',name);}
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.goto('http://localhost:5173');await shot(page,'01-login');
  await login(page,'pm.demo');await page.getByText('Project tasks').waitFor();await shot(page,'02-pm-overview');
  await page.getByRole('button',{name:'Projects'}).click();await page.getByText('Project groups').waitFor();await shot(page,'03-projects-and-groups');
  await page.getByRole('button',{name:'Tasks'}).click();await page.getByRole('row',{name:/Thermal analysis report/}).click();await page.getByText('Task information').waitFor();await shot(page,'04-task-detail');
  await page.getByRole('button',{name:'Pending'}).click();await page.getByText('Pending my action').waitFor();await shot(page,'05-pending-actions');
  await page.getByRole('button',{name:'Reports'}).click();await page.getByRole('heading',{name:'Overdue Tasks'}).waitFor();await shot(page,'06-reports');
  const member=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});await login(member,'scientist1.demo');await member.getByRole('button',{name:'Tasks'}).click();await shot(member,'07-member-tasks');
  const reassignment=await page.evaluate(async()=>{
    const options={credentials:'include'};
    const projects=await fetch('/api/v1/projects',options).then(r=>r.json());
    const tasks=await fetch(`/api/v1/projects/${projects[0].id}/tasks`,options).then(r=>r.json());
    const users=await fetch('/api/v1/users',options).then(r=>r.json());
    const task=tasks.find(t=>t.title==='Fatigue test setup'),newOwner=users.find(u=>u.username==='scientist2.demo'),reviewer=users.find(u=>u.username==='reviewer.demo');
    const response=await fetch(`/api/v1/tasks/${task.id}/reassignments`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({new_owner_id:newOwner.id,reviewer_id:reviewer.id,reason:'Demo reviewer approval'})});
    return response.status;
  });
  if(reassignment!==201)throw new Error(`Could not create reviewer demo action: ${reassignment}`);
  const reviewer=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});await login(reviewer,'reviewer.demo');await reviewer.getByRole('button',{name:'Pending'}).click();await shot(reviewer,'08-reviewer-actions');
}finally{await browser.close();}

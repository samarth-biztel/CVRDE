import assert from 'node:assert/strict';
import {stat} from 'node:fs/promises';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const contexts=[];
const date=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
async function login(name){const ctx=await request.newContext({baseURL:origin});contexts.push(ctx);const response=await ctx.post('/api/v1/auth/login',{data:{username:name,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200,name);return ctx}
const browser=await chromium.launch({headless:true});
try{
  const pm=await login('pm.demo'),prototype=await login('prototype.demo'),nair=await login('scientist2.demo'),kulkarni=await login('task2.demo');
  const project=(await (await pm.get('/api/v1/projects')).json()).find(item=>item.name==='Engine Development Programme');assert.ok(project);
  const subs=await (await pm.get(`/api/v1/projects/${project.id}/sub-projects`)).json();
  assert.deepEqual(subs.map(item=>[item.name,item.task_done,item.task_total]),[['Design & Simulation',3,9],['Prototype Build',3,11],['Testing & Validation',0,3]]);
  assert.equal(subs.reduce((sum,item)=>sum+item.task_done,0),6);
  const build=subs[1];const tasks=await (await prototype.get(`/api/v1/sub-projects/${build.id}/tasks`)).json();assert.equal(tasks.length,11);
  const manager=await (await prototype.get('/api/v1/auth/me')).json();
  const find=title=>{const task=tasks.find(item=>item.title===title);assert.ok(task,title);return task};
  for(const [title,status,due] of [
    ['Cylinder block machining inspection','SUBMITTED',3],['Crankshaft and bearing fitment check','RETURNED',5],
    ['Fuel injection system bench test','IN_PROGRESS',-3],['Wiring harness layout for prototype','IN_PROGRESS',8],
    ['Exhaust manifold fitment','NOT_STARTED',2],['Cooling circuit assembly','NOT_STARTED',14],
    ['Prototype build quality checklist','DONE',-4]
  ]){const task=find(title);assert.equal(task.status,status);assert.equal(task.due_date.slice(0,10),date(due),title);assert.equal(task.created_by,manager.id,`${title} must be assigned by K. Menon`)}
  assert.equal(tasks.filter(task=>task.status==='DONE').length,3);
  assert.equal(tasks.filter(task=>task.status!=='DONE'&&task.due_date.slice(0,10)<date(0)).length,1);
  const fresh=['Cylinder block machining inspection','Fuel injection system bench test','Cooling circuit assembly'].map(find);
  assert.ok(fresh.every(task=>task.owner_name==='S. Nair'));
  assert.ok(['Crankshaft and bearing fitment check','Wiring harness layout for prototype','Exhaust manifold fitment','Prototype build quality checklist'].map(find).every(task=>task.owner_name==='V. Kulkarni'));
  const results=async(task,ctx)=>await (await ctx.get(`/api/v1/tasks/${task.id}/results`)).json();
  for(const [title,ctx,file,state] of [
    ['Cylinder block machining inspection',nair,'block-inspection-report.pdf','PENDING'],
    ['Crankshaft and bearing fitment check',kulkarni,'bearing-fitment-check.pdf','RETURNED'],
    ['Prototype build quality checklist',kulkarni,'build-checklist.pdf','ACCEPTED']
  ]){const task=find(title),versions=await results(task,ctx);assert.equal(versions.length,1);assert.equal(versions[0].review_status,state);assert.ok(versions[0].files.some(item=>item.name===file),file);assert.equal((await stat(`frontend/public/demo-assets/${file}`)).size<1_000_000,true);const sample=await pm.get(`/demo-assets/${file}`);assert.equal(sample.status(),200,file);assert.match(sample.headers()['content-type']||'',/application\/pdf/)}
  const block=find('Cylinder block machining inspection'),bearing=find('Crankshaft and bearing fitment check'),checklist=find('Prototype build quality checklist');
  assert.equal((await results(block,nair))[0].work_completed,'Bore and deck measurements within tolerance');
  assert.equal((await results(bearing,kulkarni))[0].review_comment,'Bearing clearance values missing for cylinders 3 and 4');
  assert.equal((await results(checklist,kulkarni))[0].reviewed_at.slice(0,10),date(-5));
  const queue=await (await prototype.get('/api/v1/me/pending-actions')).json();assert.ok(queue.some(item=>item.task_id===block.id&&item.kind==='RESULT_REVIEW'));
  const pmQueue=await (await pm.get('/api/v1/me/pending-actions')).json();assert.ok(pmQueue.some(item=>item.task_id===block.id));
  const notifications=await (await prototype.get('/api/v1/me/notifications')).json();assert.ok(notifications.some(item=>item.task_id===block.id&&item.subject==='Submitted: Cylinder block machining inspection'&&!item.read_at));
  const returned=await (await kulkarni.get('/api/v1/me/notifications')).json();assert.ok(returned.some(item=>item.task_id===bearing.id&&item.subject==='Returned: Crankshaft and bearing fitment check'&&!item.read_at));
  const risk=await (await pm.get(`/api/v1/projects/${project.id}/risk`)).json();
  for(const title of ['Fuel injection system bench test','Exhaust manifold fitment'])assert.ok(risk.tasks.some(task=>task.title===title),title);
  assert.equal(risk.tasks.find(task=>task.id===find('Fuel injection system bench test').id).last_activity_at.slice(0,10),date(-4));
  const wiring=find('Wiring harness layout for prototype');const comments=await (await kulkarni.get(`/api/v1/tasks/${wiring.id}/comments`)).json();assert.ok(comments.some(item=>item.body==='Sensor connector positions confirmed with Testing team'));
  assert.equal(risk.tasks.find(task=>task.id===wiring.id).last_activity_at.slice(0,10),date(-2));
  async function browserLogin(name,screen){const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId(`demo-${name.replaceAll('.','-')}`).click();await page.getByTestId('login-submit').click();await page.getByRole('heading',{name:screen,exact:true}).first().waitFor();return page}
  const ownerPage=await browserLogin('prototype.demo','My sub-project');await ownerPage.locator('.home-task-table tbody tr').first().getByRole('button',{name:'Review'}).waitFor();assert.match(await ownerPage.locator('.home-task-table tbody tr').first().innerText(),/Cylinder block machining inspection/);
  for(const name of ['scientist2.demo','task2.demo']){const page=await browserLogin(name,'My work');await page.getByRole('columnheader',{name:'Sub-project'}).waitFor();assert.equal((await page.locator('.home-context-line').innerText()).trim(),'Engine Development Programme')}
  console.log('Issue #22 Prototype Build seed and role UI checks passed (11 tasks, 3 done, 1 overdue, 1 review, 6 of 23 project done).');
}finally{await Promise.all(contexts.map(ctx=>ctx.dispose()));await browser.close()}

import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const browser=await chromium.launch({headless:true});
async function login(username){const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto(origin);await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();await page.getByTestId('login-submit').click();await page.locator('.sidebar nav').waitFor();return page}
async function open(page,id){await page.goto(`${origin}/?task=${id}`);await page.locator('.task-detail-v2').waitFor();await page.locator('.task-v2-header h2').waitFor()}
async function has(page,selector){return (await page.locator(selector).count())>0}
try{
  const pm=await login('pm.demo'),context=await (await pm.request.get(`${origin}/api/v1/me/context`)).json();const tasks=await (await pm.request.get(`${origin}/api/v1/projects/${context.project.id}/tasks`)).json();const id=title=>{const task=tasks.find(item=>item.title===title);assert.ok(task,title);return task.id};
  const cfd=id('Combustion chamber CFD simulation'),cooling=id('Cooling jacket design'),done=id('Define engine performance targets'),returned=id('Cylinder head thermal analysis'),notStarted=id('Friction loss estimation');
  const owner=await login('scientist2.demo');await open(owner,cooling);
  assert.equal(await owner.locator('.task-v2-breadcrumb').count(),1);assert.equal(await owner.locator('.top .page-breadcrumb').count(),0);assert.equal(await owner.locator('.top h1').count(),0);
  assert.ok(await has(owner,'.task-v2-work'));assert.equal(await owner.getByRole('button',{name:'Submit for review'}).count(),1);assert.equal(await owner.getByRole('textbox',{name:'Why did progress change?'}).count(),0);
  await owner.getByRole('button',{name:'Update',exact:true}).click();assert.equal(await owner.getByRole('textbox',{name:'Why did progress change?'}).count(),1);
  await open(owner,cfd);assert.ok((await owner.locator('.notice.info').innerText()).includes('Waiting for review by'));assert.equal(await owner.locator('.task-v2-work').count(),0);assert.equal(await owner.getByRole('button',{name:'Submit for review'}).count(),0);assert.equal(await owner.getByRole('button',{name:'More task actions'}).count(),0);
  await open(owner,done);assert.match(await owner.locator('.task-v2-facts').innerText(),/Completed/);assert.doesNotMatch(await owner.locator('.task-v2-facts').innerText(),/overdue/);assert.equal(await owner.locator('.task-v2-work').count(),0);
  const reviewer=await login('scientist1.demo');await open(reviewer,cfd);await reviewer.locator('.task-v2-review').waitFor();assert.equal(await reviewer.locator('.task-v2-work').count(),0);assert.equal(await reviewer.getByRole('button',{name:'More task actions'}).count(),0);assert.equal(await reviewer.getByRole('button',{name:'Return'}).isDisabled(),true);assert.equal(await reviewer.locator('.task-v2-review .standard-file-row').count(),1);assert.equal(await reviewer.locator('.task-v2-submissions .standard-file-row').count(),0);
  assert.match(await reviewer.locator('.task-v2-review .standard-file-row').innerText(),/Uploaded by .* · \d{1,2} \w{3} 2026/);assert.equal(await reviewer.locator('.task-v2-history details').getAttribute('open'),null);
  await open(reviewer,cooling);assert.equal(await reviewer.locator('.task-v2-review').count(),0);await reviewer.getByRole('button',{name:'More task actions'}).click();assert.equal(await reviewer.getByRole('button',{name:'Edit task'}).count(),1);assert.equal(await reviewer.getByRole('button',{name:'Flag at risk'}).count(),0);
  await open(pm,cfd);await pm.locator('.task-v2-review').waitFor();assert.equal(await pm.locator('.task-v2-work').count(),0);await open(pm,done);assert.equal(await pm.getByRole('button',{name:'More task actions'}).count(),0);
  const worker=await login('task2.demo');await open(worker,returned);assert.match(await worker.locator('.returned-banner').innerText(),/Boundary conditions/);assert.equal(await worker.getByRole('button',{name:'Submit for review'}).count(),1);
  await open(worker,notStarted);assert.equal(await worker.getByRole('button',{name:'Start task'}).count(),1);assert.equal(await worker.getByRole('button',{name:'Submit for review'}).count(),0);
  for(const page of [owner,reviewer,pm,worker]){const section=page.locator('.task-detail-v2 > section').last();assert.match(await section.getAttribute('class'),/task-v2-history/);assert.equal(await page.getByText('Document key',{exact:true}).count(),0)}
  console.log('Issue #20 task detail role/state browser matrix passed.');
}finally{await browser.close()}

import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const password='CVRDE-Demo-2026!';
const browser=await chromium.launch({headless:true});
async function login(page,name){await page.goto(origin);await page.getByTestId(`demo-${name.replaceAll('.','-')}`).click();await page.getByTestId('login-submit').click();await page.getByTestId('nav-notifications').waitFor()}
async function apiAs(name){const context=await request.newContext({baseURL:origin});const response=await context.post('/api/v1/auth/login',{data:{username:name,password}});assert.equal(response.status(),200,name);return context}
try{
  const owner=await apiAs('task2.demo'),reviewer=await apiAs('prototype.demo');
  const ownerCounts=await (await owner.get('/api/v1/me/notifications/counts')).json();
  assert.ok(ownerCounts.total>=2);
  const returned=await (await owner.get('/api/v1/me/notifications?type=Returned&limit=51')).json();
  assert.ok(returned.some(item=>item.task_title==='Crankshaft and bearing fitment check'&&item.body==='Bearing clearance values missing for cylinders 3 and 4'));
  assert.ok(returned.every(item=>item.category==='Returned'));
  const other=await (await reviewer.get('/api/v1/me/notifications?limit=51')).json();
  assert.ok(other.some(item=>item.task_title==='Cylinder block machining inspection'));
  assert.ok(!other.some(item=>item.task_title==='Crankshaft and bearing fitment check'));
  const foreign=await reviewer.post(`/api/v1/me/notifications/${returned[0].id}/read`,{data:{}});
  assert.equal(foreign.status(),404,'A user cannot mark another user’s notification read');
  const page1=await (await owner.get('/api/v1/me/notifications?limit=2')).json();
  const page2=await (await owner.get('/api/v1/me/notifications?limit=2&offset=2')).json();
  assert.equal(page2.length,2);assert.notEqual(page2[0].id,page1[0].id);
  await owner.dispose();await reviewer.dispose();

  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await login(page,'task2.demo');
  await page.getByTestId('nav-notifications').click();
  await page.getByTestId('notification-centre').waitFor();
  await page.getByText('Bearing clearance values missing for cylinders 3 and 4').first().waitFor();
  const rows=page.locator('.notification-history-row');
  assert.ok(await rows.count()>0);
  await page.getByRole('button',{name:'Unread',exact:false}).first().click();
  await page.getByTestId('notification-centre').waitFor();
  await page.getByRole('button',{name:'All',exact:true}).first().click();
  await page.getByLabel('Event type').selectOption('Returned');
  await rows.first().waitFor();
  assert.ok(await rows.count()>0);
  assert.ok((await rows.allTextContents()).every(value=>/returned/i.test(value)));
  await page.getByLabel('Event type').selectOption('');
  const selected=rows.filter({hasText:'Crankshaft and bearing fitment check'}).first();
  await selected.click();
  await page.getByRole('heading',{name:'Crankshaft and bearing fitment check'}).waitFor();
  await page.getByTestId('nav-notifications').click();
  const readRow=rows.filter({hasText:'Crankshaft and bearing fitment check'}).first();
  await readRow.waitFor();assert.equal(await readRow.evaluate(el=>el.classList.contains('unread')),false);
  const unavailable=rows.filter({hasText:'Result returned: Cylinder head thermal analysis'}).first();
  if(await unavailable.count()){await unavailable.click();await page.getByText('You no longer have access to this item').waitFor()}
  const sub=await browser.newPage({viewport:{width:1440,height:900}});
  await login(sub,'scientist1.demo');await sub.getByTestId('nav-notifications').click();
  await sub.getByTestId('notification-centre').waitFor();
  await sub.getByRole('button',{name:'Load more'}).waitFor();
  assert.equal(await sub.locator('.notification-history-row').count(),50);
  await sub.getByRole('button',{name:'Load more'}).click();
  await sub.waitForFunction(()=>document.querySelectorAll('.notification-history-row').length>50);
  await sub.getByLabel('Event type').selectOption('Action item');
  await sub.locator('.notification-history-row').filter({hasText:'Update simulation inputs with revised targets'}).first().click();
  await sub.locator('.meeting-detail').waitFor();
  await sub.getByTestId('nav-notifications').click();
  await sub.getByRole('button',{name:'Mark all as read'}).first().click();
  await sub.getByRole('button',{name:/Notifications, 0 unread/}).waitFor();
  await sub.locator('.notification-view-tabs button').nth(1).click();
  await sub.waitForFunction(()=>document.querySelectorAll('.notification-view-tabs button')[1]?.getAttribute('aria-pressed')==='true');
  try{await sub.getByText('No notifications match this view.').waitFor({timeout:30000})}catch(error){console.log('Unread view state:',await sub.locator('.notification-view-tabs button').evaluateAll(es=>es.map(e=>[e.textContent,e.getAttribute('aria-pressed')])),(await sub.locator('main').innerText()).slice(-600));throw error}
  await sub.getByRole('button',{name:'All',exact:true}).first().click();
  await sub.locator('.notification-history-row').first().waitFor();
  await sub.getByRole('button',{name:/Notifications, 0 unread/}).click();
  await sub.getByText('All caught up').waitFor();
  assert.equal(await sub.getByText('No notifications yet').count(),0);
  assert.equal(await sub.locator('.notification-popover .notification-history-row').count(),10);
  await sub.getByRole('button',{name:'View all notifications'}).click();
  await sub.getByTestId('notification-centre').waitFor();
  console.log('Issue #25 notification centre checks passed.');
}finally{await browser.close()}

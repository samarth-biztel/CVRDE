import assert from 'node:assert/strict';
import {readFile, mkdir, unlink} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {request, chromium} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'https://localhost';
const recording=process.env.CVRDE_RECORD_DEMO==='1';
const contexts=[];
const today=new Date().toISOString().slice(0,10);
const due=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
const api=(ctx,path,method='get',data)=>ctx[method]('/api/v1'+path,data===undefined?{}:{data});
async function checked(response,status,label){assert.equal(response.status(),status,`${label}: ${await response.text()}`);return response.json()}
async function login(username){const ctx=await request.newContext({baseURL:origin,ignoreHTTPSErrors:true});contexts.push(ctx);const user=await checked(await api(ctx,'/auth/login','post',{username,password:'CVRDE-Demo-2026!'}),200,`Login ${username}`);return {ctx,user}}
let browser,browserContext,page,video;
async function show(username,label,screen='overview'){
  if(!recording)return;
  if(!page){browser=await chromium.launch({headless:true});browserContext=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:resolve('demo/recordings'),size:{width:1440,height:900}},ignoreHTTPSErrors:true});page=await browserContext.newPage();video=page.video();}
  await page.goto(origin);
  await page.waitForFunction(() => !!document.querySelector('[aria-label="Sign out"]') || !!document.querySelector('[data-testid^="demo-"]'));
  const logout=page.getByRole('button',{name:'Sign out'});
  if(await logout.isVisible())await logout.click();
  await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();
  await page.getByTestId('login-submit').click();
  await page.getByTestId(`nav-${screen}`).waitFor({timeout:20000});
  if(screen!=='overview'&&screen!=='mine')await page.getByTestId(`nav-${screen}`).click();
  await page.waitForTimeout(1200);
  await page.evaluate(text=>{const node=document.createElement('div');node.textContent=text;node.style.cssText='position:fixed;bottom:18px;left:18px;z-index:9999;background:#102a43;color:white;padding:12px 18px;border-radius:8px;font:600 18px Arial;box-shadow:0 8px 24px #0004';document.body.append(node)},label);
  await page.waitForTimeout(1800);
}
try{
  if(recording)await mkdir(resolve('demo/recordings'),{recursive:true});
  const pm=await login('pm.demo'),sub=await login('scientist1.demo'),owner=await login('scientist2.demo');
  const project=(await checked(await api(pm.ctx,'/projects'),200,'Projects')).find(p=>p.name==='Engine Development Programme');assert.ok(project);
  const design=(await checked(await api(pm.ctx,`/projects/${project.id}/sub-projects`),200,'Sub-projects')).find(s=>s.name==='Design & Simulation');assert.ok(design);
  const initial=design.task_done;
  await show('pm.demo','1. PM sees three sub-projects at different stages');
  const task=await checked(await api(sub.ctx,`/projects/${project.id}/tasks`,'post',{sub_project_id:design.id,title:'Valve train kinematics simulation',description:'Simulate valve timing for the fictional engine programme.',expected_deliverables:'Simulation report and assumptions',owner_id:owner.user.id,due_date:due,priority:'HIGH'}),201,'Create task');
  await show('scientist1.demo','2. Sub-project owner assigns a task to S. Nair','tasks');
  await checked(await api(owner.ctx,`/tasks/${task.id}/status`,'post',{}),200,'Start task');
  const report=await readFile(resolve('frontend/public/demo-files/combustion-cfd-report.pdf'));
  const firstFile=await checked(await owner.ctx.post(`/api/v1/tasks/${task.id}/attachments`,{multipart:{document_key:'valve-train-report',file:{name:'combustion-cfd-report.pdf',mimeType:'application/pdf',buffer:report}}}),201,'Upload report');
  const first=await checked(await api(owner.ctx,`/tasks/${task.id}/results`,'post',{work_completed:'Completed initial valve train simulation',outcome:'Initial results ready for review',attachment_ids:[firstFile.id]}),201,'Submit result');
  await show('scientist2.demo','3. Task owner submits a simulation report','tasks');
  assert.ok((await checked(await api(sub.ctx,'/me/pending-actions'),200,'Review queue')).some(x=>x.task_id===task.id));
  await show('scientist1.demo','4. Sub-project owner reviews and returns the result','pending');
  await checked(await api(sub.ctx,`/results/${first.id}/review`,'post',{accept:false,comment:'Please correct the valve timing assumptions and resubmit.'}),200,'Return result');
  const returned=(await checked(await api(owner.ctx,`/me/work?project_id=${project.id}`),200,'My work')).tasks.find(x=>x.id===task.id);
  assert.equal(returned.status,'RETURNED');assert.match(returned.return_reason,/valve timing assumptions/);
  assert.ok((await checked(await api(owner.ctx,'/me/notifications'),200,'Notifications')).some(x=>x.task_id===task.id&&x.event_type==='RETURNED'));
  await show('scientist2.demo','5. Returned reason and notification reach S. Nair','mine');
  const revision=await readFile(resolve('frontend/public/demo-files/revised-cfd-report.pdf'));
  const revisedFile=await checked(await owner.ctx.post(`/api/v1/tasks/${task.id}/attachments`,{multipart:{document_key:'valve-train-revision',file:{name:'revised-cfd-report.pdf',mimeType:'application/pdf',buffer:revision}}}),201,'Upload revision');
  const second=await checked(await api(owner.ctx,`/tasks/${task.id}/results`,'post',{work_completed:'Corrected valve timing assumptions and reran simulation',outcome:'Revised report ready for sign-off',attachment_ids:[revisedFile.id]}),201,'Resubmit');
  await show('scientist2.demo','6. Corrected report is resubmitted','tasks');
  await checked(await api(sub.ctx,`/results/${second.id}/review`,'post',{accept:true,comment:'Simulation evidence accepted.'}),200,'Accept result');
  const updated=await checked(await api(pm.ctx,`/sub-projects/${design.id}`),200,'Progress');
  assert.equal(updated.task_done,initial+1);
  await show('pm.demo','7. Sign-off updates Design & Simulation progress');
  const meeting=await checked(await api(pm.ctx,`/projects/${project.id}/meetings`,'post',{title:'Valve train review',meeting_date:today,sub_project_id:design.id,minutes:'Reviewed the accepted valve train simulation. Share the revised timing assumptions with Prototype Build.',attendee_ids:[pm.user.id,sub.user.id,owner.user.id],actions:[{description:'Share revised valve timing assumptions with Prototype Build',owner_id:sub.user.id,due_date:due}]}),201,'Record meeting');
  const detail=await checked(await api(pm.ctx,`/meetings/${meeting.id}`),200,'Meeting detail');
  assert.equal(detail.actions.length,1);
  await show('pm.demo','8. PM records a review meeting and action item','projects');
  console.log(`Hosted demo story passed at ${origin}: task ${task.id}, return, notification, resubmission, sign-off, progress, and meeting ${meeting.id}.`);
}finally{
  if(browserContext){await browserContext.close();await video.saveAs(resolve('demo/recordings/cvrde-walkthrough.webm'));const raw=await video.path();if(raw.startsWith(resolve('demo/recordings')+sep))await unlink(raw);await browser.close();console.log('Backup recording saved: demo/recordings/cvrde-walkthrough.webm');}
  await Promise.all(contexts.map(ctx=>ctx.dispose()));
}

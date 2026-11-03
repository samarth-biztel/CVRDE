import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const phase=process.env.CVRDE_VISUAL_PHASE||'after';
if(!['before','after'].includes(phase))throw new Error('CVRDE_VISUAL_PHASE must be before or after');
const out=join(process.cwd(),'docs','visual-26',phase);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const shot=async(page,name,mode)=>{await page.screenshot({path:join(out,`${name}-${mode}.png`),animations:'disabled'});console.log(`${phase}/${name}-${mode}.png`)};
async function login(name,mode){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.addInitScript(value=>localStorage.setItem('cvrde-theme',value),mode);
  await page.goto(origin);
  await page.getByTestId(`demo-${name.replaceAll('.','-')}`).click();
  await page.getByTestId('login-submit').click();
  return page;
}
try{
  for(const mode of ['light','dark']){
    const pm=await login('pm.demo',mode);
    await pm.getByRole('heading',{name:'Engine Development Programme',exact:true}).waitFor();
    await pm.locator('.demo-subproject-grid .sub-project-overview-row').first().waitFor();
    await shot(pm,'overview',mode);await pm.close();

    const sub=await login('scientist1.demo',mode);
    await sub.locator('.home-task-table tbody tr').first().waitFor();
    await shot(sub,'my-sub-project',mode);
    await sub.getByTestId('nav-pending').click();
    await sub.locator('.review-card').first().waitFor();
    await shot(sub,'review',mode);
    await sub.getByTestId('nav-notifications').click();
    await sub.locator('.notification-history-row').first().waitFor();
    await shot(sub,'notifications',mode);await sub.close();

    const owner=await login('task2.demo',mode);
    await owner.locator('.home-task-table tbody tr').first().waitFor();
    await shot(owner,'my-work',mode);
    await owner.locator('.home-task-table tbody tr').filter({hasText:'Cylinder head thermal analysis'}).first().getByRole('button',{name:'Fix and resubmit'}).click();
    await owner.getByRole('heading',{name:'Cylinder head thermal analysis'}).waitFor();
    await shot(owner,'task',mode);await owner.close();
  }
}finally{await browser.close()}

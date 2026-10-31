import {writeFile} from 'node:fs/promises';
import {mailContent} from '../backend/dist/email.js';

process.env.PUBLIC_APP_URL='https://biztel-ai-cvrde.vercel.app';
const sample={eventType:'RETURNED',projectName:'Engine Development Programme',taskTitle:'Valve train kinematics simulation',taskId:42,recipientEmail:'demo@example.invalid',actorName:'A. Iyer',detail:'Please correct the valve timing assumptions and resubmit the revised report.',meetingTitle:null};
const file='docs/email-preview.html';
await writeFile(file,mailContent(sample).html);
console.log(`Preview generated: ${file}`);
if(process.env.CVRDE_EMAIL_SCREENSHOT==='1'){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage({viewport:{width:760,height:700},deviceScaleFactor:1});await page.goto(new URL(`../${file}`,import.meta.url).href);await page.screenshot({path:'docs/email-preview.png',fullPage:true});console.log('Screenshot generated: docs/email-preview.png')}
  finally{await browser.close()}
}
if(process.env.CVRDE_SEND_EMAIL_PREVIEW==='1'){
  await import('../backend/dist/env.js');
  const {db,one,pool}=await import('../backend/dist/db.js');
  const {sendNotificationEmail}=await import('../backend/dist/email.js');
  try{
    const task=await one(db,"SELECT id FROM tasks WHERE title='Cylinder head thermal analysis' ORDER BY id DESC LIMIT 1");
    if(!task)throw new Error('Reset the fictional demo project before sending the preview');
    await sendNotificationEmail({...sample,taskId:task.id,taskTitle:'Cylinder head thermal analysis',detail:'Please correct the boundary conditions and resubmit the updated analysis.'});
    console.log('Preview email submitted to Resend for the configured team inbox');
  }finally{await pool.end()}
}

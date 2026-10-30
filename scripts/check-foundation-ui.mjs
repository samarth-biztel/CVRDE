import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const baseUrl=process.env.CVRDE_UI_URL||'http://localhost:5173';
try{
  for(const [username,taskTitle,mode] of [
    ['pm.demo','Material sample testing','manager'],
    ['scientist1.demo','Material sample testing','owner'],
    ['scientist2.demo','Material sample testing','viewer']
  ]){
    const page=await browser.newPage({viewport:{width:1440,height:900},ignoreHTTPSErrors:true});
    const external=[],localFonts=[];
    page.on('request',req=>{const url=new URL(req.url());if(!['localhost','127.0.0.1'].includes(url.hostname))external.push(req.url());if(url.pathname.endsWith('.woff2'))localFonts.push(req.url())});
    await page.goto(baseUrl);
    await page.getByTestId('login-username').fill(username);
    await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');
    await page.getByTestId('login-submit').click();
    await page.locator('.sidebar-project select').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(localFonts.length>0,`${username} did not load a bundled font`);
    if(mode==='owner'){
      const bell=page.getByRole('button',{name:/Notifications, [1-9]/});
      await bell.waitFor();
      await bell.click();
      await page.locator('.notification-row').filter({hasText:'New comment'}).first().click();
    }else{
      await page.getByRole('button',{name:'Tasks',exact:true}).first().click();
      await page.getByRole('button',{name:taskTitle,exact:true}).first().click();
    }
    await page.getByRole('heading',{name:taskTitle,exact:true}).waitFor();
    for(const title of ['Description and expected deliverables','Prerequisites','Subtasks and progress','Activity','Files','Submission'])
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
    assert.equal(await page.locator('select[aria-label="Task status"]').count(),0);
    if(mode==='manager'){
      assert.equal(await page.getByRole('button',{name:'Edit task'}).count(),1);
      await page.getByLabel('Comment', {exact:true}).fill('Please review @scientist1.demo');
      await page.getByRole('button',{name:'Add comment'}).click();
      await page.getByText('Please review @scientist1.demo').waitFor();
    }
    if(mode==='owner'){
      assert.equal(await page.getByRole('button',{name:'Update progress'}).count(),1);
      await page.locator('.upload-dropzone').waitFor();
      const file={name:'foundation-check.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n')};
      await page.getByLabel('Choose file').setInputFiles(file);
      await page.getByRole('button',{name:'Remove',exact:true}).click();
      assert.equal(await page.getByLabel('Choose file').inputValue(),'');
      await page.getByLabel('Choose file').setInputFiles(file);
      await page.getByLabel('Document key').fill('foundation-check');
      await page.getByRole('button',{name:'Upload file'}).click();
      await page.getByTestId('upload-success').waitFor();
      await page.getByRole('button',{name:'Remove foundation-check.pdf'}).click();
      await page.getByRole('button',{name:'Remove foundation-check.pdf'}).waitFor({state:'detached'});
    }
    if(mode==='viewer'){
      assert.equal(await page.getByRole('button',{name:'Update progress'}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Upload file'}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Add comment'}).count(),1);
      assert.equal(await page.getByRole('button',{name:'Review'}).count(),0);
    }
    assert.deepEqual(external,[],`${username} made external requests`);
    await page.close();
  }
  console.log('Foundation UI checks passed for manager, owner, and shared viewer; no external requests.');
}finally{await browser.close()}

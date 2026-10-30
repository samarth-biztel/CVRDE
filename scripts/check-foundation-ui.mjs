import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  for(const [username,taskTitle,mode] of [
    ['pm.demo','Material sample testing','manager'],
    ['scientist1.demo','Material sample testing','owner'],
    ['scientist2.demo','Material sample testing','viewer']
  ]){
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const external=[];
    page.on('request',req=>{if(!['localhost','127.0.0.1'].includes(new URL(req.url()).hostname))external.push(req.url())});
    await page.goto('http://localhost:5173');
    await page.getByTestId('login-username').fill(username);
    await page.getByTestId('login-password').fill('CVRDE-Demo-2026!');
    await page.getByTestId('login-submit').click();
    await page.locator('.sidebar-project select').waitFor();
    await page.getByRole('button',{name:'Tasks',exact:true}).first().click();
    await page.getByRole('button',{name:taskTitle,exact:true}).first().click();
    await page.getByRole('heading',{name:taskTitle,exact:true}).waitFor();
    for(const title of ['Description and expected deliverables','Prerequisites','Subtasks and progress','Activity','Files','Submission'])
      await page.getByRole('heading',{name:title,exact:true}).waitFor();
    assert.equal(await page.locator('select[aria-label="Task status"]').count(),0);
    if(mode==='manager')assert.equal(await page.getByRole('button',{name:'Edit task'}).count(),1);
    if(mode==='owner')assert.equal(await page.getByRole('button',{name:'Update progress'}).count(),1);
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

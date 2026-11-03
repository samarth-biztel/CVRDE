import {chromium} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const browser=await chromium.launch({headless:true});
const rgb=value=>value.match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number)||[];
const light=value=>{const channels=rgb(value).map(channel=>{const x=channel/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4});return 0.2126*channels[0]+0.7152*channels[1]+0.0722*channels[2]};
const contrast=(a,b)=>{const [higher,lower]=[light(a),light(b)].sort((x,y)=>y-x);return (higher+0.05)/(lower+0.05)};
const checks=[['Sidebar text','.sidebar nav button.active'],['Summary tile','.summary-tile']];
try{
  for(const mode of ['light','dark']){
    const page=await browser.newPage();
    await page.addInitScript(value=>localStorage.setItem('cvrde-theme',value),mode);
    await page.goto(origin);
    await page.getByTestId('demo-pm-demo').click();
    await page.getByTestId('login-submit').click();
    await page.locator('.summary-tile').first().waitFor();
    const link=page.locator('.biztel-wordmark');
    if(await link.getAttribute('href')!=='https://www.biztel.ai/')throw new Error('BiztelAI link incorrect');
    for(const [name,selector] of checks){
      const element=page.locator(selector).first();
      if(!await element.count())continue;
      const colors=await element.evaluate(node=>{const style=getComputedStyle(node);return [style.color,style.backgroundColor]});
      const ratio=contrast(...colors);
      if(ratio<4.5)throw new Error(`${mode} ${name} contrast ${ratio.toFixed(2)} < 4.5`);
      console.log(`${mode} ${name}: ${ratio.toFixed(2)}:1`);
    }
    for(const [tile,filter] of [['At risk','risk'],['In progress','inprogress'],['Done','done'],['Waiting for review','waiting']]){
      const button=page.getByRole('button',{name:new RegExp(`^${tile}`)}).first();
      const expected=Number((await button.locator('strong').innerText()).match(/^\d+/)?.[0]||0);
      await button.click();
      await page.getByRole('heading',{name:new RegExp(`Showing ${filter} tasks`)}).waitFor();
      if(expected)await page.waitForFunction(count=>document.querySelectorAll('.workspace-table tbody tr').length===count,expected,{timeout:10000});
      const actual=await page.locator('.workspace-table tbody tr').count();
      if(actual!==expected)throw new Error(`${mode} ${tile}: tile ${expected}, table ${actual}`);
      console.log(`${mode} ${tile}: ${actual} matching tasks`);
      await page.getByTestId('nav-overview').click();
      await page.locator('.summary-tile').first().waitFor();
    }
    await page.getByTestId('nav-tasks').click();
    await page.locator('.workspace-table').first().waitFor();
    for(const [name,selector] of [['Primary button','.primary'],['Status pill','.pill']]){
      const colors=await page.locator(selector).first().evaluate(node=>{const style=getComputedStyle(node);return [style.color,style.backgroundColor]});
      const ratio=contrast(...colors);
      if(ratio<4.5)throw new Error(`${mode} ${name} contrast ${ratio.toFixed(2)} < 4.5`);
      console.log(`${mode} ${name}: ${ratio.toFixed(2)}:1`);
    }
    await page.close();
  }
}finally{await browser.close()}

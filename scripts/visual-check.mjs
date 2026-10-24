import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.goto('http://localhost:5173');
  await page.getByText('Explore as a demo user').waitFor();
  await page.locator('.demo-logins code').evaluate(element=>{element.textContent='••••••••••••';});
  await page.screenshot({path:'docs/screenshots/09-vercel-login.png',fullPage:true});
  await page.getByRole('button',{name:/Project Manager pm.demo/}).click();
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByRole('heading',{name:'Overview'}).waitFor();
  await page.getByText('Final evidence package').waitFor();
  await page.getByText('Total tasks').waitFor();
  await page.getByText('17',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.stat:last-child strong')?.textContent!=='…');
  await page.screenshot({path:'docs/screenshots/10-premium-overview.png',fullPage:true});
  const topBefore=await page.locator('.sidebar').evaluate(element=>element.getBoundingClientRect().top);
  await page.evaluate(()=>window.scrollTo(0,700));
  const topAfter=await page.locator('.sidebar').evaluate(element=>element.getBoundingClientRect().top);
  if(topBefore!==topAfter)throw new Error('Sidebar moved with page content');
  await page.getByRole('button',{name:'Collapse sidebar'}).click();
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.scrollTo(0,0));
  const width=await page.locator('.sidebar').evaluate(element=>element.getBoundingClientRect().width);
  if(width>90)throw new Error(`Collapsed sidebar is too wide: ${width}px`);
  await page.screenshot({path:'docs/screenshots/11-collapsed-sidebar.png',fullPage:true});
  console.log('Visual check passed: demo login, overview, collapsible sidebar.');
}finally{await browser.close();}

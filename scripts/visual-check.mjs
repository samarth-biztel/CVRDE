import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.goto('http://localhost:5173');
  await page.getByText('Explore as a demo user').waitFor();
  await page.getByText('Shared demo password:').waitFor();
  const loginOverflow=await page.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
  if(loginOverflow>1)throw new Error(`Login page scrolls by ${loginOverflow}px at desktop size`);
  if((await page.getByTestId('login-toggle-theme').textContent())?.trim())throw new Error('Login theme toggle contains wording');
  await page.locator('.demo-logins code').evaluate(element=>{element.textContent='************';});
  await page.screenshot({path:'docs/screenshots/09-vercel-login.png',fullPage:true});
  for(const height of [844,667]){
    const mobile=await browser.newPage({viewport:{width:390,height},deviceScaleFactor:1});
    await mobile.goto('http://localhost:5173');
    await mobile.getByText('Explore as a demo user').waitFor();
    const mobileOverflow=await mobile.evaluate(()=>document.documentElement.scrollHeight-window.innerHeight);
    if(mobileOverflow>1)throw new Error(`Login page scrolls by ${mobileOverflow}px at 390×${height}`);
    if(height===667){
      await mobile.locator('.demo-logins code').evaluate(element=>{element.textContent='************';});
      await mobile.screenshot({path:'docs/screenshots/14-mobile-login.png'});
    }
    await mobile.close();
  }
  const outage=await browser.newPage({viewport:{width:1280,height:800}});
  await outage.route('**/api/v1/**',route=>route.fulfill({status:500,body:'API unavailable'}));
  await outage.goto('http://localhost:5173');
  await outage.getByText('Shared demo password:').waitFor();
  await outage.getByTestId('demo-pm-demo').click();
  if(await outage.getByTestId('login-username').inputValue()!=='pm.demo')throw new Error('Demo username was not filled during an API outage');
  if(await outage.getByTestId('login-password').inputValue()!=='CVRDE-Demo-2026!')throw new Error('Public demo password was not filled during an API outage');
  await outage.close();
  await page.getByRole('button',{name:/Project Manager pm.demo/}).click();
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.getByRole('heading',{name:'Overview'}).waitFor();
  await page.getByText('Final evidence package').waitFor();
  await page.getByText('Total tasks').waitFor();
  await page.getByText('17',{exact:true}).waitFor();
  await page.waitForFunction(()=>/^\d+$/.test(document.querySelector('.stat:last-child strong')?.textContent?.trim() || ''));
  await page.locator('.bento-row').first().waitFor();
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
  await page.getByRole('button',{name:'Expand sidebar'}).click();
  await page.keyboard.press('Control+k');
  const palette=page.getByTestId('command-palette');
  await palette.waitFor();
  await page.getByTestId('command-search-input').fill('Thermal analysis');
  await palette.getByText('Thermal analysis report').waitFor();
  await page.screenshot({path:'docs/screenshots/12-command-palette.png'});
  await page.keyboard.press('Escape');
  if((await page.getByTestId('toggle-theme').textContent())?.trim())throw new Error('Dashboard theme toggle contains wording');
  const themeButton=await page.getByTestId('toggle-theme').boundingBox();
  await page.evaluate(()=>{
    const original=document.documentElement.animate.bind(document.documentElement);
    document.documentElement.animate=(frames,options)=>{
      if(options?.pseudoElement==='::view-transition-new(root)')window.__themeReveal={frames,options};
      return original(frames,options);
    };
  });
  await page.getByTestId('toggle-theme').click();
  await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.waitForFunction(()=>window.__themeReveal);
  const reveal=await page.evaluate(()=>window.__themeReveal.frames.clipPath[0]);
  const origin=/circle\(0px at ([\d.]+)px ([\d.]+)px\)/.exec(reveal);
  if(!origin||Math.abs(Number(origin[1])-(themeButton.x+themeButton.width/2))>1||Math.abs(Number(origin[2])-(themeButton.y+themeButton.height/2))>1)throw new Error('Theme reveal did not start at the theme icon');
  await page.waitForTimeout(350);
  await page.screenshot({path:'docs/screenshots/13-dark-overview.png'});
  const missing=await page.locator('button,input,select,textarea,a[href]').evaluateAll(elements=>elements.filter(element=>!element.hasAttribute('data-testid')).length);
  if(missing)throw new Error(`${missing} interactive controls lack data-testid`);
  console.log('Visual check passed: login, fixed sidebar, search palette, dark mode, and test IDs.');
}finally{await browser.close();}

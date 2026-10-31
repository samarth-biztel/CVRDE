import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origins=['https://biztel-ai-cvrde.vercel.app','https://cvrde-five.vercel.app'];
const browser=await chromium.launch({headless:true});
try{
  for(const origin of origins){
    const context=await browser.newContext({ignoreHTTPSErrors:true});
    try{
      const page=await context.newPage();await page.goto(origin);
      await page.getByTestId('demo-pm-demo').click();await page.getByTestId('login-submit').click();
      await page.getByTestId('nav-overview').waitFor();
      await page.getByText('Sub-project progress',{exact:true}).waitFor();
      assert.equal(await page.getByText('PILOT DEMO',{exact:true}).count(),0);
      await page.getByTestId('nav-projects').click();
      await page.getByText('Design & Simulation',{exact:true}).first().click();
      await page.getByText('Sub-projects',{exact:true}).first().waitFor();
      const project=(await (await context.request.get(`${origin}/api/v1/projects`)).json()).find(item=>item.name==='Engine Development Programme');assert.ok(project);
      const subProjects=await (await context.request.get(`${origin}/api/v1/projects/${project.id}/sub-projects`)).json();assert.ok(subProjects.some(item=>item.name==='Design & Simulation'&&item.objective));
      console.log(`${origin}: login, PM Overview, demo label, project details, and sub-project Objective API passed`);
    }finally{await context.close()}
  }
}finally{await browser.close()}

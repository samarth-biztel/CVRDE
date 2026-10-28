import {chromium} from 'playwright';

const base='http://localhost:5173';
const browser=await chromium.launch({headless:true});
async function login(page,username){
  await page.goto(base);
  await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-tasks').waitFor();
}
async function checkUpload(page,card,routePattern,buttonLabel){
  let succeed=true;
  await page.route(routePattern,route=>{
    if(route.request().method()!=='POST')return route.continue();
    return route.fulfill({status:succeed?201:400,contentType:'application/json',body:JSON.stringify(succeed?{id:999}:{error:'Upload rejected'})});
  });
  await card.getByLabel('Document key').fill('upload-check');
  await card.getByLabel('Choose file').setInputFiles({name:'approved-evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\napproved')});
  await card.getByRole('button',{name:buttonLabel}).click();
  const success=card.getByTestId('upload-success');
  await success.waitFor();
  if(!await success.getByText('approved-evidence.pdf').count())throw new Error('Uploaded filename is missing');
  const color=await success.locator('.upload-tick').evaluate(element=>getComputedStyle(element).color);
  if(color!=='rgb(21, 128, 61)')throw new Error(`Success tick is not green: ${color}`);

  succeed=false;
  await card.getByLabel('Document key').fill('upload-check-fail');
  await card.getByLabel('Choose file').setInputFiles({name:'rejected-evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nrejected')});
  await card.getByRole('button',{name:buttonLabel}).click();
  await card.getByTestId('upload-error').getByText('Upload rejected').waitFor();
  if(await success.count())throw new Error('Success tick remains after failed upload');
}
try{
  const pm=await browser.newPage();
  await login(pm,'pm.demo');
  await pm.getByTestId('nav-projects').click();
  const projectFiles=pm.locator('.card').filter({has:pm.getByRole('heading',{name:'Project documents'})});
  await projectFiles.getByRole('button',{name:'Upload'}).waitFor();
  await checkUpload(pm,projectFiles,'**/api/v1/projects/*/documents','Upload');

  const scientist=await browser.newPage();
  await login(scientist,'scientist2.demo');
  await scientist.getByRole('row',{name:/Thermal analysis report/}).click();
  const taskFiles=scientist.locator('.card').filter({has:scientist.getByRole('heading',{name:'Discussion and files'})});
  await taskFiles.getByRole('button',{name:'Upload file'}).waitFor();
  await checkUpload(scientist,taskFiles,'**/api/v1/tasks/*/attachments','Upload file');
  console.log('Upload indicator passed: green tick and filename after success, no tick after failure, for project and task files.');
}finally{await browser.close()}

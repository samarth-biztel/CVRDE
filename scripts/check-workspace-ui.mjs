import {chromium} from 'playwright';
import {zipSync,strToU8} from 'fflate';

function demoSheet(){
  const types='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const root='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const book='<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Members" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const bookRels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  const cell=(ref,text)=>`<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
  const sheet=`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cell('A1','username')}${cell('B1','group')}</row><row r="2">${cell('A2','scientist1.demo')}${cell('B2','QA imported group')}</row></sheetData></worksheet>`;
  return Buffer.from(zipSync({'[Content_Types].xml':strToU8(types),'_rels/.rels':strToU8(root),'xl/workbook.xml':strToU8(book),'xl/_rels/workbook.xml.rels':strToU8(bookRels),'xl/worksheets/sheet1.xml':strToU8(sheet)}));
}

const browser=await chromium.launch({headless:true});
const root='http://localhost:5173';
async function login(page,username){
  await page.goto(root);
  await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();
  await page.getByTestId('login-submit').click();
  await page.getByRole('heading',{name:username==='pm.demo'?'Overview':'Tasks',exact:true}).waitFor();
}
try{
  const pm=await browser.newPage({viewport:{width:1440,height:900}});
  await login(pm,'pm.demo');
  await pm.getByTestId('nav-settings').click();
  await pm.getByRole('heading',{name:'Create project'}).waitFor();
  await pm.getByRole('heading',{name:'Add team member'}).waitFor();
  await pm.getByRole('heading',{name:'Import team and groups from Excel'}).waitFor();
  await pm.getByRole('heading',{name:'Groups',exact:true}).waitFor();
  await pm.getByLabel('Excel member sheet').setInputFiles({name:'members.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:demoSheet()});
  await pm.getByRole('button',{name:'Import Excel sheet'}).click();
  await pm.getByText('Excel members and groups imported').waitFor();
  await pm.getByText('QA imported group',{exact:true}).waitFor();
  await pm.getByPlaceholder('New group name').fill('QA manual group');
  await pm.getByRole('button',{name:'Create group'}).click();
  await pm.getByText('QA manual group',{exact:true}).waitFor();
  await pm.getByTestId('nav-projects').click();
  await pm.getByRole('columnheader',{name:'Due date'}).waitFor();
  await pm.getByRole('columnheader',{name:'Linked to'}).waitFor();
  if(await pm.getByRole('heading',{name:'Create project'}).count())throw new Error('Project creation still appears inside Projects');
  await pm.getByTestId('nav-pending').click();
  await pm.getByLabel('Review type').waitFor();
  await pm.getByLabel('Filter reviews by task').waitFor();
  await pm.getByTestId('nav-reports').waitFor();

  const member=await browser.newPage({viewport:{width:1440,height:900}});
  await login(member,'scientist1.demo');
  await member.getByRole('columnheader',{name:'Due date'}).waitFor();
  await member.getByRole('columnheader',{name:'Linked to'}).waitFor();
  if(await member.getByTestId('nav-reports').count())throw new Error('Reports is visible to a scientist');
  if(await member.getByTestId('nav-settings').count())throw new Error('Settings is visible to a scientist');
  await member.getByRole('row',{name:/Fatigue test setup/}).click();
  await member.getByLabel('Task status').waitFor();
  await member.getByText('Reassignment',{exact:true}).waitFor();
  await member.getByText('Prerequisite tasks and pendencies').waitFor();
  for(const label of ['PLM identifier','Update sharing','Visibility']){
    if(await member.getByText(label,{exact:true}).count())throw new Error(`Removed detail field remains: ${label}`);
  }
  await member.getByText('Reassignment',{exact:true}).click();
  await member.getByLabel('New owner').waitFor();
  await member.getByLabel('From').waitFor();
  await member.getByLabel('Until').waitFor();
  await member.getByText('Prerequisite tasks and pendencies').click();
  await member.getByRole('button',{name:'Add prerequisite task'}).waitFor();
  await member.getByLabel('Waiting on task').selectOption({label:'Material sample testing'});
  await member.getByLabel('Responsible team member').selectOption({label:'Demo Scientist Two'});
  await member.getByLabel('What is needed?').fill('Confirm the material test before fatigue setup');
  await member.getByRole('button',{name:'Add prerequisite task'}).click();
  await member.getByText('Prerequisite sent for manager approval').waitFor();
  await member.getByLabel('New owner').selectOption({label:'Demo Scientist Two'});
  await member.getByLabel('From').fill('2026-11-01');
  await member.getByLabel('Until').fill('2026-11-15');
  await member.locator('details').filter({hasText:'Reassignment'}).getByLabel('Reason').fill('Workload coverage for two weeks');
  await member.getByRole('button',{name:'Request reassignment'}).click();
  await member.getByText('Sent to manager for approval').waitFor();
  await pm.reload();
  await pm.getByTestId('nav-pending').click();
  await pm.getByLabel('Review type').selectOption('PENDENCY_APPROVAL');
  const prerequisite=pm.locator('.pending-row').filter({hasText:'Fatigue test setup'});
  await prerequisite.getByRole('button',{name:'Approve'}).click();
  await pm.getByText('Prerequisite approved').waitFor();
  await pm.getByLabel('Review type').selectOption('REASSIGNMENT');
  const request=pm.locator('.pending-row').filter({hasText:'Fatigue test setup'});
  await request.getByRole('button',{name:'Approve'}).click();
  await pm.getByText('Reassignment approved').waitFor();
  await member.getByTestId('nav-pending').click();
  await member.getByLabel('Review type').waitFor();
  await member.getByTestId('nav-tasks').click();
  await member.getByRole('row',{name:/Vibration test matrix/}).click();
  await member.getByLabel('Task status').selectOption('IN_PROGRESS');
  await member.getByText('Task started').waitFor();
  await member.getByLabel('Task status').selectOption('SUBMIT');
  await member.getByLabel('Result description').fill('Vibration measurements completed and documented.');
  await member.getByRole('button',{name:'Submit result'}).click();
  await member.getByText('Result submitted for review').waitFor();
  await pm.reload();
  await pm.getByTestId('nav-pending').click();
  await pm.getByLabel('Review type').selectOption('RESULT_REVIEW');
  await pm.locator('.pending-row').filter({hasText:'Vibration test matrix'}).waitFor();
  console.log('Workspace UI passed: role tables, Settings manual and Excel groups, task status and result, prerequisite and reassignment manager approvals, review filters.');
}finally{await browser.close()}

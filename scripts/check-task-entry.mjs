import {chromium} from 'playwright';

const base='http://localhost:5173';
const browser=await chromium.launch({headless:true});
async function signIn(page,username){
  await page.goto(base);
  await page.getByTestId(`demo-${username.replaceAll('.','-')}`).click();
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-tasks').waitFor();
}
try{
  const pm=await browser.newPage();
  await signIn(pm,'pm.demo');
  const projectsResponse=await pm.request.get(`${base}/api/v1/projects`);
  const project=(await projectsResponse.json()).find(row=>row.name.startsWith('Engine Component Development'));
  if(!project?.target_date)throw new Error('Seeded project deadline is missing');
  const lastTaskDate=new Date(Date.parse(project.target_date)-86400000).toISOString().slice(0,10);
  const tasksResponse=await pm.request.get(`${base}/api/v1/projects/${project.id}/tasks`);
  const projectTasks=await tasksResponse.json();
  const task=projectTasks.find(row=>row.title==='Fatigue test setup');
  if(!task)throw new Error('Seeded task is missing');

  await pm.getByTestId('nav-projects').click();
  await pm.getByRole('button',{name:'New project'}).click();
  if(!await pm.getByLabel('Project deadline').evaluate(input=>input.required))throw new Error('Project deadline is not required');
  await pm.getByRole('button',{name:'Cancel'}).click();
  await pm.getByRole('button',{name:'Edit project'}).click();
  await pm.getByRole('heading',{name:'Edit project'}).waitFor();
  if(await pm.getByLabel('Project name').inputValue()!==project.name)throw new Error('Project name was not filled for editing');
  if(await pm.getByLabel('Project deadline').inputValue()!==project.target_date)throw new Error('Project deadline was not filled for editing');
  await pm.getByRole('button',{name:'Cancel'}).click();
  await pm.getByTestId('nav-settings').click();
  if(await pm.getByRole('button',{name:'New project'}).count())throw new Error('Project creation remains in Settings');
  await pm.getByTestId('nav-tasks').click();
  await pm.getByRole('button',{name:'New task'}).click();
  if(await pm.getByLabel('Due date',{exact:true}).getAttribute('max')!==lastTaskDate)throw new Error('Task date picker has the wrong limit');
  await pm.getByRole('button',{name:'Cancel'}).click();
  await pm.getByRole('row',{name:/Fatigue test setup/}).click();
  await pm.getByRole('button',{name:'Edit task'}).click();
  await pm.waitForFunction(expected=>document.querySelector('input[name="due_date"]')?.getAttribute('max')===expected,lastTaskDate);
  if(await pm.getByLabel('Due date',{exact:true}).getAttribute('max')!==lastTaskDate)throw new Error('Edit date picker has the wrong limit');

  const invalidProject=await pm.request.post(`${base}/api/v1/projects`,{data:{name:'Missing deadline'}});
  if(invalidProject.status()!==400)throw new Error(`Project without deadline returned ${invalidProject.status()}`);
  const latestDue=projectTasks.map(row=>row.due_date).filter(Boolean).sort().at(-1);
  const invalidProjectEdit=await pm.request.patch(`${base}/api/v1/projects/${project.id}`,{data:{target_date:latestDue}});
  if(invalidProjectEdit.status()!==400)throw new Error(`Project deadline before tasks returned ${invalidProjectEdit.status()}`);
  const invalidTask=await pm.request.post(`${base}/api/v1/projects/${project.id}/tasks`,{data:{title:'Invalid deadline',owner_id:task.owner_id,due_date:project.target_date}});
  if(invalidTask.status()!==400)throw new Error(`Task on project deadline returned ${invalidTask.status()}`);
  const invalidEdit=await pm.request.patch(`${base}/api/v1/tasks/${task.id}`,{data:{due_date:project.target_date}});
  if(invalidEdit.status()!==400)throw new Error(`Task edit on project deadline returned ${invalidEdit.status()}`);

  const scientist=await browser.newPage();
  await signIn(scientist,'scientist1.demo');
  if(await scientist.getByRole('button',{name:'New task'}).count())throw new Error('Scientist can create tasks');
  await scientist.getByTestId('nav-projects').click();
  if(await scientist.getByRole('button',{name:'Edit project'}).count())throw new Error('Scientist can edit project');
  const forbiddenProjectEdit=await scientist.request.patch(`${base}/api/v1/projects/${project.id}`,{data:{name:'Unauthorized change'}});
  if(forbiddenProjectEdit.status()!==404)throw new Error(`Scientist project edit returned ${forbiddenProjectEdit.status()}`);
  const invalidExtension=await scientist.request.post(`${base}/api/v1/tasks/${task.id}/extension-requests`,{data:{new_due_date:project.target_date,reason:'Outside project deadline'}});
  if(invalidExtension.status()!==400)throw new Error(`Extension on project deadline returned ${invalidExtension.status()}`);

  console.log('Task entry check passed: project/task tab actions, manager edits, role gating, and deadline limits in UI and API.');
}finally{
  await browser.close();
}

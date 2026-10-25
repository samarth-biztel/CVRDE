const base=process.env.CVRDE_URL || 'https://biztel-ai-cvrde.vercel.app';
async function call(path,options={}){
  const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(15000)});
  return response;
}
function expect(value,message){if(!value)throw new Error(message);}
const health=await call('/health');
expect(health.status===200,'HTTPS health check failed');
const demo=await call('/api/v1/auth/demo');
expect(demo.status===200,'Public demo credentials unavailable');
const {password}=await demo.json();
const sessions={};
for(const username of ['pm.demo','scientist1.demo','scientist2.demo','reviewer.demo']){
  const login=await call('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  expect(login.status===200,`${username} login failed: ${login.status}`);
  sessions[username]=login.headers.get('set-cookie')?.split(';')[0];
  expect(sessions[username],`${username} session cookie missing`);
}
async function as(username,path){
  return call(path,{headers:{Cookie:sessions[username]}});
}
const projects=await as('pm.demo','/api/v1/projects');
expect(projects.status===200,'PM project list failed');
const project=(await projects.json()).find(p=>p.name.startsWith('Engine Component Development'));
expect(project,'Seeded project missing');
const tasks=await as('pm.demo',`/api/v1/projects/${project.id}/tasks`);
expect(tasks.status===200,'PM task list failed');
const rows=await tasks.json();
expect(rows.length===17,`Expected 17 seeded tasks, got ${rows.length}`);
const dashboard=await as('pm.demo',`/api/v1/projects/${project.id}/dashboard`);
expect(dashboard.status===200 && (await dashboard.json()).total===17,'Dashboard does not match tasks');
const documents=await as('pm.demo',`/api/v1/projects/${project.id}/documents`);
expect(documents.status===200 && (await documents.json()).length>=2,'Seeded documents missing');
for(const path of ['/api/v1/reports/overdue.csv','/api/v1/reports/progress.csv']){
  const report=await as('pm.demo',`${path}?project_id=${project.id}`);
  expect(report.status===200 && (await report.text()).startsWith('id,title,status,priority,due_date'),`CSV report failed: ${path}`);
}
const thermal=rows.find(t=>t.title==='Thermal analysis report');
const drawing=rows.find(t=>t.title==='Component drawing review');
expect((await as('scientist1.demo',`/api/v1/tasks/${thermal.id}`)).status===200,'Shared task unavailable');
expect((await as('scientist1.demo',`/api/v1/tasks/${drawing.id}`)).status===404,'Private task exposed');
expect((await as('reviewer.demo',`/api/v1/tasks/${drawing.id}`)).status===404,'Reviewer can view private task');
const attachments=await as('pm.demo',`/api/v1/tasks/${thermal.id}/attachments`);
expect(attachments.status===200,'Task attachments unavailable');
const attachment=(await attachments.json())[0];
expect(attachment,'Seeded task attachment missing');
const downloaded=await as('pm.demo',`/api/v1/attachments/${attachment.id}/download`);
expect(downloaded.status===200 && (await downloaded.arrayBuffer()).byteLength>0,'Task attachment download failed');
expect((await as('reviewer.demo',`/api/v1/attachments/${attachment.id}/download`)).status===404,'Private attachment exposed');
const largeFile=new Uint8Array(4*1024*1024+512);
largeFile.set(new TextEncoder().encode('%PDF-1.7\n'));
const upload=new FormData();
upload.set('document_key','qa-size-limit');
upload.set('file',new Blob([largeFile],{type:'application/pdf'}),'limit-check.pdf');
const oversized=await call(`/api/v1/tasks/${thermal.id}/attachments`,{method:'POST',headers:{Cookie:sessions['scientist2.demo']},body:upload});
expect(oversized.status===413,`Oversized upload was not rejected with 413: ${oversized.status}`);
const legacy=await fetch('https://cvrde-five.vercel.app/health',{redirect:'manual',signal:AbortSignal.timeout(15000)});
expect(legacy.status===307 && legacy.headers.get('location')?.startsWith(base),'Legacy domain redirect failed');
console.log('Live verification passed: HTTPS, four logins, 17 tasks, dashboard, documents, both CSV reports, attachment access, 4 MB upload limit, and legacy redirect.');

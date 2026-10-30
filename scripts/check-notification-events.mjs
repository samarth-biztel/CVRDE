import assert from 'node:assert/strict';
import https from 'node:https';

const origin=process.env.CVRDE_LAN_URL||'https://localhost';
function client(){let cookie='';return (path,method='GET',body)=>new Promise((resolve,reject)=>{
  const data=body?JSON.stringify(body):undefined;
  const req=https.request(new URL(path,origin),{method,rejectUnauthorized:false,headers:{...(data?{'content-type':'application/json','content-length':Buffer.byteLength(data)}:{}),...(cookie?{cookie}:{})}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
      if(res.headers['set-cookie'])cookie=res.headers['set-cookie'][0].split(';')[0];
      const raw=Buffer.concat(chunks).toString();let value;try{value=JSON.parse(raw)}catch{value=raw}
      resolve({status:res.statusCode,body:value});
    });
  });req.on('error',reject);if(data)req.write(data);req.end();
})}
const pm=client(),owner=client();
for(const [call,username] of [[pm,'pm.demo'],[owner,'scientist1.demo']])assert.equal((await call('/api/v1/auth/login','POST',{username,password:'CVRDE-Demo-2026!'})).status,200);
const project=(await pm('/api/v1/projects')).body.find(p=>p.name.includes('Engine Component Development'));
const user=(await pm('/api/v1/users')).body.find(u=>u.username==='scientist1.demo');
assert.ok(project&&user);
const due=new Date(Date.parse(project.target_date)-20*86400000).toISOString().slice(0,10);
const later=new Date(Date.parse(project.target_date)-19*86400000).toISOString().slice(0,10);
const created=await pm(`/api/v1/projects/${project.id}/tasks`,'POST',{title:'Notification verification task',description:'Verify every event',owner_id:user.id,due_date:due});
assert.equal(created.status,201);const taskId=created.body.id;
assert.equal((await owner(`/api/v1/tasks/${taskId}/status`,'POST',{})).status,200);
const first=await owner(`/api/v1/tasks/${taskId}/results`,'POST',{work_completed:'First draft',outcome:'Review requested'});assert.equal(first.status,201);
assert.equal((await pm(`/api/v1/results/${first.body.id}/review`,'POST',{accept:false,comment:'Add detail'})).status,200);
const second=await owner(`/api/v1/tasks/${taskId}/results`,'POST',{work_completed:'Revised draft',outcome:'Ready'});assert.equal(second.status,201);
assert.equal((await pm(`/api/v1/results/${second.body.id}/review`,'POST',{accept:true,comment:'Accepted'})).status,200);
assert.equal((await pm(`/api/v1/tasks/${taskId}/comments`,'POST',{body:'Looks good @scientist1.demo'})).status,201);
const extension=await owner(`/api/v1/tasks/${taskId}/extension-requests`,'POST',{new_due_date:later,reason:'Verification request'});assert.equal(extension.status,201);
assert.equal((await pm(`/api/v1/extension-requests/${extension.body.id}/decision`,'POST',{approve:false,comment:'No change needed'})).status,200);
const ownerNotifications=(await owner('/api/v1/me/notifications')).body.filter(n=>n.task_id===taskId);
const pmNotifications=(await pm('/api/v1/me/notifications')).body.filter(n=>n.task_id===taskId);
for(const kind of ['ASSIGNED','RETURNED','ACCEPTED','COMMENT','REQUEST_ANSWERED'])assert.ok(ownerNotifications.some(n=>n.event_type===kind),`missing ${kind}`);
assert.ok(pmNotifications.some(n=>n.event_type==='SUBMITTED'),'missing SUBMITTED');
const unread=ownerNotifications.find(n=>!n.read_at);assert.ok(unread);
assert.equal((await owner(`/api/v1/me/notifications/${unread.id}/read`,'POST',{})).status,200);
assert.ok((await owner('/api/v1/me/notifications')).body.find(n=>n.id===unread.id).read_at);
assert.equal((await owner('/api/v1/me/notifications/read-all','POST',{})).status,200);
assert.equal((await owner('/api/v1/me/notifications')).body.filter(n=>!n.read_at).length,0);
const audit=(await pm(`/api/v1/projects/${project.id}/audit`)).body;
for(const action of ['TASK_CREATED','RESULT_REVIEWED','COMMENT_ADDED'])assert.ok(audit.some(a=>a.action===action&&a.task_id===taskId&&a.actor_id&&a.created_at),`missing audit ${action}`);
console.log('Notification events, read actions, and project audit records passed through Docker HTTPS.');

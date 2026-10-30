import assert from 'node:assert/strict';
import https from 'node:https';

const origin=process.env.CVRDE_LAN_URL||'https://localhost';
let cookie='';
function call(path,method='GET',body){return new Promise((resolve,reject)=>{
  const data=body?JSON.stringify(body):undefined;
  const req=https.request(new URL(path,origin),{method,rejectUnauthorized:false,headers:{...(data?{'content-type':'application/json','content-length':Buffer.byteLength(data)}:{}),...(cookie?{cookie}:{})}},res=>{
    const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{
      if(res.headers['set-cookie'])cookie=res.headers['set-cookie'][0].split(';')[0];
      const raw=Buffer.concat(chunks).toString();let value;try{value=JSON.parse(raw)}catch{value=raw}
      resolve({status:res.statusCode,body:value,headers:res.headers});
    });
  });req.on('error',reject);if(data)req.write(data);req.end();
})}
assert.deepEqual((await call('/health')).body,{ok:true});
const home=await call('/');assert.equal(home.status,200);assert.match(home.body,/CVRDE Work Management/);
const login=await call('/api/v1/auth/login','POST',{username:'pm.demo',password:'CVRDE-Demo-2026!'});
assert.equal(login.status,200);
const projects=await call('/api/v1/projects');assert.equal(projects.status,200);
const project=projects.body.find(p=>p.name.includes('Engine Component Development'));assert.ok(project);
const tasks=await call(`/api/v1/projects/${project.id}/tasks`);assert.equal(tasks.status,200);assert.equal(tasks.body.length,17);
assert.ok(tasks.body.some(t=>t.status==='NOT_STARTED'));
console.log('Docker LAN check passed: HTTPS, static app, login, local PostgreSQL, 17 tasks, migrated statuses.');

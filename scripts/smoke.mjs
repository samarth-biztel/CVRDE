import assert from 'node:assert/strict';

process.env.NODE_ENV='test';
const {app}=await import('../backend/dist/server.js');
const server=app.listen(0);
try{
  const address=server.address();
  if(!address || typeof address==='string')throw new Error('No test port');
  const base=`http://127.0.0.1:${address.port}`;
  const health=await fetch(`${base}/health`);
  assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{ok:true});
  const demo=await fetch(`${base}/api/v1/auth/demo`);
  assert.equal(demo.status,200);
  const credentials=await demo.json();
  assert.equal(credentials.accounts.length,6);
  const login=await fetch(`${base}/api/v1/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'pm.demo',password:credentials.password})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const projects=await fetch(`${base}/api/v1/projects`,{headers:{cookie}});
  assert.equal(projects.status,200);
  const list=await projects.json();
  const project=list.find(project=>project.name.includes('Demo'));
  assert.ok(project);
  const dashboard=await fetch(`${base}/api/v1/projects/${project.id}/dashboard`,{headers:{cookie}});
  assert.equal(dashboard.status,200);
  assert.ok((await dashboard.json()).total>=17);
  const documents=await fetch(`${base}/api/v1/projects/${project.id}/documents`,{headers:{cookie}});
  assert.equal(documents.status,200);
  const versions=await documents.json();
  assert.ok(versions.length>=2);
  const download=await fetch(`${base}/api/v1/attachments/${versions[0].id}/download`,{headers:{cookie}});
  assert.equal(download.status,200);
  assert.ok((await download.arrayBuffer()).byteLength>100);
  console.log('Smoke check passed: login, expanded demo data, and PostgreSQL attachment download.');
}finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

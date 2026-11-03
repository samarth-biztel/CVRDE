import assert from 'node:assert/strict';
import {request} from 'playwright';

const origin=process.env.CVRDE_UI_URL||'http://localhost:5173';
const contexts=[];
async function login(username){const context=await request.newContext({baseURL:origin});contexts.push(context);const response=await context.post('/api/v1/auth/login',{data:{username,password:'CVRDE-Demo-2026!'}});assert.equal(response.status(),200,username);return context}
const uploaded=[];
try{
  const pm=await login('pm.demo'),owner=await login('task2.demo');
  const project=(await (await pm.get('/api/v1/projects')).json()).find(item=>item.name==='Engine Development Programme');assert.ok(project);
  const work=(await (await owner.get(`/api/v1/me/work?project_id=${project.id}`)).json()).tasks;
  const task=work.find(item=>item.title==='Crankshaft stress analysis');assert.ok(task);
  const samples=[
    ['dxf','image/vnd.dxf',Buffer.from('0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n')],
    ['mesh','application/octet-stream',Buffer.from('MeshVersionFormatted 2\nDimension 3\nEnd\n')],
    ['cdb','application/octet-stream',Buffer.from('/PREP7\n! Engineering mesh database\n')]
  ];
  for(const [extension,mime,buffer] of samples){
    for(const [scope,context,path] of [['task',owner,`/api/v1/tasks/${task.id}/attachments`],['project',pm,`/api/v1/projects/${project.id}/documents`]]){
      const name=`engineering-sample.${extension}`;
      const response=await context.post(path,{multipart:{file:{name,mimeType:mime,buffer},...(scope==='project'?{document_key:`engineering-sample-${extension}-${Date.now()}`}:{})}});
      assert.equal(response.status(),201,`${scope} ${name}: ${await response.text()}`);
      const item=await response.json();uploaded.push([context,item.id]);
      const download=await context.get(`/api/v1/attachments/${item.id}/download`);
      assert.equal(download.status(),200,name);assert.match(download.headers()['content-type'],new RegExp(mime.replace('/','\\/')));
      assert.deepEqual(await download.body(),buffer,name);
    }
  }
  console.log('Engineering upload checks passed: .dxf, .mesh, .cdb on task evidence and project documents.');
}finally{
  for(const [context,id] of uploaded.reverse())await context.delete(`/api/v1/attachments/${id}`).catch(()=>{});
  await Promise.all(contexts.map(context=>context.dispose()));
}

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { config } from 'dotenv';

config({path:'.env'});
process.env.NODE_ENV='test';
process.env.VERCEL='1';
const {default:handler}=await import('../api/index.ts');
const server=createServer((req,res)=>{
  req.url=req.url==='/health'?'/api/index?__cvrde_path=/health':'/api/index?__cvrde_path=/api/v1/auth/demo';
  handler(req,res);
});
server.listen(0);
try{
  const address=server.address();
  if(!address || typeof address==='string')throw new Error('No test port');
  const base=`http://127.0.0.1:${address.port}`;
  const health=await fetch(`${base}/health`);
  assert.deepEqual(await health.json(),{ok:true});
  const demo=await fetch(`${base}/demo`);
  assert.equal(demo.status,200);
  assert.equal((await demo.json()).accounts.length,6);
  const savedDatabaseUrl=process.env.DATABASE_URL;
  process.env.DATABASE_URL='';
  try{
    const unavailable=await fetch(`${base}/health`);
    assert.equal(unavailable.status,503);
    assert.match((await unavailable.json()).error,/DATABASE_URL/);
  }finally{process.env.DATABASE_URL=savedDatabaseUrl;}
  console.log('Vercel entry check passed: rewritten paths reach Express and missing database config returns 503.');
}finally{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

import '../backend/src/env.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req:IncomingMessage,res:ServerResponse){
  if(!process.env.DATABASE_URL){
    res.statusCode=503;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({error:'DATABASE_URL is not configured for this deployment'}));
    return;
  }
  const url=new URL(req.url || '/', 'http://internal');
  const path=url.searchParams.get('__cvrde_path');
  if(path){
    url.searchParams.delete('__cvrde_path');
    req.url=path+(url.search || '');
  }
  try{
    const {app}=await import('../backend/src/server.js');
    return app(req,res);
  }catch(error){
    console.error('CVRDE API initialization failed',error);
    res.statusCode=500;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({error:'API initialization failed; check Vercel function logs'}));
  }
}

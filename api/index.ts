import { app } from '../backend/src/server.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(req:IncomingMessage,res:ServerResponse){
  const url=new URL(req.url || '/', 'http://internal');
  const path=url.searchParams.get('__cvrde_path');
  if(path){
    url.searchParams.delete('__cvrde_path');
    req.url=path+(url.search || '');
  }
  return app(req,res);
}

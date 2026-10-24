import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

process.env.NODE_ENV='test'; // Import the Express app without opening its standalone API port.
const {app}=await import('../backend/dist/server.js');
const dist=resolve('frontend/dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
app.use(async(req,res,next)=>{
  if(req.path.startsWith('/api/') || req.path==='/health')return next();
  const path=req.path==='/'?resolve(dist,'index.html'):resolve(dist,'.'+req.path);
  if(path!==dist && !path.startsWith(dist+sep))return res.sendStatus(403);
  try{
    const data=await readFile(path);
    res.type(types[extname(path)] || 'application/octet-stream').send(data);
  }catch(error){
    if(error?.code!=='ENOENT')return next(error);
    if(req.method!=='GET' || req.path.includes('.'))return res.sendStatus(404);
    res.type('text/html').send(await readFile(resolve(dist,'index.html')));
  }
});
const port=Number(process.env.PORT || 5173);
app.listen(port,()=>console.log(`CVRDE available at http://localhost:${port}`));

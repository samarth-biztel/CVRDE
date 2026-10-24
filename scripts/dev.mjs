import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const npmCli=process.env.npm_execpath;
if(!npmCli)throw new Error('Start this script with npm run dev');

const services=[
  ['API','backend'],
  ['Web','frontend']
];
const children=services.map(([name,workspace])=>{
  const child=spawn(process.execPath,[npmCli,'run','dev','-w',workspace],{
    cwd:root,
    env:process.env,
    stdio:'inherit',
    windowsHide:true
  });
  child.once('error',error=>{
    console.error(`${name} failed to start:`,error);
    stop(1);
  });
  child.once('exit',(code,signal)=>{
    if(!stopping){
      console.error(`${name} stopped (${signal || code}). Stopping the other service.`);
      stop(code || 1);
    }
  });
  return child;
});

let stopping=false;
function stop(code=0){
  if(stopping)return;
  stopping=true;
  for(const child of children){
    if(!child.pid || child.exitCode!==null)continue;
    if(process.platform==='win32'){
      spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
    }else child.kill('SIGTERM');
  }
  setTimeout(()=>process.exit(code),1500).unref();
}
process.on('SIGINT',()=>stop());
process.on('SIGTERM',()=>stop());

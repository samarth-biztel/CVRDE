import net from 'node:net';
import {appendFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const output=resolve(process.env.EMAIL_CAPTURE_PATH||'demo/email-capture.jsonl');
await mkdir(dirname(output),{recursive:true});
await writeFile(output,'');
const server=net.createServer(socket=>{
  socket.setEncoding('utf8');socket.write('220 CVRDE fictional email sink\r\n');
  let buffer='',data=false,message='',recipient='';
  socket.on('data',chunk=>{
    buffer+=chunk;
    let end;
    while((end=buffer.indexOf('\r\n'))>=0){
      const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(data){
        if(line==='.') {data=false;appendFile(output,JSON.stringify({to:recipient,raw:message})+'\n').catch(()=>{});message='';socket.write('250 Message accepted\r\n');}
        else message+=line+'\n';
        continue;
      }
      const command=line.toUpperCase();
      if(command.startsWith('EHLO')||command.startsWith('HELO'))socket.write('250-localhost\r\n250 8BITMIME\r\n');
      else if(command.startsWith('MAIL FROM'))socket.write('250 OK\r\n');
      else if(command.startsWith('RCPT TO')){recipient=line.slice(8).trim();socket.write('250 OK\r\n');}
      else if(command==='DATA'){data=true;socket.write('354 End data with <CRLF>.<CRLF>\r\n');}
      else if(command==='QUIT'){socket.write('221 Bye\r\n');socket.end();}
      else socket.write('250 OK\r\n');
    }
  });
});
server.listen(Number(process.env.EMAIL_CAPTURE_PORT||2525),'0.0.0.0',()=>console.log(`Fictional SMTP sink listening on port ${process.env.EMAIL_CAPTURE_PORT||2525}; output: ${output}`));

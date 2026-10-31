import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

const folder=new URL('../frontend/public/demo-files/',import.meta.url);
await mkdir(folder,{recursive:true});
function pdf(lines){
  const safe=value=>value.replace(/[()\\]/g,'').replace(/[^\x20-\x7e]/g,' ');
  const stream=['BT /F1 16 Tf 50 750 Td',...lines.flatMap((line,index)=>[index?'0 -28 Td':'',`(${safe(line)}) Tj`]),'ET'].filter(Boolean).join('\n');
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let result='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(result));result+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const start=Buffer.byteLength(result);result+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(result);
}
await writeFile(new URL('combustion-cfd-report.pdf',folder),pdf(['FICTIONAL DEMO - Combustion chamber CFD report','Engine Development Programme - Design & Simulation','Mesh: 1.2 million cells; solver convergence achieved.','Peak in-cylinder pressure: 68 bar (invented demo value).','Recommendation: review revised target boundary conditions.']));
await writeFile(new URL('revised-cfd-report.pdf',folder),pdf(['FICTIONAL DEMO - Revised CFD report','Engine Development Programme - Design & Simulation','Boundary conditions updated after owner feedback.','Peak in-cylinder pressure: 66 bar (invented demo value).','Result ready for sign-off.']));

const width=640,height=360,pixels=Buffer.alloc(width*height*3,255);
function rect(x1,y1,x2,y2,r,g,b){for(let y=Math.max(0,y1);y<Math.min(height,y2);y++)for(let x=Math.max(0,x1);x<Math.min(width,x2);x++){const index=(y*width+x)*3;pixels[index]=r;pixels[index+1]=g;pixels[index+2]=b;}}
rect(130,28,510,332,35,48,68);rect(143,41,497,319,242,247,252);
rect(188,125,452,211,50,103,171);rect(198,135,442,201,115,169,222);
rect(265,151,375,166,225,237,249);rect(310,211,330,300,35,48,68);
rect(240,292,400,313,35,48,68);rect(260,296,380,309,115,169,222);
rect(154,72,486,79,50,103,171);rect(154,260,486,267,50,103,171);
const rows=Buffer.alloc(height*(1+width*3));for(let y=0;y<height;y++){rows[y*(1+width*3)]=0;pixels.copy(rows,y*(1+width*3)+1,y*width*3,(y+1)*width*3);}
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const name=Buffer.from(type);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
await writeFile(new URL('piston-concept-drawing.png',folder),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
console.log('Generated three fictional upload samples in frontend/public/demo-files.');

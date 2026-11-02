import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

function pdf(text){
  const safe=text.replace(/[()\\]/g,'');
  const stream=`BT /F1 16 Tf 50 750 Td (${safe}) Tj ET`;
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let result='%PDF-1.4\n',offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(result));result+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}
  const start=Buffer.byteLength(result);
  result+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(result);
}

const folder=resolve('frontend/public/demo-assets');
await mkdir(folder,{recursive:true});
for(const [name,summary] of [
  ['block-inspection-report.pdf','Bore and deck measurements within tolerance'],
  ['bearing-fitment-check.pdf','Crankshaft and bearing fitment checked'],
  ['build-checklist.pdf','Prototype build quality checklist completed']
])await writeFile(resolve(folder,name),pdf(`Fictional CVRDE demo evidence: ${summary}`));
console.log('Prototype Build sample PDFs generated.');

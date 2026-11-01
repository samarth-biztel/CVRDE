import {FileImage,FileSpreadsheet,FileText,FileType2} from 'lucide-react';
import {formatDate,type EvidenceFile} from './api';

export type FileRecord={id:number;name:string;mime_type?:string;size_bytes?:number;uploaded_at?:string;uploaded_by_name?:string};
const size=(bytes:number|undefined)=>bytes===undefined?'Size unavailable':bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.round(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1)} MB`;
function icon(name:string){const extension=name.split('.').at(-1)?.toLowerCase();return ['png','jpg','jpeg','bmp'].includes(extension||'')?FileImage:['xlsx','csv'].includes(extension||'')?FileSpreadsheet:extension==='pdf'?FileText:FileType2}
export function FileRow({file,onRemove}:{file:FileRecord;onRemove?:()=>void}){
  const Icon=icon(file.name);
  return <div className="standard-file-row"><Icon size={18} strokeWidth={1.6} aria-hidden="true"/><div><a href={`/api/v1/attachments/${file.id}/download`}>{file.name}</a><small>{size(file.size_bytes)} · Uploaded by {file.uploaded_by_name||'a team member'} · {formatDate(file.uploaded_at)}</small></div>{onRemove&&<button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}>Remove</button>}</div>;
}
export function EvidenceFiles({files}:{files:EvidenceFile[]}){return files.length?<div className="standard-file-list">{files.map(file=><FileRow key={file.id} file={file}/>)}</div>:null}

import {formatDateTime,type EvidenceFile} from './api';

export function EvidenceFiles({files}:{files:EvidenceFile[]}){
  if(!files.length)return null;
  return <ul className="evidence-list">{files.map(file=><li key={file.id}><a href={`/api/v1/attachments/${file.id}/download`}>{file.name}</a><small>{file.name.split('.').at(-1)?.toUpperCase()||file.mime_type} · Uploaded {formatDateTime(file.uploaded_at)}</small></li>)}</ul>;
}

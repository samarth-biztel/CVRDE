import { Router } from 'express';
import multer from 'multer';
import { createReadStream, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, one, query } from './db.js';
import { currentUser, handler, history, HttpError, projectManager, projectMember, taskAccess, taskById, uid } from './core.js';

export const fileRoutes=Router();
const allowed=new Set(['.pdf','.docx','.xlsx','.pptx','.csv','.txt','.png','.jpg','.jpeg','.bmp']);
const mime:Record<string,string>={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.csv':'text/csv','.txt':'text/plain','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.bmp':'image/bmp'};
// The Vercel request body limit is 4.5 MB; leave room for multipart headers.
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:4*1024*1024},fileFilter:(_req,file,cb)=>cb(null,allowed.has(extname(file.originalname).toLowerCase()))});
type Attachment={id:number;project_id:number;task_id:number|null;result_id:number|null;document_key:string;version_no:number;stored_name:string;original_name:string;mime_type:string;size_bytes:number};
function validateFile(data:Buffer,name:string){
  const ext=extname(name).toLowerCase(),bytes=data.subarray(0,8);
  const starts=(signature:number[])=>signature.every((b,i)=>bytes[i]===b);
  const okay=ext==='.pdf'?starts([0x25,0x50,0x44,0x46]):ext==='.png'?starts([0x89,0x50,0x4e,0x47]):ext==='.bmp'?starts([0x42,0x4d]):['.jpg','.jpeg'].includes(ext)?starts([0xff,0xd8,0xff]):['.docx','.xlsx','.pptx'].includes(ext)?starts([0x50,0x4b]):true;
  if(!okay)throw new HttpError(400,'File content does not match extension');
  if(['.docx','.xlsx','.pptx'].includes(ext)){
    let end=-1;
    for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(data.readUInt32LE(i)===0x06054b50){end=i;break;}
    if(end<0)throw new HttpError(400,'Invalid Office document');
    const count=data.readUInt16LE(end+10),names=new Set<string>();let offset=data.readUInt32LE(end+16);
    if(count>10000)throw new HttpError(400,'Invalid Office document');
    for(let i=0;i<count;i++){
      if(offset+46>data.length||data.readUInt32LE(offset)!==0x02014b50)throw new HttpError(400,'Invalid Office document');
      const length=data.readUInt16LE(offset+28),extra=data.readUInt16LE(offset+30),comment=data.readUInt16LE(offset+32);
      if(offset+46+length+extra+comment>data.length)throw new HttpError(400,'Invalid Office document');
      names.add(data.subarray(offset+46,offset+46+length).toString('utf8'));
      offset+=46+length+extra+comment;
    }
    const required=ext==='.docx'?'word/document.xml':ext==='.xlsx'?'xl/workbook.xml':'ppt/presentation.xml';
    if(!names.has('[Content_Types].xml')||!names.has(required))throw new HttpError(400,'File content does not match extension');
  }
  if(ext==='.txt'||ext==='.csv'){
    try{new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{throw new HttpError(400,'Text file must use UTF-8');}
    if(data.includes(0))throw new HttpError(400,'Text file contains binary data');
  }
}
const input=z.object({document_key:z.string().trim().min(1).max(100)}).strict();
fileRoutes.post('/tasks/:taskId/attachments',upload.single('file'),handler(async(req,res)=>{
  const file=req.file;if(!file)throw new HttpError(400,'Allowed file required');
  const user=currentUser(res),task=await taskById(uid(req.params.taskId));if(user.id!==task.owner_id)throw new HttpError(403,'Owner only');
  const data=input.parse(req.body);validateFile(file.buffer,file.originalname);
  const row=await db.transaction().execute(async tx=>{
    const item=await one<Attachment>(tx,`INSERT INTO attachments(project_id,task_id,result_id,document_key,version_no,original_name,stored_name,mime_type,size_bytes,uploaded_by,content) VALUES($1,$2,NULL,$3,(SELECT coalesce(max(version_no),0)+1 FROM attachments WHERE project_id=$1 AND document_key=$3),$4,$5,$6,$7,$8,$9) RETURNING id,project_id,task_id,document_key,version_no,original_name,mime_type,size_bytes`,[task.project_id,task.id,`task:${task.id}:${data.document_key}`,basename(file.originalname),randomUUID(),mime[extname(file.originalname).toLowerCase()],file.size,user.id,file.buffer]);
    await history(tx,task.project_id,task.id,'ATTACHMENT_UPLOADED',user.id,{attachment_id:item!.id,version_no:item!.version_no});return item;
  });res.status(201).json(row);
}));
fileRoutes.get('/tasks/:taskId/attachments',handler(async(req,res)=>{const user=currentUser(res),task=await taskById(uid(req.params.taskId));await taskAccess(user,task,'RESULTS');res.json(await query(db,'SELECT id,project_id,task_id,result_id,document_key,version_no,original_name,mime_type,size_bytes,uploaded_at FROM attachments WHERE task_id=$1 ORDER BY document_key,version_no DESC',[task.id]));}));
fileRoutes.post('/projects/:projectId/documents',upload.single('file'),handler(async(req,res)=>{
  const file=req.file;if(!file)throw new HttpError(400,'Allowed file required');
  const user=currentUser(res),projectId=uid(req.params.projectId);await projectManager(user,projectId);validateFile(file.buffer,file.originalname);
  const {document_key}=z.object({document_key:z.string().trim().min(1).max(100)}).parse(req.body);
  const row=await db.transaction().execute(async tx=>{const item=await one<Attachment>(tx,`INSERT INTO attachments(project_id,task_id,document_key,version_no,original_name,stored_name,mime_type,size_bytes,uploaded_by,content) VALUES($1,NULL,$2,(SELECT coalesce(max(version_no),0)+1 FROM attachments WHERE project_id=$1 AND document_key=$2),$3,$4,$5,$6,$7,$8) RETURNING id,project_id,task_id,document_key,version_no,original_name,mime_type,size_bytes`,[projectId,`project:${document_key}`,basename(file.originalname),randomUUID(),mime[extname(file.originalname).toLowerCase()],file.size,user.id,file.buffer]);await history(tx,projectId,null,'PROJECT_DOCUMENT_UPLOADED',user.id,{attachment_id:item!.id,version_no:item!.version_no});return item;});res.status(201).json(row);
}));
fileRoutes.get('/projects/:projectId/documents',handler(async(req,res)=>{const user=currentUser(res),projectId=uid(req.params.projectId);await projectMember(user,projectId);res.json(await query(db,'SELECT a.id,a.project_id,a.document_key,a.version_no,a.original_name,a.mime_type,a.size_bytes,a.uploaded_at,u.full_name AS uploaded_by_name FROM attachments a JOIN users u ON u.id=a.uploaded_by WHERE a.project_id=$1 AND a.task_id IS NULL ORDER BY a.document_key,a.version_no DESC',[projectId]));}));
async function attachmentFor(user:ReturnType<typeof currentUser>,id:number){const item=await one<Attachment>(db,'SELECT id,project_id,task_id,result_id,document_key,version_no,stored_name,original_name,mime_type,size_bytes FROM attachments WHERE id=$1',[id]);if(!item)throw new HttpError(404,'Attachment not found');if(item.task_id){const task=await taskById(item.task_id);await taskAccess(user,task,'RESULTS');}else await projectMember(user,item.project_id);return item;}
fileRoutes.get('/attachments/:attachmentId/versions',handler(async(req,res)=>{const user=currentUser(res),item=await attachmentFor(user,uid(req.params.attachmentId));res.json(await query(db,'SELECT id,document_key,version_no,original_name,mime_type,size_bytes,uploaded_at FROM attachments WHERE project_id=$1 AND document_key=$2 ORDER BY version_no DESC',[item.project_id,item.document_key]));}));
fileRoutes.delete('/attachments/:attachmentId',handler(async(req,res)=>{
  const user=currentUser(res),item=await attachmentFor(user,uid(req.params.attachmentId));
  if(item.result_id)throw new HttpError(409,'Submitted files cannot be removed');
  if(item.task_id){const task=await taskById(item.task_id);if(user.id!==task.owner_id&&user.id!==task.manager_id)throw new HttpError(403,'Owner or manager only');}
  else await projectManager(user,item.project_id);
  await db.transaction().execute(async tx=>{await history(tx,item.project_id,item.task_id,'ATTACHMENT_DELETED',user.id,{attachment_id:item.id,name:item.original_name});await query(tx,'DELETE FROM attachments WHERE id=$1',[item.id]);});
  res.json({ok:true});
}));
fileRoutes.get('/attachments/:attachmentId/download',handler(async(req,res)=>{const user=currentUser(res),item=await attachmentFor(user,uid(req.params.attachmentId));const row=await one<{content:Buffer|null}>(db,'SELECT content FROM attachments WHERE id=$1',[item.id]);res.setHeader('Content-Type',item.mime_type);res.setHeader('Content-Disposition',`attachment; filename="${item.original_name.replace(/["\r\n]/g,'_')}"`);if(row?.content){res.send(row.content);return;}const path=join(process.env.UPLOAD_DIR || './uploads',item.stored_name);if(!existsSync(path))throw new HttpError(404,'File content unavailable; run attachment backfill before deployment');createReadStream(path).pipe(res);}));

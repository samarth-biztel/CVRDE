import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, createReadStream, promises as fs } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, one, query } from './db.js';
import { currentUser, getProject, handler, history, HttpError, projectManager, projectMember, taskAccess, taskById, uid } from './core.js';

export const fileRoutes=Router();
const dir=process.env.UPLOAD_DIR || './uploads';mkdirSync(dir,{recursive:true});
const allowed=new Set(['.pdf','.docx','.xlsx','.pptx','.csv','.txt','.png','.jpg','.jpeg']);
const mime:Record<string,string>={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.csv':'text/csv','.txt':'text/plain','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const upload=multer({storage:multer.diskStorage({destination:dir,filename:(_req,_file,cb)=>cb(null,randomUUID())}),limits:{fileSize:20*1024*1024},fileFilter:(_req,file,cb)=>cb(null,allowed.has(extname(file.originalname).toLowerCase()))});
type Attachment={id:number;project_id:number;task_id:number|null;document_key:string;version_no:number;stored_name:string;original_name:string;mime_type:string;size_bytes:number};
async function validateFile(path:string,name:string){
  const ext=extname(name).toLowerCase(),f=await fs.open(path,'r');let bytes:Buffer;
  try{bytes=Buffer.alloc(8);await f.read(bytes,0,8,0);}finally{await f.close();}
  const starts=(signature:number[])=>signature.every((b,i)=>bytes[i]===b);
  const okay=ext==='.pdf'?starts([0x25,0x50,0x44,0x46]):ext==='.png'?starts([0x89,0x50,0x4e,0x47]):['.jpg','.jpeg'].includes(ext)?starts([0xff,0xd8,0xff]):['.docx','.xlsx','.pptx'].includes(ext)?starts([0x50,0x4b]):true;
  if(!okay)throw new HttpError(400,'File content does not match extension');
  if(['.docx','.xlsx','.pptx'].includes(ext)){
    const data=await fs.readFile(path);let end=-1;
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
    const data=await fs.readFile(path);
    try{new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{throw new HttpError(400,'Text file must use UTF-8');}
    if(data.includes(0))throw new HttpError(400,'Text file contains binary data');
  }
}
const input=z.object({document_key:z.string().trim().min(1).max(100),result_id:z.coerce.number().int().positive().optional()});
fileRoutes.post('/tasks/:taskId/attachments',upload.single('file'),handler(async(req,res)=>{
  const file=req.file;if(!file)throw new HttpError(400,'Allowed file required');
  try{
    const user=currentUser(res),task=await taskById(uid(req.params.taskId));if(user.id!==task.owner_id)throw new HttpError(403,'Owner only');
    const data=input.parse(req.body);await validateFile(file.path,file.originalname);
    if(data.result_id){const result=await one<{task_id:number}>(db,'SELECT task_id FROM task_results WHERE id=$1',[data.result_id]);if(!result || result.task_id!==task.id)throw new HttpError(400,'Invalid result');}
    const row=await db.transaction().execute(async tx=>{
      const item=await one<Attachment>(tx,`INSERT INTO attachments(project_id,task_id,result_id,document_key,version_no,original_name,stored_name,mime_type,size_bytes,uploaded_by) VALUES($1,$2,$3,$4,(SELECT coalesce(max(version_no),0)+1 FROM attachments WHERE project_id=$1 AND document_key=$4),$5,$6,$7,$8,$9) RETURNING *`,[task.project_id,task.id,data.result_id||null,`task:${task.id}:${data.document_key}`,basename(file.originalname),file.filename,mime[extname(file.originalname).toLowerCase()],file.size,user.id]);
      await history(tx,task.project_id,task.id,'ATTACHMENT_UPLOADED',user.id,{attachment_id:item!.id,version_no:item!.version_no});return item;
    });res.status(201).json(row);
  }catch(error){await fs.unlink(file.path).catch(()=>{});throw error;}
}));
fileRoutes.get('/tasks/:taskId/attachments',handler(async(req,res)=>{const user=currentUser(res),task=await taskById(uid(req.params.taskId));await taskAccess(user,task,'RESULTS');res.json(await query(db,'SELECT id,project_id,task_id,document_key,version_no,original_name,mime_type,size_bytes,uploaded_at FROM attachments WHERE task_id=$1 ORDER BY document_key,version_no DESC',[task.id]));}));
fileRoutes.post('/projects/:projectId/documents',upload.single('file'),handler(async(req,res)=>{
  const file=req.file;if(!file)throw new HttpError(400,'Allowed file required');
  try{
    const user=currentUser(res),projectId=uid(req.params.projectId);await projectManager(user,projectId);await validateFile(file.path,file.originalname);
    const {document_key}=z.object({document_key:z.string().trim().min(1).max(100)}).parse(req.body);
    const row=await db.transaction().execute(async tx=>{const item=await one<Attachment>(tx,`INSERT INTO attachments(project_id,task_id,document_key,version_no,original_name,stored_name,mime_type,size_bytes,uploaded_by) VALUES($1,NULL,$2,(SELECT coalesce(max(version_no),0)+1 FROM attachments WHERE project_id=$1 AND document_key=$2),$3,$4,$5,$6,$7) RETURNING *`,[projectId,`project:${document_key}`,basename(file.originalname),file.filename,mime[extname(file.originalname).toLowerCase()],file.size,user.id]);await history(tx,projectId,null,'PROJECT_DOCUMENT_UPLOADED',user.id,{attachment_id:item!.id,version_no:item!.version_no});return item;});res.status(201).json(row);
  }catch(error){await fs.unlink(file.path).catch(()=>{});throw error;}
}));
fileRoutes.get('/projects/:projectId/documents',handler(async(req,res)=>{const user=currentUser(res),projectId=uid(req.params.projectId);await projectMember(user,projectId);res.json(await query(db,'SELECT id,project_id,document_key,version_no,original_name,mime_type,size_bytes,uploaded_at FROM attachments WHERE project_id=$1 AND task_id IS NULL ORDER BY document_key,version_no DESC',[projectId]));}));
async function attachmentFor(user:ReturnType<typeof currentUser>,id:number){const item=await one<Attachment>(db,'SELECT * FROM attachments WHERE id=$1',[id]);if(!item)throw new HttpError(404,'Attachment not found');if(item.task_id){const task=await taskById(item.task_id);await taskAccess(user,task,'RESULTS');}else await projectMember(user,item.project_id);return item;}
fileRoutes.get('/attachments/:attachmentId/versions',handler(async(req,res)=>{const user=currentUser(res),item=await attachmentFor(user,uid(req.params.attachmentId));res.json(await query(db,'SELECT id,document_key,version_no,original_name,mime_type,size_bytes,uploaded_at FROM attachments WHERE project_id=$1 AND document_key=$2 ORDER BY version_no DESC',[item.project_id,item.document_key]));}));
fileRoutes.get('/attachments/:attachmentId/download',handler(async(req,res)=>{const user=currentUser(res),item=await attachmentFor(user,uid(req.params.attachmentId));const path=join(dir,item.stored_name);await fs.access(path);res.setHeader('Content-Type',item.mime_type);res.setHeader('Content-Disposition',`attachment; filename="${item.original_name.replace(/["\r\n]/g,'_')}"`);createReadStream(path).pipe(res);}));

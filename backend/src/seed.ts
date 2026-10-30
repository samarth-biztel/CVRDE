import './env.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { db, one, query, pool } from './db.js';
import { history } from './core.js';
import { demoPassword } from './demo.js';

const password=demoPassword;
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const demo='Engine Component Development — Demo';
const hash=await bcrypt.hash(password,12);
const ids:Record<string,number>={};
const xml=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function docx(text:string){return zipSync({
  '[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
  'word/document.xml':strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${xml(text)}</w:t></w:r></w:p></w:body></w:document>`)
});}
function xlsx(value:string){return zipSync({
  '[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
  '_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
  'xl/workbook.xml':strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Results" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
  'xl/worksheets/sheet1.xml':strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${xml(value)}</t></is></c></row></sheetData></worksheet>`)
});}
function pdf(text:string){const safe=text.replace(/[()\\]/g,'');const stream=`BT /F1 16 Tf 50 750 Td (${safe}) Tj ET`;const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
];let result='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(result));result+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const start=Buffer.byteLength(result);result+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(result);}

try{
  await db.transaction().execute(async tx=>{
    const demoUsers:[string,string,string,string][]=[
      ['pm.demo','Demo Project Manager','PM',process.env.DEMO_EMAIL_PM || 'pm.demo@example.invalid'],
      ['scientist1.demo','Demo Scientist One','MEMBER',process.env.DEMO_EMAIL_S1 || 'scientist1.demo@example.invalid'],
      ['scientist2.demo','Demo Scientist Two','MEMBER',process.env.DEMO_EMAIL_S2 || 'scientist2.demo@example.invalid'],
      ['reviewer.demo','Demo Reviewer','REVIEWER',process.env.DEMO_EMAIL_REVIEWER || 'reviewer.demo@example.invalid'],
      ['admin.demo','Demo Administrator','ADMIN','admin.demo@example.invalid']
    ];
    for(const [username,full_name,role,email] of demoUsers){
      const row=await one<{id:number}>(tx,`INSERT INTO users(username,password_hash,full_name,email,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,full_name=excluded.full_name,email=excluded.email,role=excluded.role,active=true RETURNING id`,[username,hash,full_name,email,role]);ids[username]=row!.id;
    }
    await query(tx,'DELETE FROM projects WHERE name=$1 AND manager_id=$2',[demo,ids['pm.demo']]);
    const project=await one<{id:number}>(tx,'INSERT INTO projects(name,description,target_date,manager_id) VALUES($1,$2,$3,$4) RETURNING id',[demo,'Fictional pilot project',day(60),ids['pm.demo']]);const pid=project!.id;
    for(const username of ['scientist1.demo','scientist2.demo'])await query(tx,'INSERT INTO project_members(project_id,user_id) VALUES($1,$2)',[pid,ids[username]]);
    const test=await one<{id:number}>(tx,'INSERT INTO project_groups(project_id,name,can_view_results,can_comment,can_link_pendency,created_by) VALUES($1,$2,true,true,true,$3) RETURNING id',[pid,'Test programme team',ids['pm.demo']]);
    const thermal=await one<{id:number}>(tx,'INSERT INTO project_groups(project_id,name,can_view_results,can_comment,can_link_pendency,created_by) VALUES($1,$2,false,true,true,$3) RETURNING id',[pid,'Thermal team',ids['pm.demo']]);
    for(const [g,m] of [[test!.id,ids['scientist1.demo']],[test!.id,ids['scientist2.demo']],[thermal!.id,ids['scientist2.demo']]])await query(tx,'INSERT INTO group_members(group_id,user_id,added_by) VALUES($1,$2,$3)',[g,m,ids['pm.demo']]);
    async function task(title:string,owner:number,due:number,status:string,priority:string,parent:number|null=null,group:number|null=null){const row=await one<{id:number}>(tx,`INSERT INTO tasks(project_id,parent_task_id,title,description,owner_id,priority,due_date,status,visibility,group_id,created_by,plm_ref) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,[pid,parent,title,`Demo task: ${title}`,owner,priority,day(due),status,group?'GROUP':'PRIVATE',group,ids['pm.demo'],'DEMO-PLM-001']);await history(tx,pid,row!.id,'TASK_CREATED',ids['pm.demo'],{title,owner_id:owner});return row!.id;}
    const parent=await task('Component test programme',ids['scientist1.demo'],30,'IN_PROGRESS','MEDIUM');
    const calibration=await task('Test rig calibration',ids['scientist1.demo'],10,'IN_PROGRESS','MEDIUM',parent);
    await task('Fatigue test setup',ids['scientist1.demo'],20,'NOT_STARTED','MEDIUM',parent);
    const sample=await task('Material sample testing',ids['scientist1.demo'],-5,'IN_PROGRESS','HIGH',null,thermal!.id);
    const report=await task('Thermal analysis report',ids['scientist2.demo'],12,'SUBMITTED','HIGH',null,test!.id);
    const drawing=await task('Component drawing review',ids['scientist2.demo'],-10,'DONE','LOW');
    const instrumentation=await task('Instrumentation readiness review',ids['scientist2.demo'],4,'SUBMITTED','HIGH',parent,test!.id);
    const sensor=await task('Sensor calibration records',ids['scientist2.demo'],-2,'IN_PROGRESS','HIGH',instrumentation,thermal!.id);
    const vibration=await task('Vibration test matrix',ids['scientist1.demo'],14,'NOT_STARTED','MEDIUM',parent,test!.id);
    const coupon=await task('Coupon batch traceability',ids['scientist1.demo'],6,'IN_PROGRESS','MEDIUM',parent);
    const fixture=await task('Fixture drawing release',ids['scientist2.demo'],22,'NOT_STARTED','LOW');
    const safety=await task('Test cell safety checklist',ids['scientist1.demo'],-3,'DONE','HIGH',parent);
    await task('Thermal soak procedure',ids['scientist2.demo'],18,'NOT_STARTED','MEDIUM',parent,thermal!.id);
    await task('Load case correlation',ids['scientist2.demo'],26,'IN_PROGRESS','MEDIUM',null,test!.id);
    await task('Failure mode review',ids['scientist1.demo'],35,'NOT_STARTED','HIGH',parent);
    await task('Prototype inspection plan',ids['scientist1.demo'],9,'IN_PROGRESS','LOW');
    await task('Final evidence package',ids['scientist2.demo'],45,'NOT_STARTED','MEDIUM',parent);
    const instrumentationResult=await one<{id:number}>(tx,'INSERT INTO task_results(task_id,version_no,work_completed,outcome,submitted_by) VALUES($1,1,$2,$3,$4) RETURNING id',[instrumentation,'Reviewed channel map and sensor locations','Ready for manager review',ids['scientist2.demo']]);
    const safetyResult=await one<{id:number}>(tx,"INSERT INTO task_results(task_id,version_no,work_completed,outcome,submitted_by,review_status,reviewed_by,reviewed_at) VALUES($1,1,$2,$3,$4,'ACCEPTED',$5,now()) RETURNING id",[safety,'Safety checks done','Test cell cleared',ids['scientist1.demo'],ids['pm.demo']]);
    for(const [taskId,author,body] of [
      [calibration,ids['scientist1.demo'],'Calibration sequence started; awaiting cross-check of the thermal channel.'],
      [instrumentation,ids['scientist2.demo'],'Updated channel map attached to the review package.'],
      [coupon,ids['scientist1.demo'],'Batch records received from the materials lab.'],
      [sensor,ids['scientist2.demo'],'Two thermocouples need a repeat check before sign-off.'],
      [fixture,ids['pm.demo'],'Please align the release drawing with the latest test rig revision.']
    ] as [number,number,string][])await query(tx,'INSERT INTO task_comments(task_id,author_id,body) VALUES($1,$2,$3)',[taskId,author,body]);
    await query(tx,'INSERT INTO reassignments(task_id,original_owner_id,new_owner_id,reason,requested_by,reviewer_id,work_from,work_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[fixture,ids['scientist2.demo'],ids['scientist1.demo'],'Balance drawing review workload',ids['pm.demo'],ids['reviewer.demo'],day(1),day(14)]);
    await query(tx,'INSERT INTO due_date_extensions(task_id,requested_by,old_due_date,new_due_date,reason) VALUES($1,$2,$3,$4,$5)',[sensor,ids['scientist2.demo'],day(-2),day(5),'Replacement sensor arriving this week']);
    const p2=await one<{id:number}>(tx,"INSERT INTO pendencies(raised_by,blocked_task_id,responsible_user_id,type,description,needs_approval,approver_id,status) VALUES($1,$2,$3,'ACTION',$4,true,$5,'AWAITING_APPROVAL') RETURNING id",[ids['scientist1.demo'],vibration,ids['scientist2.demo'],'Confirm fixture availability for vibration setup',ids['pm.demo']]);
    await query(tx,'INSERT INTO pendency_dependencies(pendency_id,depends_on_task_id) VALUES($1,$2)',[p2!.id,fixture]);
    await query(tx,'INSERT INTO due_date_extensions(task_id,requested_by,old_due_date,new_due_date,reason) VALUES($1,$2,$3,$4,$5)',[sample,ids['scientist1.demo'],day(-5),day(7),'Awaiting additional test material']);
    const p=await one<{id:number}>(tx,`INSERT INTO pendencies(raised_by,blocked_task_id,responsible_user_id,type,description,needs_approval,approver_id,status) VALUES($1,$2,$3,'CLARIFICATION',$4,false,$5,'OPEN') RETURNING id`,[ids['scientist1.demo'],calibration,ids['scientist2.demo'],'Confirm thermal analysis inputs',ids['pm.demo']]);
    await query(tx,'INSERT INTO pendency_dependencies(pendency_id,depends_on_task_id) VALUES($1,$2)',[p!.id,report]);
    const v1=await one<{id:number}>(tx,"INSERT INTO task_results(task_id,version_no,work_completed,outcome,submitted_by,review_status,reviewed_by,reviewed_at,review_comment) VALUES($1,1,$2,$3,$4,'RETURNED',$5,now(),$6) RETURNING id",[report,'Initial thermal model','First pass done',ids['scientist2.demo'],ids['pm.demo'],'Revise assumptions']);
    const v2=await one<{id:number}>(tx,"INSERT INTO task_results(task_id,version_no,work_completed,outcome,submitted_by) VALUES($1,2,$2,$3,$4) RETURNING id",[report,'Revised thermal model','Updated values ready for review',ids['scientist2.demo']]);
    const accepted=await one<{id:number}>(tx,"INSERT INTO task_results(task_id,version_no,work_completed,outcome,submitted_by,review_status,reviewed_by,reviewed_at) VALUES($1,1,$2,$3,$4,'ACCEPTED',$5,now()) RETURNING id",[drawing,'Drawing checked','Review complete',ids['scientist2.demo'],ids['pm.demo']]);
    async function attachment(name:string,data:Uint8Array,mime:string,key:string,taskId:number|null,resultId:number|null,version:number){await query(tx,'INSERT INTO attachments(project_id,task_id,result_id,document_key,version_no,original_name,stored_name,mime_type,size_bytes,uploaded_by,content) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[pid,taskId,resultId,key,version,name,randomUUID(),mime,data.length,taskId?ids['scientist2.demo']:ids['pm.demo'],Buffer.from(data)]);}
    await attachment('thermal_results.xlsx',xlsx('Thermal results version 1'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',`task:${report}:thermal_results`,report,v1!.id,1);
    await attachment('thermal_results.xlsx',xlsx('Thermal results version 2'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',`task:${report}:thermal_results`,report,v2!.id,2);
    await attachment('instrumentation_channel_map.txt',strToU8('Verified sensor channel map'),'text/plain',`task:${instrumentation}:channel_map`,instrumentation,instrumentationResult!.id,1);
    await attachment('safety_checklist.txt',strToU8('Completed test cell safety checks'),'text/plain',`task:${safety}:checklist`,safety,safetyResult!.id,1);
    await attachment('review_notes.pdf',pdf('Demo drawing review notes'),'application/pdf',`task:${drawing}:review_notes`,drawing,accepted!.id,1);
    await attachment('Kick-off meeting minutes.docx',docx('Fictional kick-off meeting minutes version 1'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document','project:meeting_minutes',null,null,1);
    await attachment('Kick-off meeting minutes.docx',docx('Fictional kick-off meeting minutes version 2'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document','project:meeting_minutes',null,null,2);
    await history(tx,pid,report,'RESULT_SUBMITTED',ids['scientist2.demo'],{version_no:1});await history(tx,pid,report,'RESULT_REVIEWED',ids['pm.demo'],{review:'RETURNED'});await history(tx,pid,report,'RESULT_SUBMITTED',ids['scientist2.demo'],{version_no:2});
    await history(tx,pid,sample,'TASK_UPDATED',ids['pm.demo'],{priority:{old:'LOW',new:'HIGH'}});
    await history(tx,pid,sample,'EXTENSION_REQUESTED',ids['scientist1.demo'],{old_due_date:day(-5),new_due_date:day(7)});
    await history(tx,pid,calibration,'PENDENCY_RAISED',ids['scientist1.demo'],{pendency_id:p!.id});
  });
  console.log(`Demo project reset; usernames: ${Object.keys(ids).join(', ')}. Public demo password: ${demoPassword}.`);
}finally{await pool.end();}

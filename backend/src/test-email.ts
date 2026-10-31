import './env.js';
import { db, one, pool } from './db.js';
import { notify } from './core.js';

if(process.env.EMAIL_ENABLED!=='true'||!process.env.SMTP_HOST)throw new Error('EMAIL_ENABLED=true and SMTP_HOST are required for email verification');
try{
  const user=await one<{id:number;email:string}>(db,"SELECT id,email FROM users WHERE username='pm.demo'");
  if(!user)throw new Error('Run the demo seed first');
  const task=await one<{id:number}>(db,"SELECT id FROM tasks WHERE created_by<>$1 ORDER BY id DESC LIMIT 1",[user.id]);
  if(!task)throw new Error('No suitable demo task found');
  await notify('SUBMITTED',user.id,task.id,'CVRDE demo SMTP check','This is a fictional email delivery test.');
  const result=await one<{delivery_status:string}>(db,"SELECT delivery_status FROM notification_log WHERE event_type='SUBMITTED' AND to_user_id=$1 AND task_id=$2 ORDER BY id DESC LIMIT 1",[user.id,task.id]);
  if(result?.delivery_status!=='SENT')throw new Error('Test email was not sent; check SMTP settings and notification_log');
  console.log(`Test email sent to ${user.email}`);
}finally{await pool.end();}

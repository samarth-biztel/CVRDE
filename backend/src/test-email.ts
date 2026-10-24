import './env.js';
import { db, one, pool } from './db.js';
import { notify } from './core.js';

if(!process.env.SMTP_HOST)throw new Error('SMTP_HOST is required for email verification');
try{
  const user=await one<{id:number;email:string}>(db,"SELECT id,email FROM users WHERE username='pm.demo'");
  if(!user)throw new Error('Run the demo seed first');
  await notify('TEST_EMAIL',user.id,null,'CVRDE demo SMTP check','This is a fictional pilot email delivery test.');
  const result=await one<{delivery_status:string}>(db,"SELECT delivery_status FROM notification_log WHERE event_type='TEST_EMAIL' AND to_user_id=$1 ORDER BY id DESC LIMIT 1",[user.id]);
  if(result?.delivery_status!=='SENT')throw new Error('Test email was not sent; check SMTP settings and notification_log');
  console.log(`Test email sent to ${user.email}`);
}finally{await pool.end();}

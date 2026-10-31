import assert from 'node:assert/strict';
import '../backend/dist/env.js';
import {db,query,pool} from '../backend/dist/db.js';

const taskId=Number(process.argv[2]);
assert.ok(Number.isSafeInteger(taskId)&&taskId>0,'Pass the hosted walkthrough task ID');
try{
  const rows=await query(db,`SELECT t.title,n.event_type,n.delivery_status,n.error FROM notification_log n JOIN tasks t ON t.id=n.task_id WHERE (t.id=$1 OR (t.title='Share revised valve timing assumptions with Prototype Build' AND t.created_at>now()-interval '15 minutes')) ORDER BY n.id`,[taskId]);
  for(const row of rows)console.log(`${row.title} | ${row.event_type} | ${row.delivery_status}${row.error?` | ${row.error}`:''}`);
}finally{await pool.end()}

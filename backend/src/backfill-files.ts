import './env.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db, query, pool } from './db.js';

const directory=process.env.UPLOAD_DIR || './uploads';
let copied=0,missing=0;
try{
  const rows=await query<{id:number;stored_name:string}>(db,'SELECT id,stored_name FROM attachments WHERE content IS NULL ORDER BY id');
  for(const row of rows){
    try{
      const content=await readFile(join(directory,row.stored_name));
      await query(db,'UPDATE attachments SET content=$1 WHERE id=$2 AND content IS NULL',[content,row.id]);
      copied++;
    }catch(error){
      if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
      missing++;
    }
  }
  console.log(`Attachment backfill: ${copied} copied, ${missing} missing local files.`);
  if(missing)process.exitCode=1;
}finally{await pool.end();}

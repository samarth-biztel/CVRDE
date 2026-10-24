import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db, one, query } from './db.js';
import { authenticate, currentUser, getProject, handler, history, HttpError, issueSession, notify, projectManager, projectMember, role, taskAccess, taskById, uid, visibleTaskIds, type Task, type User } from './core.js';
import { fileRoutes } from './files.js';

export const api = Router();
const parse = <T extends z.ZodTypeAny>(schema:T,value:unknown):z.infer<T> => schema.parse(value);
const id = (value:unknown) => uid(value);
const send = (res:import('express').Response,value:unknown,status=200) => res.status(status).json(value);
const nonempty = z.string().trim().min(1).max(5000);
const taskInput = z.object({title:z.string().trim().min(1).max(200),description:z.string().max(10000).default(''),owner_id:z.number().int().positive(),priority:z.enum(['LOW','MEDIUM','HIGH']).default('MEDIUM'),due_date:z.string().date().nullable().optional(),parent_task_id:z.number().int().positive().nullable().optional(),plm_ref:z.string().max(100).nullable().optional()});

const attempts = new Map<string,{count:number;until:number}>();
api.post('/auth/login',handler(async(req,res)=>{
  const {username,password}=parse(z.object({username:z.string().min(1),password:z.string().min(1)}),req.body);
  const key=req.ip || 'unknown', now=Date.now(), entry=attempts.get(key);
  if(entry && entry.count>=10 && entry.until>now) throw new HttpError(429,'Too many login attempts');
  const user=await one<User & {password_hash:string;active:boolean}>(db,'SELECT * FROM users WHERE username=$1',[username]);
  if(!user || !user.active || !(await bcrypt.compare(password,user.password_hash))){
    attempts.set(key,{count:(entry?.until && entry.until>now ? entry.count : 0)+1,until:now+15*60_000});
    throw new HttpError(401,'Invalid credentials');
  }
  attempts.delete(key); await issueSession(res,user.id);
  send(res,{id:user.id,username:user.username,full_name:user.full_name,role:user.role});
}));
api.use(authenticate);
api.post('/auth/logout',handler(async(req,res)=>{
  const token=req.cookies?.cvrde_session;
  if(typeof token==='string') await query(db,'DELETE FROM sessions WHERE token_hash=$1',[createHash('sha256').update(token).digest('hex')]);
  res.clearCookie('cvrde_session',{path:'/'});send(res,{ok:true});
}));
api.get('/auth/me',handler(async(_req,res)=>{send(res,currentUser(res));}));
api.get('/users',handler(async(_req,res)=>{const u=currentUser(res);const rows=await query(db,"SELECT id,username,full_name,role FROM users WHERE active AND ($1='PM' OR role IN ('MEMBER','REVIEWER')) ORDER BY id",[u.role]);send(res,rows);}));

api.get('/projects',handler(async(_req,res)=>{
  const u=currentUser(res);
  send(res,await query(db,`SELECT DISTINCT p.* FROM projects p LEFT JOIN project_members pm ON pm.project_id=p.id WHERE p.manager_id=$1 OR pm.user_id=$1 ORDER BY p.id DESC`,[u.id]));
}));
api.post('/projects',handler(async(req,res)=>{
  const u=currentUser(res);role(u,['PM']);
  const data=parse(z.object({name:z.string().trim().min(1).max(200),description:z.string().max(10000).default(''),target_date:z.string().date().nullable().optional()}),req.body);
  const p=await db.transaction().execute(async tx=>{const project=await one<{id:number}>(tx,'INSERT INTO projects(name,description,target_date,manager_id) VALUES($1,$2,$3,$4) RETURNING *',[data.name,data.description,data.target_date || null,u.id]);await history(tx,project!.id,null,'PROJECT_CREATED',u.id,{name:data.name});return project;});
  send(res,p,201);
}));
api.get('/projects/:projectId',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);send(res,await getProject(pid));}));
api.post('/projects/:projectId/members',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const {user_id}=parse(z.object({user_id:z.number().int().positive()}),req.body);
  const member=await one<User>(db,"SELECT * FROM users WHERE id=$1 AND role='MEMBER' AND active",[user_id]);if(!member)throw new HttpError(400,'Active member required');
  await query(db,'INSERT INTO project_members(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[pid,user_id]);
  await history(db,pid,null,'PROJECT_MEMBER_ADDED',u.id,{user_id});send(res,{ok:true},201);
}));
api.get('/projects/:projectId/members',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);send(res,await query(db,'SELECT u.id,u.full_name,u.username,u.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY u.id',[pid]));}));

api.get('/projects/:projectId/tasks',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);
  send(res,await query(db,`SELECT t.*,u.full_name AS owner_name FROM tasks t JOIN users u ON u.id=t.owner_id JOIN projects p ON p.id=t.project_id WHERE t.project_id=$1 AND (p.manager_id=$2 OR t.owner_id=$2 OR (t.visibility='GROUP' AND EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=t.group_id AND gm.user_id=$2))) ORDER BY t.id`,[pid,u.id]));
}));
api.get('/tasks/mine',handler(async(_req,res)=>{
  const u=currentUser(res);role(u,['MEMBER']);
  send(res,await query(db,`SELECT t.*,p.name AS project_name FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.owner_id=$1 OR (t.visibility='GROUP' AND EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=t.group_id AND gm.user_id=$1)) ORDER BY t.due_date NULLS LAST,t.id`,[u.id]));
}));
api.post('/projects/:projectId/tasks',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const d=parse(taskInput,req.body);
  const member=await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[pid,d.owner_id]);if(!member)throw new HttpError(400,'Owner must belong to project');
  let parent:Task|undefined;
  if(d.parent_task_id){parent=await taskById(d.parent_task_id);if(parent.project_id!==pid)throw new HttpError(400,'Parent must belong to project');}
  const task=await db.transaction().execute(async tx=>{
    const row=await one<Task>(tx,`INSERT INTO tasks(project_id,parent_task_id,title,description,owner_id,priority,due_date,status,visibility,group_id,plm_ref,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,'NEW',$8,$9,$10,$11) RETURNING *`,[pid,d.parent_task_id || null,d.title,d.description,d.owner_id,d.priority,d.due_date || null,parent?.visibility || 'PRIVATE',parent?.group_id || null,d.plm_ref || null,u.id]);
    await history(tx,pid,row!.id,'TASK_CREATED',u.id,{title:d.title,owner_id:d.owner_id});return row!;
  });
  await notify('ASSIGNED',d.owner_id,task.id,`Task assigned: ${task.title}`,`Project ${pid}: ${task.title}`);
  send(res,task,201);
}));
api.get('/tasks/:taskId',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId)),access=await taskAccess(u,task,'VIEW');
  send(res,access==='LIMITED'?{id:task.id,title:task.title,status:task.status,limited:true}:task);
}));
api.patch('/tasks/:taskId',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await taskAccess(u,task,'EDIT');
  const d=parse(z.object({title:z.string().trim().min(1).max(200).optional(),description:z.string().max(10000).optional(),priority:z.enum(['LOW','MEDIUM','HIGH']).optional(),due_date:z.string().date().nullable().optional(),plm_ref:z.string().max(100).nullable().optional(),parent_task_id:z.number().int().positive().nullable().optional()}).strict(),req.body);
  if(!Object.keys(d).length)throw new HttpError(400,'No changes');
  if(d.parent_task_id){const parent=await taskById(d.parent_task_id);if(parent.project_id!==task.project_id || parent.id===task.id)throw new HttpError(400,'Invalid parent');}
  const allowed=['title','description','priority','due_date','plm_ref','parent_task_id'] as const;
  const updates=Object.entries(d).filter(([k])=>allowed.includes(k as typeof allowed[number]));
  const diff=Object.fromEntries(updates.map(([k,v])=>[k,{old:(task as unknown as Record<string,unknown>)[k],new:v}]));
  const result=await db.transaction().execute(async tx=>{
    const values=updates.map(([,v])=>v);
    const clause=updates.map(([k],i)=>`${k}=$${i+1}`).join(',');
    const row=await one(tx,`UPDATE tasks SET ${clause},updated_at=now() WHERE id=$${values.length+1} RETURNING *`,[...values,task.id]);
    await history(tx,task.project_id,task.id,'TASK_UPDATED',u.id,diff);return row;
  });send(res,result);
}));
api.post('/tasks/:taskId/status',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(task.owner_id!==u.id)throw new HttpError(403,'Owner only');
  if(task.status!=='NEW')throw new HttpError(409,'Only New can be started');
  await db.transaction().execute(async tx=>{await query(tx,"UPDATE tasks SET status='IN_PROGRESS',updated_at=now() WHERE id=$1",[task.id]);await history(tx,task.project_id,task.id,'STATUS_CHANGED',u.id,{old:'NEW',new:'IN_PROGRESS'});});
  await notify('STATUS_CHANGED',task.manager_id,task.id,`Task started: ${task.title}`,task.title);send(res,{status:'IN_PROGRESS'});
}));
api.post('/tasks/:taskId/comments',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await taskAccess(u,task,'COMMENT');const {body}=parse(z.object({body:nonempty}),req.body);
  const row=await db.transaction().execute(async tx=>{const item=await one(tx,'INSERT INTO task_comments(task_id,author_id,body) VALUES($1,$2,$3) RETURNING *',[task.id,u.id,body]);await history(tx,task.project_id,task.id,'COMMENT_ADDED',u.id,{comment_id:(item as {id:number}).id});return item;});send(res,row,201);
}));
api.get('/tasks/:taskId/comments',handler(async(req,res)=>{const u=currentUser(res),task=await taskById(id(req.params.taskId));if(await taskAccess(u,task,'VIEW')==='LIMITED')throw new HttpError(403,'Forbidden');send(res,await query(db,'SELECT c.*,u.full_name AS author_name FROM task_comments c JOIN users u ON u.id=c.author_id WHERE c.task_id=$1 ORDER BY c.created_at,c.id',[task.id]));}));

api.get('/projects/:projectId/groups',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);send(res,await query(db,`SELECT g.*,array_remove(array_agg(gm.user_id::int),NULL) AS member_ids FROM project_groups g LEFT JOIN group_members gm ON gm.group_id=g.id WHERE g.project_id=$1 GROUP BY g.id ORDER BY g.id`,[pid]));}));
api.post('/projects/:projectId/groups',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const d=parse(z.object({name:z.string().trim().min(1).max(100),description:z.string().max(1000).default(''),can_view_results:z.boolean().default(false),can_comment:z.boolean().default(true),can_link_pendency:z.boolean().default(true)}),req.body);
  const row=await db.transaction().execute(async tx=>{const g=await one<{id:number}>(tx,'INSERT INTO project_groups(project_id,name,description,can_view_results,can_comment,can_link_pendency,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[pid,d.name,d.description,d.can_view_results,d.can_comment,d.can_link_pendency,u.id]);await history(tx,pid,null,'GROUP_CREATED',u.id,{group_id:g!.id,name:d.name});return g;});send(res,row,201);
}));
api.patch('/groups/:groupId',handler(async(req,res)=>{
  const u=currentUser(res),gid=id(req.params.groupId),group=await one<{project_id:number}>(db,'SELECT * FROM project_groups WHERE id=$1',[gid]);if(!group)throw new HttpError(404,'Group not found');await projectManager(u,group.project_id);
  const d=parse(z.object({name:z.string().trim().min(1).max(100).optional(),description:z.string().max(1000).optional(),can_view_results:z.boolean().optional(),can_comment:z.boolean().optional(),can_link_pendency:z.boolean().optional()}).strict(),req.body);
  if(!Object.keys(d).length)throw new HttpError(400,'No changes');const entries=Object.entries(d);
  const row=await db.transaction().execute(async tx=>{const g=await one(tx,`UPDATE project_groups SET ${entries.map(([k],i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${entries.length+1} RETURNING *`,[...entries.map(([,v])=>v),gid]);await history(tx,group.project_id,null,'GROUP_UPDATED',u.id,{group_id:gid,changes:d});return g;});send(res,row);
}));
api.delete('/groups/:groupId',handler(async(req,res)=>{
  const u=currentUser(res),gid=id(req.params.groupId),group=await one<{project_id:number}>(db,'SELECT * FROM project_groups WHERE id=$1',[gid]);if(!group)throw new HttpError(404,'Group not found');await projectManager(u,group.project_id);
  await db.transaction().execute(async tx=>{await query(tx,"UPDATE tasks SET visibility='PRIVATE',group_id=NULL WHERE group_id=$1",[gid]);await query(tx,'DELETE FROM project_groups WHERE id=$1',[gid]);await history(tx,group.project_id,null,'GROUP_DELETED',u.id,{group_id:gid});});send(res,{ok:true});
}));
api.post('/groups/:groupId/members',handler(async(req,res)=>{
  const u=currentUser(res),gid=id(req.params.groupId),group=await one<{project_id:number}>(db,'SELECT project_id FROM project_groups WHERE id=$1',[gid]);if(!group)throw new HttpError(404,'Group not found');await projectManager(u,group.project_id);
  const {user_id}=parse(z.object({user_id:z.number().int().positive()}),req.body);
  if(!await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[group.project_id,user_id]))throw new HttpError(400,'User is not a project member');
  await db.transaction().execute(async tx=>{await query(tx,'INSERT INTO group_members(group_id,user_id,added_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[gid,user_id,u.id]);await history(tx,group.project_id,null,'GROUP_MEMBER_ADDED',u.id,{group_id:gid,user_id});});send(res,{ok:true},201);
}));
api.delete('/groups/:groupId/members/:userId',handler(async(req,res)=>{
  const u=currentUser(res),gid=id(req.params.groupId),memberId=id(req.params.userId),group=await one<{project_id:number}>(db,'SELECT project_id FROM project_groups WHERE id=$1',[gid]);if(!group)throw new HttpError(404,'Group not found');await projectManager(u,group.project_id);
  await db.transaction().execute(async tx=>{await query(tx,'DELETE FROM group_members WHERE group_id=$1 AND user_id=$2',[gid,memberId]);await history(tx,group.project_id,null,'GROUP_MEMBER_REMOVED',u.id,{group_id:gid,user_id:memberId});});send(res,{ok:true});
}));
api.patch('/tasks/:taskId/visibility',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(u.id!==task.manager_id && u.id!==task.owner_id)throw new HttpError(403,'Forbidden');
  const d=parse(z.object({group_id:z.number().int().positive().nullable()}),req.body);
  if(d.group_id){const g=await one<{project_id:number}>(db,'SELECT project_id FROM project_groups WHERE id=$1',[d.group_id]);if(!g || g.project_id!==task.project_id)throw new HttpError(400,'Invalid group');if(u.id!==task.manager_id && !await one(db,'SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[d.group_id,u.id]))throw new HttpError(403,'Owner must belong to group');}
  const row=await db.transaction().execute(async tx=>{const t=await one(tx,'UPDATE tasks SET visibility=$1,group_id=$2,updated_at=now() WHERE id=$3 RETURNING *',[d.group_id?'GROUP':'PRIVATE',d.group_id,task.id]);await history(tx,task.project_id,task.id,'VISIBILITY_CHANGED',u.id,{old:task.group_id,new:d.group_id});return t;});send(res,row);
}));

api.post('/tasks/:taskId/extension-requests',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(u.id!==task.owner_id)throw new HttpError(403,'Owner only');
  const d=parse(z.object({new_due_date:z.string().date(),reason:nonempty}),req.body);
  if(task.due_date && d.new_due_date<=task.due_date.slice(0,10))throw new HttpError(400,'New date must be later');
  const row=await db.transaction().execute(async tx=>{const r=await one(tx,"INSERT INTO due_date_extensions(task_id,requested_by,old_due_date,new_due_date,reason) VALUES($1,$2,$3,$4,$5) RETURNING *",[task.id,u.id,task.due_date,d.new_due_date,d.reason]);await history(tx,task.project_id,task.id,'EXTENSION_REQUESTED',u.id,{new_due_date:d.new_due_date,reason:d.reason});return r;});
  await notify('EXTENSION_REQUESTED',task.manager_id,task.id,`Extension requested: ${task.title}`,d.reason);send(res,row,201);
}));
api.post('/extension-requests/:requestId/decision',handler(async(req,res)=>{
  const u=currentUser(res),requestId=id(req.params.requestId),d=parse(z.object({approve:z.boolean(),comment:z.string().max(2000).default('')}),req.body);
  const r=await one<{id:number;task_id:number;requested_by:number;new_due_date:string;status:string}>(db,'SELECT * FROM due_date_extensions WHERE id=$1',[requestId]);if(!r)throw new HttpError(404,'Request not found');
  const task=await taskById(r.task_id);await projectManager(u,task.project_id);if(r.status!=='PENDING')throw new HttpError(409,'Already decided');
  const status=d.approve?'APPROVED':'REJECTED';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE due_date_extensions SET status=$1,decided_by=$2,decided_at=now() WHERE id=$3',[status,u.id,r.id]);if(d.approve)await query(tx,'UPDATE tasks SET due_date=$1,updated_at=now() WHERE id=$2',[r.new_due_date,task.id]);await history(tx,task.project_id,task.id,'EXTENSION_DECIDED',u.id,{status,new_due_date:r.new_due_date,comment:d.comment});});
  await notify('EXTENSION_DECIDED',r.requested_by,task.id,`Extension ${status.toLowerCase()}: ${task.title}`,d.comment || status);send(res,{status});
}));
api.get('/tasks/:taskId/extensions',handler(async(req,res)=>{const u=currentUser(res),task=await taskById(id(req.params.taskId));if(await taskAccess(u,task,'VIEW')==='LIMITED')throw new HttpError(403,'Forbidden');send(res,await query(db,'SELECT * FROM due_date_extensions WHERE task_id=$1 ORDER BY id DESC',[task.id]));}));

api.post('/tasks/:taskId/results',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(u.id!==task.owner_id)throw new HttpError(403,'Owner only');
  if(task.status!=='IN_PROGRESS')throw new HttpError(409,'Task must be In Progress');
  const d=parse(z.object({work_completed:nonempty,outcome:nonempty}),req.body);
  const row=await db.transaction().execute(async tx=>{
    const r=await one(tx,`INSERT INTO task_results(task_id,version_no,work_completed,outcome,submitted_by) VALUES($1,(SELECT coalesce(max(version_no),0)+1 FROM task_results WHERE task_id=$1),$2,$3,$4) RETURNING *`,[task.id,d.work_completed,d.outcome,u.id]);
    await query(tx,"UPDATE tasks SET status='SUBMITTED',updated_at=now() WHERE id=$1",[task.id]);await history(tx,task.project_id,task.id,'RESULT_SUBMITTED',u.id,{result_id:(r as {id:number}).id,version_no:(r as {version_no:number}).version_no,old:'IN_PROGRESS',new:'SUBMITTED'});return r;
  });await notify('STATUS_CHANGED',task.manager_id,task.id,`Result submitted: ${task.title}`,d.outcome);send(res,row,201);
}));
api.get('/tasks/:taskId/results',handler(async(req,res)=>{const u=currentUser(res),task=await taskById(id(req.params.taskId));await taskAccess(u,task,'RESULTS');send(res,await query(db,'SELECT * FROM task_results WHERE task_id=$1 ORDER BY version_no DESC',[task.id]));}));
api.post('/results/:resultId/review',handler(async(req,res)=>{
  const u=currentUser(res),rid=id(req.params.resultId),d=parse(z.object({accept:z.boolean(),comment:z.string().max(3000).default('')}),req.body);
  const r=await one<{id:number;task_id:number;status:string;review_status:string;submitted_by:number}>(db,'SELECT * FROM task_results WHERE id=$1',[rid]);if(!r)throw new HttpError(404,'Result not found');
  const task=await taskById(r.task_id);await projectManager(u,task.project_id);if(task.status!=='SUBMITTED' || r.review_status!=='PENDING')throw new HttpError(409,'Result is not pending review');
  const review=d.accept?'ACCEPTED':'RETURNED', status=d.accept?'COMPLETED':'IN_PROGRESS';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE task_results SET review_status=$1,review_comment=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4',[review,d.comment,u.id,rid]);await query(tx,'UPDATE tasks SET status=$1,updated_at=now() WHERE id=$2',[status,task.id]);await history(tx,task.project_id,task.id,'RESULT_REVIEWED',u.id,{result_id:rid,review,comment:d.comment,old:'SUBMITTED',new:status});});
  await notify('STATUS_CHANGED',r.submitted_by,task.id,`Result ${review.toLowerCase()}: ${task.title}`,d.comment || review);send(res,{review_status:review,status});
}));

api.post('/tasks/:taskId/reassignments',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await projectManager(u,task.project_id);
  const d=parse(z.object({new_owner_id:z.number().int().positive(),reviewer_id:z.number().int().positive(),reason:nonempty}),req.body);
  if(d.new_owner_id===task.owner_id)throw new HttpError(400,'Choose another owner');
  if(!await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[task.project_id,d.new_owner_id]))throw new HttpError(400,'New owner must belong to project');
  if(!await one(db,"SELECT 1 FROM users WHERE id=$1 AND role='REVIEWER' AND active",[d.reviewer_id]))throw new HttpError(400,'Reviewer required');
  const row=await db.transaction().execute(async tx=>{const r=await one(tx,'INSERT INTO reassignments(task_id,original_owner_id,new_owner_id,reason,requested_by,reviewer_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[task.id,task.owner_id,d.new_owner_id,d.reason,u.id,d.reviewer_id]);await history(tx,task.project_id,task.id,'REASSIGNMENT_REQUESTED',u.id,{original_owner_id:task.owner_id,new_owner_id:d.new_owner_id,reviewer_id:d.reviewer_id,reason:d.reason});return r;});
  await notify('REASSIGNMENT_REVIEW',d.reviewer_id,task.id,`Review reassignment: ${task.title}`,d.reason);send(res,row,201);
}));
api.post('/reassignments/:requestId/decision',handler(async(req,res)=>{
  const u=currentUser(res),rid=id(req.params.requestId),d=parse(z.object({approve:z.boolean(),comment:z.string().max(2000).default('')}),req.body);
  const r=await one<{id:number;task_id:number;original_owner_id:number;new_owner_id:number;reviewer_id:number;status:string}>(db,'SELECT * FROM reassignments WHERE id=$1',[rid]);if(!r)throw new HttpError(404,'Request not found');
  if(u.id!==r.reviewer_id || u.role!=='REVIEWER')throw new HttpError(403,'Reviewer only');if(r.status!=='PENDING')throw new HttpError(409,'Already decided');
  const task=await taskById(r.task_id),status=d.approve?'APPROVED':'REJECTED';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE reassignments SET status=$1,decided_at=now() WHERE id=$2',[status,rid]);if(d.approve)await query(tx,'UPDATE tasks SET owner_id=$1,updated_at=now() WHERE id=$2',[r.new_owner_id,task.id]);await history(tx,task.project_id,task.id,'REASSIGNMENT_DECIDED',u.id,{status,old:r.original_owner_id,new:d.approve?r.new_owner_id:r.original_owner_id,comment:d.comment});});
  for(const target of [r.original_owner_id,r.new_owner_id,task.manager_id])await notify('REASSIGNMENT_DECIDED',target,task.id,`Reassignment ${status.toLowerCase()}: ${task.title}`,d.comment || status);send(res,{status});
}));
api.get('/tasks/:taskId/reassignments',handler(async(req,res)=>{const u=currentUser(res),task=await taskById(id(req.params.taskId));if(await taskAccess(u,task,'VIEW')==='LIMITED')throw new HttpError(403,'Forbidden');send(res,await query(db,'SELECT * FROM reassignments WHERE task_id=$1 ORDER BY id DESC',[task.id]));}));

api.post('/pendencies',handler(async(req,res)=>{
  const u=currentUser(res),d=parse(z.object({blocked_task_id:z.number().int().positive(),depends_on_task_ids:z.array(z.number().int().positive()).min(1),responsible_user_id:z.number().int().positive(),type:z.enum(['ACTION','CLARIFICATION','APPROVAL']),description:nonempty,needs_approval:z.boolean().default(true)}),req.body);
  const blocked=await taskById(d.blocked_task_id);if(blocked.owner_id!==u.id)throw new HttpError(403,'Only owner may raise pendency');
  for(const dependencyId of d.depends_on_task_ids){const task=await taskById(dependencyId);if(task.project_id!==blocked.project_id || task.id===blocked.id)throw new HttpError(400,'Invalid dependency');await taskAccess(u,task,'LINK');}
  const responsible=await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[blocked.project_id,d.responsible_user_id]);if(!responsible)throw new HttpError(400,'Responsible user must belong to project');
  const row=await db.transaction().execute(async tx=>{const p=await one<{id:number}>(tx,'INSERT INTO pendencies(raised_by,blocked_task_id,responsible_user_id,type,description,needs_approval,approver_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[u.id,blocked.id,d.responsible_user_id,d.type,d.description,d.needs_approval,blocked.manager_id,d.needs_approval?'AWAITING_APPROVAL':'OPEN']);for(const dep of [...new Set(d.depends_on_task_ids)])await query(tx,'INSERT INTO pendency_dependencies(pendency_id,depends_on_task_id) VALUES($1,$2)',[p!.id,dep]);await history(tx,blocked.project_id,blocked.id,'PENDENCY_RAISED',u.id,{pendency_id:p!.id,dependencies:d.depends_on_task_ids});return p;});
  await notify('PENDENCY_RAISED',d.needs_approval?blocked.manager_id:d.responsible_user_id,blocked.id,`Pendency: ${blocked.title}`,d.description);send(res,row,201);
}));
api.get('/pendencies',handler(async(_req,res)=>{const u=currentUser(res);send(res,await query(db,`SELECT p.* FROM pendencies p JOIN tasks t ON t.id=p.blocked_task_id JOIN projects pr ON pr.id=t.project_id WHERE p.raised_by=$1 OR p.responsible_user_id=$1 OR p.approver_id=$1 OR pr.manager_id=$1 ORDER BY p.id DESC`,[u.id]));}));
api.get('/pendencies/:pendencyId',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.pendencyId);const p=await one<{id:number;blocked_task_id:number;raised_by:number;responsible_user_id:number;approver_id:number}>(db,'SELECT * FROM pendencies WHERE id=$1',[pid]);if(!p)throw new HttpError(404,'Pendency not found');const task=await taskById(p.blocked_task_id);if(![p.raised_by,p.responsible_user_id,p.approver_id,task.manager_id].includes(u.id))throw new HttpError(404,'Pendency not found');send(res,{...p,dependencies:await query(db,'SELECT depends_on_task_id FROM pendency_dependencies WHERE pendency_id=$1',[pid])});}));
api.post('/pendencies/:pendencyId/decision',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.pendencyId),d=parse(z.object({approve:z.boolean(),comment:z.string().max(2000).default('')}),req.body);
  const p=await one<{id:number;blocked_task_id:number;raised_by:number;responsible_user_id:number;approver_id:number;status:string}>(db,'SELECT * FROM pendencies WHERE id=$1',[pid]);if(!p)throw new HttpError(404,'Pendency not found');if(u.id!==p.approver_id || p.status!=='AWAITING_APPROVAL')throw new HttpError(409,'No pending approval');
  const task=await taskById(p.blocked_task_id),status=d.approve?'OPEN':'REJECTED';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE pendencies SET status=$1,resolution=$2 WHERE id=$3',[status,d.comment || null,pid]);await history(tx,task.project_id,task.id,'PENDENCY_DECIDED',u.id,{pendency_id:pid,status,comment:d.comment});});
  await notify('PENDENCY_DECIDED',p.raised_by,task.id,`Pendency ${status.toLowerCase()}: ${task.title}`,d.comment || status);if(d.approve)await notify('PENDENCY_OPEN',p.responsible_user_id,task.id,`Pendency assigned: ${task.title}`,d.comment || task.title);send(res,{status});
}));
api.post('/pendencies/:pendencyId/resolve',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.pendencyId),d=parse(z.object({resolution:nonempty}),req.body);
  const p=await one<{id:number;blocked_task_id:number;raised_by:number;responsible_user_id:number;status:string}>(db,'SELECT * FROM pendencies WHERE id=$1',[pid]);if(!p)throw new HttpError(404,'Pendency not found');if(u.id!==p.responsible_user_id)throw new HttpError(403,'Responsible user only');if(p.status!=='OPEN')throw new HttpError(409,'Pendency is not open');
  const task=await taskById(p.blocked_task_id);
  await db.transaction().execute(async tx=>{await query(tx,"UPDATE pendencies SET status='RESOLVED',resolution=$1,resolved_at=now() WHERE id=$2",[d.resolution,pid]);await history(tx,task.project_id,task.id,'PENDENCY_RESOLVED',u.id,{pendency_id:pid,resolution:d.resolution});});
  await notify('PENDENCY_RESOLVED',p.raised_by,task.id,`Pendency resolved: ${task.title}`,d.resolution);send(res,{status:'RESOLVED'});
}));

api.get('/me/pending-actions',handler(async(_req,res)=>{
  const u=currentUser(res);
  const [results,extensions,reassignments,approvals,resolutions]=await Promise.all([
    query(db,`SELECT r.id,t.id AS task_id,t.title,'RESULT_REVIEW' AS kind FROM task_results r JOIN tasks t ON t.id=r.task_id JOIN projects p ON p.id=t.project_id WHERE p.manager_id=$1 AND r.review_status='PENDING'`,[u.id]),
    query(db,`SELECT e.id,t.id AS task_id,t.title,'EXTENSION' AS kind FROM due_date_extensions e JOIN tasks t ON t.id=e.task_id JOIN projects p ON p.id=t.project_id WHERE p.manager_id=$1 AND e.status='PENDING'`,[u.id]),
    query(db,`SELECT r.id,t.id AS task_id,t.title,'REASSIGNMENT' AS kind FROM reassignments r JOIN tasks t ON t.id=r.task_id WHERE r.reviewer_id=$1 AND r.status='PENDING'`,[u.id]),
    query(db,`SELECT p.id,p.blocked_task_id AS task_id,t.title,'PENDENCY_APPROVAL' AS kind FROM pendencies p JOIN tasks t ON t.id=p.blocked_task_id WHERE p.approver_id=$1 AND p.status='AWAITING_APPROVAL'`,[u.id]),
    query(db,`SELECT p.id,p.blocked_task_id AS task_id,t.title,'PENDENCY_RESOLVE' AS kind FROM pendencies p JOIN tasks t ON t.id=p.blocked_task_id WHERE p.responsible_user_id=$1 AND p.status='OPEN'`,[u.id])
  ]);send(res,[...results,...extensions,...reassignments,...approvals,...resolutions]);
}));
api.get('/tasks/:taskId/history',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(await taskAccess(u,task,'VIEW')==='LIMITED')throw new HttpError(403,'Forbidden');
  const filter=typeof req.query.event_type==='string'?req.query.event_type:null;
  send(res,await query(db,'SELECT h.*,u.full_name AS actor_name FROM task_history h JOIN users u ON u.id=h.actor_id WHERE h.task_id=$1 AND ($2::text IS NULL OR h.event_type=$2) ORDER BY h.created_at,h.id',[task.id,filter]));
}));
const csvValue=(value:unknown)=>{let text=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');if(/^[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
const csv=(rows:Record<string,unknown>[],columns:string[])=>[columns.join(','),...rows.map(r=>columns.map(k=>csvValue(r[k])).join(','))].join('\r\n')+'\r\n';
api.get('/tasks/:taskId/history.csv',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(await taskAccess(u,task,'VIEW')==='LIMITED')throw new HttpError(403,'Forbidden');
  const rows=await query(db,'SELECT created_at,event_type,actor_id,details FROM task_history WHERE task_id=$1 ORDER BY created_at,id',[task.id]);res.type('text/csv').attachment(`task-${task.id}-history.csv`).send(csv(rows,['created_at','event_type','actor_id','details']));
}));
api.get('/projects/:projectId/activity',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);send(res,await query(db,'SELECT h.*,u.full_name AS actor_name FROM task_history h JOIN users u ON u.id=h.actor_id WHERE h.project_id=$1 ORDER BY h.created_at DESC,h.id DESC LIMIT 100',[pid]));}));
api.get('/projects/:projectId/dashboard',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const rows=await query<{status:string;owner_id:number;count:number;overdue_count:number}>(db,`SELECT status,owner_id,count(*)::int AS count,count(*) FILTER(WHERE due_date<current_date AND status<>'COMPLETED')::int AS overdue_count FROM tasks WHERE project_id=$1 GROUP BY status,owner_id`,[pid]);
  const byStatus:Record<string,number>={NEW:0,IN_PROGRESS:0,SUBMITTED:0,COMPLETED:0},byOwner:Record<string,number>={};let total=0,overdue=0;
  for(const r of rows){const n=Number(r.count);total+=n;overdue+=Number(r.overdue_count);byStatus[r.status]=(byStatus[r.status]||0)+n;byOwner[String(r.owner_id)]=(byOwner[String(r.owner_id)]||0)+n;}
  send(res,{total,overdue,by_status:byStatus,by_owner:byOwner,completed:byStatus.COMPLETED || 0,pending:total-(byStatus.COMPLETED || 0)});
}));
async function report(user:User,kind:'overdue'|'progress',params:Record<string,unknown>){
  role(user,['PM']);const projectId=id(params.project_id);await projectManager(user,projectId);
  const status=typeof params.status==='string'&&params.status?params.status:null,owner=typeof params.owner_id==='string'&&params.owner_id?id(params.owner_id):null;
  const predicate=kind==='overdue'?"AND t.due_date<current_date AND t.status<>'COMPLETED'":'';
  return query(db,`SELECT t.id,t.title,t.status,t.priority,t.due_date,t.owner_id,u.full_name AS owner_name,t.created_at FROM tasks t JOIN users u ON u.id=t.owner_id WHERE t.project_id=$1 AND ($2::text IS NULL OR t.status=$2) AND ($3::bigint IS NULL OR t.owner_id=$3) ${predicate} ORDER BY t.due_date NULLS LAST,t.id`,[projectId,status,owner]);
}
for(const kind of ['overdue','progress'] as const){
  api.get(`/reports/${kind}`,handler(async(req,res)=>{send(res,await report(currentUser(res),kind,req.query));}));
  api.get(`/reports/${kind}.csv`,handler(async(req,res)=>{const rows=await report(currentUser(res),kind,req.query);res.type('text/csv').attachment(`${kind}.csv`).send(csv(rows,['id','title','status','priority','due_date','owner_id','owner_name','created_at']));}));
}
api.use(fileRoutes);

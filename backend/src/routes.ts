import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db, one, query } from './db.js';
import { authenticate, currentUser, getProject, handler, history, HttpError, issueSession, notify, projectManager, projectMember, role, taskAccess, taskById, uid, visibleTaskIds, type Task, type User } from './core.js';
import { fileRoutes } from './files.js';
import { demoAccounts, demoPassword } from './demo.js';

export const api = Router();
const parse = <T extends z.ZodTypeAny>(schema:T,value:unknown):z.infer<T> => schema.parse(value);
const id = (value:unknown) => uid(value);
const send = (res:import('express').Response,value:unknown,status=200) => res.status(status).json(value);
const nonempty = z.string().trim().min(1).max(5000);
const taskInput = z.object({title:z.string().trim().min(1).max(200),description:z.string().max(10000).default(''),expected_deliverables:z.string().max(10000).default(''),owner_id:z.number().int().positive(),priority:z.enum(['LOW','MEDIUM','HIGH']).default('MEDIUM'),due_date:z.string().date().nullable().optional(),sub_project_id:z.number().int().positive().nullable().optional(),parent_task_id:z.number().int().positive().nullable().optional(),plm_ref:z.string().max(100).nullable().optional()});
type SubProject={id:number;project_id:number;name:string;objective:string;owner_id:number;due_date:string};
const subProjectInput=z.object({name:z.string().trim().min(1).max(200),objective:z.string().trim().max(10000),owner_id:z.number().int().positive(),due_date:z.string().date()});
async function subProjectById(subProjectId:number){const item=await one<SubProject>(db,'SELECT id,project_id,name,objective,owner_id,due_date FROM sub_projects WHERE id=$1',[subProjectId]);if(!item)throw new HttpError(404,'Sub-project not found');return item;}
async function canEditTask(user:User,task:Task){if(user.role==='PM'&&user.id===task.manager_id)return;if(task.sub_project_id&&user.id===task.sub_project_owner_id)return;throw new HttpError(task.sub_project_id?403:404,'Only the PM or sub-project owner can edit this task');}
async function checkProjectDeadline(projectId:number,dueDate:string|null|undefined){
  if(!dueDate)return;
  const project=await one<{target_date:string|null}>(db,'SELECT target_date FROM projects WHERE id=$1',[projectId]);
  if(project?.target_date&&dueDate>=project.target_date.slice(0,10))throw new HttpError(400,'Task due date must be before the project deadline');
}
async function checkSubProjectDeadline(subProjectId:number|null|undefined,dueDate:string|null|undefined){if(!subProjectId||!dueDate)return;const sub=await subProjectById(subProjectId);if(dueDate>sub.due_date.slice(0,10))throw new HttpError(400,'Task due date must be on or before the sub-project due date');}

const attempts = new Map<string,{count:number;until:number}>();
api.get('/auth/demo',(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  return res.json({password:demoPassword,accounts:demoAccounts});
});
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
  await query(db,'INSERT INTO audit_log(action,actor_id,details) VALUES($1,$2,$3::jsonb)',['LOGIN',user.id,JSON.stringify({username:user.username})]);
  send(res,{id:user.id,username:user.username,full_name:user.full_name,role:user.role});
}));
api.use(authenticate);
api.post('/auth/logout',handler(async(req,res)=>{
  const u=currentUser(res);
  const token=req.cookies?.cvrde_session;
  if(typeof token==='string') await db.transaction().execute(async tx=>{await query(tx,'DELETE FROM sessions WHERE token_hash=$1',[createHash('sha256').update(token).digest('hex')]);await query(tx,'INSERT INTO audit_log(action,actor_id,details) VALUES($1,$2,$3::jsonb)',['LOGOUT',u.id,'{}']);});
  res.clearCookie('cvrde_session',{path:'/'});send(res,{ok:true});
}));
api.get('/auth/me',handler(async(_req,res)=>{send(res,currentUser(res));}));
api.get('/users',handler(async(_req,res)=>{const u=currentUser(res);const rows=await query(db,"SELECT id,username,full_name,email,role,active FROM users WHERE $1='ADMIN' OR active AND ($1='PM' OR role IN ('MEMBER','REVIEWER')) ORDER BY id",[u.role]);send(res,rows);}));
api.patch('/users/:userId/active',handler(async(req,res)=>{
  const u=currentUser(res);role(u,['ADMIN']);const userId=id(req.params.userId),{active}=parse(z.object({active:z.boolean()}),req.body);
  if(userId===u.id&&!active)throw new HttpError(400,'You cannot deactivate your own account');
  const changed=await db.transaction().execute(async tx=>{const row=await one<{id:number;active:boolean}>(tx,'UPDATE users SET active=$1 WHERE id=$2 AND active<>$1 RETURNING id,active',[active,userId]);if(row)await query(tx,'INSERT INTO audit_log(action,actor_id,details) VALUES($1,$2,$3::jsonb)',['USER_ACTIVE_CHANGED',u.id,JSON.stringify({user_id:userId,active})]);return row;});
  if(!changed&&!await one(db,'SELECT 1 FROM users WHERE id=$1',[userId]))throw new HttpError(404,'Account not found');
  if(!active)await query(db,'DELETE FROM sessions WHERE user_id=$1',[userId]);send(res,{ok:true,active});
}));
api.post('/projects/:projectId/users',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const d=parse(z.object({username:z.string().trim().min(3).max(80).regex(/^[a-z0-9._-]+$/i),full_name:z.string().trim().min(2).max(150),email:z.email(),password:z.string().min(10).max(200)}),req.body);
  if(await one(db,'SELECT 1 FROM users WHERE lower(username)=lower($1)',[d.username]))throw new HttpError(409,'Username already exists');
  const hash=await bcrypt.hash(d.password,12);
  const created=await db.transaction().execute(async tx=>{const user=await one<{id:number;username:string;full_name:string;role:string}>(tx,"INSERT INTO users(username,password_hash,full_name,email,role) VALUES($1,$2,$3,$4,'MEMBER') RETURNING id,username,full_name,role",[d.username,hash,d.full_name,d.email]);await query(tx,'INSERT INTO project_members(project_id,user_id) VALUES($1,$2)',[pid,user!.id]);await history(tx,pid,null,'USER_CREATED',u.id,{user_id:user!.id,username:d.username});return user;});send(res,created,201);
}));

api.get('/projects',handler(async(_req,res)=>{
  const u=currentUser(res);
  send(res,await query(db,`SELECT DISTINCT p.*,manager.full_name AS manager_name,
    (SELECT count(*)::int FROM tasks t WHERE t.project_id=p.id) AS task_total,
    (SELECT count(*)::int FROM tasks t WHERE t.project_id=p.id AND t.status='DONE') AS task_done,
    EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=p.id AND t.status<>'DONE' AND (t.due_date<current_date OR (t.status='NOT_STARTED' AND t.due_date<=current_date+3) OR greatest(t.updated_at,coalesce((SELECT max(h.created_at) FROM task_history h WHERE h.task_id=t.id),t.updated_at))<=now()-interval '5 days')) AS at_risk
    FROM projects p JOIN users manager ON manager.id=p.manager_id LEFT JOIN project_members pm ON pm.project_id=p.id WHERE p.manager_id=$1 OR pm.user_id=$1 ORDER BY p.id DESC`,[u.id]));
}));
api.post('/projects',handler(async(req,res)=>{
  const u=currentUser(res);role(u,['PM']);
  const data=parse(z.object({name:z.string().trim().min(1).max(200),description:z.string().max(10000).default(''),target_date:z.string().date()}),req.body);
  const p=await db.transaction().execute(async tx=>{const project=await one<{id:number}>(tx,'INSERT INTO projects(name,description,target_date,manager_id) VALUES($1,$2,$3,$4) RETURNING *',[data.name,data.description,data.target_date,u.id]);await history(tx,project!.id,null,'PROJECT_CREATED',u.id,{name:data.name});return project;});
  send(res,p,201);
}));
api.patch('/projects/:projectId',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const changes=parse(z.object({name:z.string().trim().min(1).max(200).optional(),description:z.string().max(10000).optional(),target_date:z.string().date().optional()}).strict(),req.body);
  if(!Object.keys(changes).length)throw new HttpError(400,'No changes');
  const current=await one<{name:string;description:string;target_date:string|null}>(db,'SELECT name,description,target_date FROM projects WHERE id=$1',[pid]);
  // An increase can be used to repair a project that already has tasks beyond its old deadline.
  if(changes.target_date&&(!current?.target_date||changes.target_date<current.target_date)){
    const latest=await one<{due_date:string|null}>(db,`SELECT max(due_date)::text AS due_date FROM (
      SELECT due_date FROM tasks WHERE project_id=$1
      UNION ALL
      SELECT e.new_due_date FROM due_date_extensions e JOIN tasks t ON t.id=e.task_id WHERE t.project_id=$1 AND e.status='PENDING'
    ) dates`,[pid]);
    if(latest?.due_date&&changes.target_date<=latest.due_date)throw new HttpError(400,'Project deadline must be after all task due dates and pending extensions');
    const latestSubProject=await one<{due_date:string|null}>(db,'SELECT max(due_date)::text AS due_date FROM sub_projects WHERE project_id=$1',[pid]);
    if(latestSubProject?.due_date&&changes.target_date<latestSubProject.due_date)throw new HttpError(400,'Project due date must include every sub-project');
  }
  const entries=Object.entries(changes),diff=Object.fromEntries(entries.map(([key,next])=>[key,{old:current?.[key as keyof typeof current],new:next}]));
  const updated=await db.transaction().execute(async tx=>{
    const fields=entries.map(([key],index)=>`${key}=$${index+1}`).join(',');
    const project=await one(tx,`UPDATE projects SET ${fields} WHERE id=$${entries.length+1} RETURNING *`,[...entries.map(([,next])=>next),pid]);
    await history(tx,pid,null,'PROJECT_UPDATED',u.id,diff);
    return project;
  });
  send(res,updated);
}));
api.get('/projects/:projectId',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);send(res,await getProject(pid));}));
api.get('/projects/:projectId/sub-projects',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);
  send(res,await query(db,`SELECT sp.*,owner.full_name AS owner_name,count(t.id)::int AS task_total,count(t.id) FILTER (WHERE t.status='DONE')::int AS task_done,(sp.owner_id=$2 OR EXISTS(SELECT 1 FROM projects p WHERE p.id=sp.project_id AND p.manager_id=$2) OR EXISTS(SELECT 1 FROM tasks own WHERE own.sub_project_id=sp.id AND own.owner_id=$2)) AS can_open FROM sub_projects sp JOIN users owner ON owner.id=sp.owner_id LEFT JOIN tasks t ON t.sub_project_id=sp.id WHERE sp.project_id=$1 GROUP BY sp.id,owner.full_name ORDER BY sp.due_date,sp.id`,[pid,u.id]));
}));
api.post('/projects/:projectId/sub-projects',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);const d=parse(subProjectInput,req.body);
  const project=await one<{target_date:string|null}>(db,'SELECT target_date FROM projects WHERE id=$1',[pid]);
  if(project?.target_date&&d.due_date>project.target_date.slice(0,10))throw new HttpError(400,'Sub-project due date must be on or before the project due date');
  if(!await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[pid,d.owner_id]))throw new HttpError(400,'Sub-project owner must be a project member');
  const item=await db.transaction().execute(async tx=>{const row=await one<SubProject>(tx,'INSERT INTO sub_projects(project_id,name,objective,owner_id,due_date) VALUES($1,$2,$3,$4,$5) RETURNING *',[pid,d.name,d.objective,d.owner_id,d.due_date]);await history(tx,pid,null,'SUB_PROJECT_CREATED',u.id,{sub_project_id:row!.id,name:d.name,owner_id:d.owner_id});return row;});send(res,item,201);
}));
api.get('/sub-projects/:subProjectId',handler(async(req,res)=>{
  const u=currentUser(res),sp=await subProjectById(id(req.params.subProjectId));await projectMember(u,sp.project_id);
  const project=await getProject(sp.project_id);
  if(u.id!==project.manager_id&&u.id!==sp.owner_id&&!await one(db,'SELECT 1 FROM tasks WHERE sub_project_id=$1 AND owner_id=$2 LIMIT 1',[sp.id,u.id]))throw new HttpError(404,'Sub-project not found');
  const row=await one(db,`SELECT sp.*,owner.full_name AS owner_name,count(t.id)::int AS task_total,count(t.id) FILTER (WHERE t.status='DONE')::int AS task_done FROM sub_projects sp JOIN users owner ON owner.id=sp.owner_id LEFT JOIN tasks t ON t.sub_project_id=sp.id WHERE sp.id=$1 GROUP BY sp.id,owner.full_name`,[sp.id]);send(res,row);
}));
api.patch('/sub-projects/:subProjectId',handler(async(req,res)=>{
  const u=currentUser(res),sp=await subProjectById(id(req.params.subProjectId));const project=await projectMember(u,sp.project_id);if(u.role!=='PM'||project.manager_id!==u.id)throw new HttpError(403,'Only the PM can edit sub-project details');
  const d=parse(subProjectInput.partial().strict(),req.body);if(!Object.keys(d).length)throw new HttpError(400,'No changes');
  if(d.owner_id&&!await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[sp.project_id,d.owner_id]))throw new HttpError(400,'Sub-project owner must be a project member');
  if(d.due_date){const project=await one<{target_date:string|null}>(db,'SELECT target_date FROM projects WHERE id=$1',[sp.project_id]);if(project?.target_date&&d.due_date>project.target_date.slice(0,10))throw new HttpError(400,'Sub-project due date must be on or before the project due date');const latest=await one<{due_date:string|null}>(db,'SELECT max(due_date)::text AS due_date FROM tasks WHERE sub_project_id=$1',[sp.id]);if(latest?.due_date&&d.due_date<latest.due_date)throw new HttpError(400,'Sub-project due date must include its tasks');}
  const entries=Object.entries(d),updated=await db.transaction().execute(async tx=>{const fields=entries.map(([key],i)=>`${key}=$${i+1}`).join(',');const row=await one(tx,`UPDATE sub_projects SET ${fields},updated_at=now() WHERE id=$${entries.length+1} RETURNING *`,[...entries.map(([,value])=>value),sp.id]);await history(tx,sp.project_id,null,'SUB_PROJECT_UPDATED',u.id,{sub_project_id:sp.id,changes:d});return row;});send(res,updated);
}));
api.get('/sub-projects/:subProjectId/tasks',handler(async(req,res)=>{
  const u=currentUser(res),sp=await subProjectById(id(req.params.subProjectId));await projectMember(u,sp.project_id);
  const project=await getProject(sp.project_id);
  if(u.id!==project.manager_id&&u.id!==sp.owner_id&&!await one(db,'SELECT 1 FROM tasks WHERE sub_project_id=$1 AND owner_id=$2 LIMIT 1',[sp.id,u.id]))throw new HttpError(404,'Sub-project not found');
  send(res,await query(db,'SELECT t.*,owner.full_name AS owner_name FROM tasks t JOIN users owner ON owner.id=t.owner_id WHERE t.sub_project_id=$1 ORDER BY t.due_date NULLS LAST,t.id',[sp.id]));
}));
api.post('/projects/:projectId/members',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const {user_id}=parse(z.object({user_id:z.number().int().positive()}),req.body);
  const member=await one<User>(db,"SELECT * FROM users WHERE id=$1 AND role='MEMBER' AND active",[user_id]);if(!member)throw new HttpError(400,'Active member required');
  await db.transaction().execute(async tx=>{await query(tx,'INSERT INTO project_members(project_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[pid,user_id]);await history(tx,pid,null,'PROJECT_MEMBER_ADDED',u.id,{user_id});});send(res,{ok:true},201);
}));
api.get('/projects/:projectId/members',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);send(res,await query(db,'SELECT u.id,u.full_name,u.username,u.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 ORDER BY u.id',[pid]));}));
api.delete('/projects/:projectId/members/:userId',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId),memberId=id(req.params.userId);await projectManager(u,pid);
  if(await one(db,'SELECT 1 FROM tasks WHERE project_id=$1 AND owner_id=$2 LIMIT 1',[pid,memberId]))throw new HttpError(409,'Reassign this member’s tasks before removal');
  if(await one(db,'SELECT 1 FROM sub_projects WHERE project_id=$1 AND owner_id=$2 LIMIT 1',[pid,memberId]))throw new HttpError(409,'Reassign this member’s sub-projects before removal');
  await db.transaction().execute(async tx=>{await query(tx,'DELETE FROM group_members WHERE user_id=$1 AND group_id IN (SELECT id FROM project_groups WHERE project_id=$2)',[memberId,pid]);const removed=await query(tx,'DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING user_id',[pid,memberId]);if(removed.length)await history(tx,pid,null,'PROJECT_MEMBER_REMOVED',u.id,{user_id:memberId});});send(res,{ok:true});
}));

api.get('/projects/:projectId/tasks',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);
  send(res,await query(db,`SELECT t.*,u.full_name AS owner_name FROM tasks t JOIN users u ON u.id=t.owner_id JOIN projects p ON p.id=t.project_id LEFT JOIN sub_projects sp ON sp.id=t.sub_project_id WHERE t.project_id=$1 AND (p.manager_id=$2 OR t.owner_id=$2 OR sp.owner_id=$2 OR (t.sub_project_id IS NOT NULL AND EXISTS(SELECT 1 FROM tasks own WHERE own.sub_project_id=t.sub_project_id AND own.owner_id=$2)) OR (t.visibility='GROUP' AND EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=t.group_id AND gm.user_id=$2))) ORDER BY t.id`,[pid,u.id]));
}));
api.get('/tasks/mine',handler(async(_req,res)=>{
  const u=currentUser(res);role(u,['MEMBER']);
  send(res,await query(db,`SELECT t.*,p.name AS project_name FROM tasks t JOIN projects p ON p.id=t.project_id LEFT JOIN sub_projects sp ON sp.id=t.sub_project_id WHERE t.owner_id=$1 OR sp.owner_id=$1 OR (t.sub_project_id IS NOT NULL AND EXISTS(SELECT 1 FROM tasks own WHERE own.sub_project_id=t.sub_project_id AND own.owner_id=$1)) OR (t.visibility='GROUP' AND EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=t.group_id AND gm.user_id=$1)) ORDER BY t.due_date NULLS LAST,t.id`,[u.id]));
}));
api.post('/projects/:projectId/tasks',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectMember(u,pid);
  const d=parse(taskInput,req.body);
  let subProject:SubProject|undefined;
  if(d.sub_project_id){subProject=await subProjectById(d.sub_project_id);if(subProject.project_id!==pid)throw new HttpError(400,'Sub-project must belong to project');}
  if(u.role!=='PM'||(await getProject(pid)).manager_id!==u.id){if(!subProject||subProject.owner_id!==u.id)throw new HttpError(403,'Only the PM or sub-project owner can create this task');}
  await checkProjectDeadline(pid,d.due_date);
  await checkSubProjectDeadline(subProject?.id,d.due_date);
  const member=d.owner_id===u.id||await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[pid,d.owner_id]);if(!member)throw new HttpError(400,'Owner must belong to project');
  let parent:Task|undefined;
  if(d.parent_task_id){parent=await taskById(d.parent_task_id);if(parent.project_id!==pid||parent.sub_project_id!==(subProject?.id||null))throw new HttpError(400,'Parent must belong to the same sub-project');}
  const task=await db.transaction().execute(async tx=>{
    const row=await one<Task>(tx,`INSERT INTO tasks(project_id,sub_project_id,parent_task_id,title,description,expected_deliverables,owner_id,priority,due_date,status,visibility,group_id,plm_ref,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'NOT_STARTED',$10,$11,$12,$13) RETURNING *`,[pid,subProject?.id||null,d.parent_task_id || null,d.title,d.description,d.expected_deliverables,d.owner_id,d.priority,d.due_date || null,parent?.visibility || 'PRIVATE',parent?.group_id || null,d.plm_ref || null,u.id]);
    await history(tx,pid,row!.id,'TASK_CREATED',u.id,{title:d.title,owner_id:d.owner_id});return row!;
  });
  await notify('ASSIGNED',d.owner_id,task.id,`Task assigned: ${task.title}`,`Project ${pid}: ${task.title}`);
  send(res,task,201);
}));
api.get('/tasks/:taskId',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId)),access=await taskAccess(u,task,'VIEW');
  if(access==='LIMITED')return send(res,{id:task.id,title:task.title,status:task.status,limited:true});
  const [people,project,subtasks]=await Promise.all([
    query<{id:number;full_name:string}>(db,'SELECT id,full_name FROM users WHERE id=ANY($1::bigint[])',[[task.owner_id,task.manager_id,task.created_by]]),
    getProject(task.project_id),
    query<{total:number;done:number}>(db,"SELECT count(*)::int AS total,count(*) FILTER (WHERE status='DONE')::int AS done FROM tasks WHERE parent_task_id=$1",[task.id])
  ]);
  const subProject=task.sub_project_id?await subProjectById(task.sub_project_id):null;
  send(res,{...task,project_name:project.name,sub_project_name:subProject?.name||null,owner_name:people.find(p=>p.id===task.owner_id)?.full_name,assigned_by_name:people.find(p=>p.id===task.created_by)?.full_name,subtask_count:subtasks[0]});
}));
api.get('/tasks/:taskId/subtasks',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await taskAccess(u,task,'VIEW');
  send(res,await query(db,`SELECT t.id,t.title,t.description,t.owner_id,u.full_name AS owner_name,t.due_date,t.status,t.priority FROM tasks t JOIN users u ON u.id=t.owner_id WHERE t.parent_task_id=$1 AND (t.owner_id=$2 OR $2=$3 OR (t.visibility='GROUP' AND EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=t.group_id AND gm.user_id=$2))) ORDER BY t.due_date NULLS LAST,t.id`,[task.id,u.id,task.manager_id]));
}));
api.get('/tasks/:taskId/prerequisites',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await taskAccess(u,task,'VIEW');
  send(res,await query(db,`SELECT p.id,p.description,p.status,p.type,p.responsible_user_id,d.depends_on_task_id,t.title AS depends_on_title,t.status AS depends_on_status,(p.status='OPEN') AS blocked FROM pendencies p JOIN pendency_dependencies d ON d.pendency_id=p.id JOIN tasks t ON t.id=d.depends_on_task_id WHERE p.blocked_task_id=$1 ORDER BY p.created_at,p.id`,[task.id]));
}));
api.post('/tasks/:taskId/progress',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(u.id!==task.owner_id)throw new HttpError(403,'Owner only');
  if(!['IN_PROGRESS','RETURNED'].includes(task.status))throw new HttpError(409,'Start the task before updating progress');
  const d=parse(z.object({percent:z.number().int().min(0).max(100),justification:z.string().trim().min(1).max(2000)}),req.body);
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE tasks SET progress_percent=$1,updated_at=now() WHERE id=$2',[d.percent,task.id]);await history(tx,task.project_id,task.id,'PROGRESS_CHANGED',u.id,{old:task.progress_percent,new:d.percent,justification:d.justification});});
  send(res,{progress_percent:d.percent});
}));
api.patch('/tasks/:taskId',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await canEditTask(u,task);
  const d=parse(z.object({title:z.string().trim().min(1).max(200).optional(),description:z.string().max(10000).optional(),expected_deliverables:z.string().max(10000).optional(),priority:z.enum(['LOW','MEDIUM','HIGH']).optional(),due_date:z.string().date().nullable().optional(),plm_ref:z.string().max(100).nullable().optional(),parent_task_id:z.number().int().positive().nullable().optional()}).strict(),req.body);
  if(!Object.keys(d).length)throw new HttpError(400,'No changes');
  await checkProjectDeadline(task.project_id,d.due_date);
  await checkSubProjectDeadline(task.sub_project_id,d.due_date);
  if(d.parent_task_id){const parent=await taskById(d.parent_task_id);if(parent.project_id!==task.project_id || parent.sub_project_id!==task.sub_project_id || parent.id===task.id)throw new HttpError(400,'Invalid parent');}
  const allowed=['title','description','expected_deliverables','priority','due_date','plm_ref','parent_task_id'] as const;
  const updates=Object.entries(d).filter(([k])=>allowed.includes(k as typeof allowed[number]));
  const diff=Object.fromEntries(updates.map(([k,v])=>[k,{old:(task as unknown as Record<string,unknown>)[k],new:v}]));
  const result=await db.transaction().execute(async tx=>{
    const values=updates.map(([,v])=>v);
    const clause=updates.map(([k],i)=>`${k}=$${i+1}`).join(',');
    const row=await one(tx,`UPDATE tasks SET ${clause},updated_at=now() WHERE id=$${values.length+1} RETURNING *`,[...values,task.id]);
    await history(tx,task.project_id,task.id,'TASK_UPDATED',u.id,diff);return row;
  });send(res,result);
}));
api.patch('/tasks/:taskId/assignment',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await canEditTask(u,task);
  const {owner_id}=parse(z.object({owner_id:z.number().int().positive()}),req.body);
  if(owner_id!==u.id&&!await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[task.project_id,owner_id]))throw new HttpError(400,'Owner must belong to project');
  if(owner_id===task.owner_id)return send(res,{ok:true});
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE tasks SET owner_id=$1,updated_at=now() WHERE id=$2',[owner_id,task.id]);await history(tx,task.project_id,task.id,'TASK_REASSIGNED',u.id,{old:task.owner_id,new:owner_id});});
  await notify('ASSIGNED',owner_id,task.id,`Task assigned: ${task.title}`,task.title);send(res,{ok:true});
}));
api.post('/tasks/:taskId/status',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(task.owner_id!==u.id)throw new HttpError(403,'Owner only');
  if(task.status!=='NOT_STARTED')throw new HttpError(409,'Only Not started tasks can be started');
  await db.transaction().execute(async tx=>{await query(tx,"UPDATE tasks SET status='IN_PROGRESS',updated_at=now() WHERE id=$1",[task.id]);await history(tx,task.project_id,task.id,'STATUS_CHANGED',u.id,{old:'NOT_STARTED',new:'IN_PROGRESS'});});
  await notify('STATUS_CHANGED',task.manager_id,task.id,`Task started: ${task.title}`,task.title);send(res,{status:'IN_PROGRESS'});
}));
api.post('/tasks/:taskId/comments',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));await taskAccess(u,task,'COMMENT');const {body}=parse(z.object({body:nonempty}),req.body);
  const row=await db.transaction().execute(async tx=>{const item=await one(tx,'INSERT INTO task_comments(task_id,author_id,body) VALUES($1,$2,$3) RETURNING *',[task.id,u.id,body]);await history(tx,task.project_id,task.id,'COMMENT_ADDED',u.id,{comment_id:(item as {id:number}).id});return item;});
  const mentions=[...body.matchAll(/@([a-z0-9._-]+)/gi)].map(x=>x[1]!.toLowerCase());
  const mentioned=mentions.length?await query<{id:number}>(db,'SELECT u.id FROM users u JOIN project_members pm ON pm.user_id=u.id WHERE pm.project_id=$1 AND lower(u.username)=ANY($2::text[]) AND u.active',[task.project_id,mentions]):[];
  for(const recipient of new Set([task.owner_id,task.manager_id,...mentioned.map(x=>x.id)]))if(recipient!==u.id)await notify('COMMENT',recipient,task.id,`New comment: ${task.title}`,body);
  send(res,row,201);
}));
api.get('/tasks/:taskId/comments',handler(async(req,res)=>{const u=currentUser(res),task=await taskById(id(req.params.taskId));if(await taskAccess(u,task,'VIEW')==='LIMITED')throw new HttpError(403,'Forbidden');send(res,await query(db,'SELECT c.*,u.full_name AS author_name FROM task_comments c JOIN users u ON u.id=c.author_id WHERE c.task_id=$1 ORDER BY c.created_at,c.id',[task.id]));}));
api.get('/me/notifications',handler(async(_req,res)=>{
  const u=currentUser(res);send(res,await query(db,'SELECT id,event_type,task_id,subject,sent_at,read_at FROM notification_log WHERE to_user_id=$1 AND task_id IS NOT NULL ORDER BY sent_at DESC,id DESC LIMIT 100',[u.id]));
}));
api.post('/me/notifications/read-all',handler(async(_req,res)=>{
  const u=currentUser(res);await db.transaction().execute(async tx=>{const rows=await query(tx,'UPDATE notification_log SET read_at=now() WHERE to_user_id=$1 AND read_at IS NULL RETURNING id',[u.id]);if(rows.length)await query(tx,'INSERT INTO audit_log(action,actor_id,details) VALUES($1,$2,$3::jsonb)',['NOTIFICATIONS_READ',u.id,JSON.stringify({count:rows.length})]);});send(res,{ok:true});
}));
api.post('/me/notifications/:notificationId/read',handler(async(req,res)=>{
  const u=currentUser(res),notificationId=id(req.params.notificationId);
  const row=await db.transaction().execute(async tx=>{const updated=await one(tx,'UPDATE notification_log SET read_at=now() WHERE id=$1 AND to_user_id=$2 AND read_at IS NULL RETURNING id',[notificationId,u.id]);if(updated)await query(tx,'INSERT INTO audit_log(action,actor_id,details) VALUES($1,$2,$3::jsonb)',['NOTIFICATION_READ',u.id,JSON.stringify({notification_id:notificationId})]);return updated||await one(tx,'SELECT id FROM notification_log WHERE id=$1 AND to_user_id=$2',[notificationId,u.id]);});
  if(!row)throw new HttpError(404,'Notification not found');send(res,{ok:true});
}));

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
  await db.transaction().execute(async tx=>{const affected=await query<{id:number}>(tx,"UPDATE tasks SET visibility='PRIVATE',group_id=NULL WHERE group_id=$1 RETURNING id",[gid]);for(const task of affected)await history(tx,group.project_id,task.id,'VISIBILITY_CHANGED',u.id,{old:gid,new:null});await query(tx,'DELETE FROM project_groups WHERE id=$1',[gid]);await history(tx,group.project_id,null,'GROUP_DELETED',u.id,{group_id:gid});});send(res,{ok:true});
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
  await checkProjectDeadline(task.project_id,d.new_due_date);
  const row=await db.transaction().execute(async tx=>{const r=await one(tx,"INSERT INTO due_date_extensions(task_id,requested_by,old_due_date,new_due_date,reason) VALUES($1,$2,$3,$4,$5) RETURNING *",[task.id,u.id,task.due_date,d.new_due_date,d.reason]);await history(tx,task.project_id,task.id,'EXTENSION_REQUESTED',u.id,{new_due_date:d.new_due_date,reason:d.reason});return r;});
  await notify('EXTENSION_REQUESTED',task.manager_id,task.id,`Extension requested: ${task.title}`,d.reason);send(res,row,201);
}));
api.post('/extension-requests/:requestId/decision',handler(async(req,res)=>{
  const u=currentUser(res),requestId=id(req.params.requestId),d=parse(z.object({approve:z.boolean(),comment:z.string().max(2000).default('')}),req.body);
  const r=await one<{id:number;task_id:number;requested_by:number;new_due_date:string;status:string}>(db,'SELECT * FROM due_date_extensions WHERE id=$1',[requestId]);if(!r)throw new HttpError(404,'Request not found');
  if(!d.approve&&!d.comment.trim())throw new HttpError(400,'A reason is required when declining a request');
  const task=await taskById(r.task_id);await projectManager(u,task.project_id);if(r.status!=='PENDING')throw new HttpError(409,'Already decided');
  if(d.approve)await checkProjectDeadline(task.project_id,r.new_due_date);
  const status=d.approve?'APPROVED':'REJECTED';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE due_date_extensions SET status=$1,decided_by=$2,decided_at=now(),decision_comment=$3 WHERE id=$4',[status,u.id,d.comment,r.id]);if(d.approve)await query(tx,'UPDATE tasks SET due_date=$1,updated_at=now() WHERE id=$2',[r.new_due_date,task.id]);await history(tx,task.project_id,task.id,'EXTENSION_DECIDED',u.id,{status,new_due_date:r.new_due_date,comment:d.comment});});
  await notify('REQUEST_ANSWERED',r.requested_by,task.id,`Extension ${status.toLowerCase()}: ${task.title}`,d.comment || status);send(res,{status});
}));
api.get('/tasks/:taskId/extensions',handler(async(req,res)=>{const u=currentUser(res),task=await taskById(id(req.params.taskId));if(await taskAccess(u,task,'VIEW')==='LIMITED')throw new HttpError(403,'Forbidden');send(res,await query(db,'SELECT * FROM due_date_extensions WHERE task_id=$1 ORDER BY id DESC',[task.id]));}));

api.post('/tasks/:taskId/results',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));if(u.id!==task.owner_id)throw new HttpError(403,'Owner only');
  if(!['IN_PROGRESS','RETURNED'].includes(task.status))throw new HttpError(409,'Task must be In progress or Returned');
  const d=parse(z.object({work_completed:nonempty,outcome:nonempty,attachment_ids:z.array(z.number().int().positive()).default([])}),req.body);
  const row=await db.transaction().execute(async tx=>{
    const r=await one(tx,`INSERT INTO task_results(task_id,version_no,work_completed,outcome,submitted_by) VALUES($1,(SELECT coalesce(max(version_no),0)+1 FROM task_results WHERE task_id=$1),$2,$3,$4) RETURNING *`,[task.id,d.work_completed,d.outcome,u.id]);
    if(d.attachment_ids.length){const attached=await query(tx,'UPDATE attachments SET result_id=$1 WHERE id=ANY($2::bigint[]) AND task_id=$3 AND result_id IS NULL RETURNING id',[(r as {id:number}).id,d.attachment_ids,task.id]);if(attached.length!==new Set(d.attachment_ids).size)throw new HttpError(400,'Invalid submission files');}
    await query(tx,"UPDATE tasks SET status='SUBMITTED',updated_at=now() WHERE id=$1",[task.id]);await history(tx,task.project_id,task.id,'RESULT_SUBMITTED',u.id,{result_id:(r as {id:number}).id,version_no:(r as {version_no:number}).version_no,attachment_ids:d.attachment_ids,old:task.status,new:'SUBMITTED'});return r;
  });await notify('SUBMITTED',task.manager_id,task.id,`Result submitted: ${task.title}`,d.outcome);send(res,row,201);
}));
api.get('/tasks/:taskId/results',handler(async(req,res)=>{const u=currentUser(res),task=await taskById(id(req.params.taskId));await taskAccess(u,task,'RESULTS');send(res,await query(db,"SELECT r.*,(SELECT coalesce(array_agg(a.original_name ORDER BY a.id),'{}'::text[]) FROM attachments a WHERE a.result_id=r.id) AS attachment_names FROM task_results r WHERE r.task_id=$1 ORDER BY r.version_no DESC",[task.id]));}));
api.post('/results/:resultId/review',handler(async(req,res)=>{
  const u=currentUser(res),rid=id(req.params.resultId),d=parse(z.object({accept:z.boolean(),comment:z.string().max(3000).default('')}),req.body);
  const r=await one<{id:number;task_id:number;status:string;review_status:string;submitted_by:number}>(db,'SELECT * FROM task_results WHERE id=$1',[rid]);if(!r)throw new HttpError(404,'Result not found');
  const task=await taskById(r.task_id);await projectManager(u,task.project_id);if(task.status!=='SUBMITTED' || r.review_status!=='PENDING')throw new HttpError(409,'Result is not pending review');
  if(!d.accept&&!d.comment.trim())throw new HttpError(400,'A reason is required when returning work');
  const review=d.accept?'ACCEPTED':'RETURNED', status=d.accept?'DONE':'RETURNED';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE task_results SET review_status=$1,review_comment=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4',[review,d.comment,u.id,rid]);await query(tx,'UPDATE tasks SET status=$1,updated_at=now() WHERE id=$2',[status,task.id]);await history(tx,task.project_id,task.id,'RESULT_REVIEWED',u.id,{result_id:rid,review,comment:d.comment,old:'SUBMITTED',new:status});});
  await notify(review,r.submitted_by,task.id,`Result ${review.toLowerCase()}: ${task.title}`,d.comment || review);send(res,{review_status:review,status});
}));

api.post('/tasks/:taskId/reassignments',handler(async(req,res)=>{
  const u=currentUser(res),task=await taskById(id(req.params.taskId));
  const pm=u.id===task.manager_id&&u.role==='PM',owner=u.id===task.owner_id&&u.role==='MEMBER';
  if(!pm&&!owner)throw new HttpError(403,'Manager or current owner only');
  const d=parse(z.object({new_owner_id:z.number().int().positive(),reviewer_id:z.number().int().positive().optional(),reason:nonempty,work_from:z.string().date().optional(),work_until:z.string().date().optional()}),req.body);
  if(d.new_owner_id===task.owner_id)throw new HttpError(400,'Choose another owner');
  if(owner&&(!d.work_from||!d.work_until))throw new HttpError(400,'Work period required');
  if(Boolean(d.work_from)!==Boolean(d.work_until)||d.work_from&&d.work_until&&d.work_until<d.work_from)throw new HttpError(400,'Invalid work period');
  if(await one(db,"SELECT 1 FROM reassignments WHERE task_id=$1 AND status='PENDING'",[task.id]))throw new HttpError(409,'A reassignment is already awaiting approval');
  if(!await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[task.project_id,d.new_owner_id]))throw new HttpError(400,'New owner must belong to project');
  const approver=owner?task.manager_id:d.reviewer_id;
  if(pm&&(!approver||!await one(db,"SELECT 1 FROM users WHERE id=$1 AND role='REVIEWER' AND active",[approver])))throw new HttpError(400,'Reviewer required');
  const row=await db.transaction().execute(async tx=>{const r=await one(tx,'INSERT INTO reassignments(task_id,original_owner_id,new_owner_id,reason,requested_by,reviewer_id,work_from,work_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[task.id,task.owner_id,d.new_owner_id,d.reason,u.id,approver,d.work_from,d.work_until]);await history(tx,task.project_id,task.id,'REASSIGNMENT_REQUESTED',u.id,{original_owner_id:task.owner_id,new_owner_id:d.new_owner_id,approver_id:approver,work_from:d.work_from,work_until:d.work_until,reason:d.reason});return r;});
  await notify('REASSIGNMENT_REVIEW',approver!,task.id,`Review reassignment: ${task.title}`,d.work_from?`${d.reason} (${d.work_from} to ${d.work_until})`:d.reason);send(res,row,201);
}));
api.post('/reassignments/:requestId/decision',handler(async(req,res)=>{
  const u=currentUser(res),rid=id(req.params.requestId),d=parse(z.object({approve:z.boolean(),comment:z.string().max(2000).default('')}),req.body);
  const r=await one<{id:number;task_id:number;original_owner_id:number;new_owner_id:number;reviewer_id:number;requested_by:number;status:string;work_from:string|null;work_until:string|null}>(db,'SELECT * FROM reassignments WHERE id=$1',[rid]);if(!r)throw new HttpError(404,'Request not found');
  if(!d.approve&&!d.comment.trim())throw new HttpError(400,'A reason is required when declining a request');
  const task=await taskById(r.task_id);
  if(u.id!==r.reviewer_id || (u.role!=='REVIEWER'&&u.id!==task.manager_id))throw new HttpError(403,'Approver only');if(r.status!=='PENDING')throw new HttpError(409,'Already decided');
  if(task.owner_id!==r.original_owner_id)throw new HttpError(409,'Task owner changed since request');
  const status=d.approve?'APPROVED':'REJECTED';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE reassignments SET status=$1,decided_at=now(),decided_by=$2,decision_comment=$3 WHERE id=$4',[status,u.id,d.comment,rid]);if(d.approve)await query(tx,'UPDATE tasks SET owner_id=$1,updated_at=now() WHERE id=$2',[r.new_owner_id,task.id]);await history(tx,task.project_id,task.id,'REASSIGNMENT_DECIDED',u.id,{status,old:r.original_owner_id,new:d.approve?r.new_owner_id:r.original_owner_id,comment:d.comment});});
  for(const target of new Set([r.original_owner_id,r.new_owner_id,task.manager_id]))await notify('REQUEST_ANSWERED',target,task.id,`Reassignment ${status.toLowerCase()}: ${task.title}`,d.comment || status);send(res,{status,work_from:r.work_from,work_until:r.work_until});
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
  if(!d.approve&&!d.comment.trim())throw new HttpError(400,'A reason is required when declining a request');
  const task=await taskById(p.blocked_task_id),status=d.approve?'OPEN':'REJECTED';
  await db.transaction().execute(async tx=>{await query(tx,'UPDATE pendencies SET status=$1,resolution=$2 WHERE id=$3',[status,d.comment || null,pid]);await history(tx,task.project_id,task.id,'PENDENCY_DECIDED',u.id,{pendency_id:pid,status,comment:d.comment});});
  await notify('REQUEST_ANSWERED',p.raised_by,task.id,`Prerequisite ${status.toLowerCase()}: ${task.title}`,d.comment || status);if(d.approve)await notify('PENDENCY_OPEN',p.responsible_user_id,task.id,`Prerequisite assigned: ${task.title}`,d.comment || task.title);send(res,{status});
}));
api.post('/pendencies/:pendencyId/resolve',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.pendencyId),d=parse(z.object({resolution:nonempty}),req.body);
  const p=await one<{id:number;blocked_task_id:number;raised_by:number;responsible_user_id:number;status:string}>(db,'SELECT * FROM pendencies WHERE id=$1',[pid]);if(!p)throw new HttpError(404,'Pendency not found');if(u.id!==p.responsible_user_id)throw new HttpError(403,'Responsible user only');if(p.status!=='OPEN')throw new HttpError(409,'Pendency is not open');
  const task=await taskById(p.blocked_task_id);
  await db.transaction().execute(async tx=>{await query(tx,"UPDATE pendencies SET status='RESOLVED',resolution=$1,resolved_at=now() WHERE id=$2",[d.resolution,pid]);await history(tx,task.project_id,task.id,'PENDENCY_RESOLVED',u.id,{pendency_id:pid,resolution:d.resolution});});
  await notify('REQUEST_ANSWERED',p.raised_by,task.id,`Prerequisite answered: ${task.title}`,d.resolution);send(res,{status:'RESOLVED'});
}));

api.get('/me/work',handler(async(req,res)=>{
  const u=currentUser(res);role(u,['MEMBER']);const pid=id(req.query.project_id);await projectMember(u,pid);
  const [tasks,activity]=await Promise.all([
    query(db,`SELECT t.*,u.full_name AS owner_name,(SELECT r.review_comment FROM task_results r WHERE r.task_id=t.id AND r.review_status='RETURNED' ORDER BY r.version_no DESC LIMIT 1) AS return_reason FROM tasks t JOIN users u ON u.id=t.owner_id WHERE t.project_id=$1 AND t.owner_id=$2 ORDER BY t.due_date NULLS LAST,t.id`,[pid,u.id]),
    query(db,`SELECT * FROM (
      SELECT c.id,t.id AS task_id,t.title,c.created_at,'COMMENT'::text AS event_type,c.body AS detail,author.full_name AS actor_name FROM task_comments c JOIN tasks t ON t.id=c.task_id JOIN users author ON author.id=c.author_id WHERE t.project_id=$1 AND t.owner_id=$2
      UNION ALL
      SELECT h.id,t.id AS task_id,t.title,h.created_at,h.event_type,coalesce(h.details->>'comment',h.details->>'resolution','') AS detail,actor.full_name AS actor_name FROM task_history h JOIN tasks t ON t.id=h.task_id JOIN users actor ON actor.id=h.actor_id WHERE t.project_id=$1 AND t.owner_id=$2 AND h.event_type IN ('STATUS_CHANGED','RESULT_REVIEWED','EXTENSION_DECIDED','REASSIGNMENT_DECIDED','PENDENCY_DECIDED','PENDENCY_RESOLVED')
    ) events ORDER BY created_at DESC,id DESC LIMIT 10`,[pid,u.id])
  ]);send(res,{tasks,activity});
}));
api.get('/me/submissions',handler(async(_req,res)=>{
  const u=currentUser(res);role(u,['MEMBER','PM']);
  send(res,await query(db,`SELECT * FROM (
    SELECT r.id,r.task_id,t.project_id,t.title,p.name AS project_name,'RESULT'::text AS kind,r.submitted_at AS created_at,r.review_status AS state,r.review_comment AS reviewer_comment,r.work_completed AS summary FROM task_results r JOIN tasks t ON t.id=r.task_id JOIN projects p ON p.id=t.project_id WHERE r.submitted_by=$1
    UNION ALL
    SELECT e.id,e.task_id,t.project_id,t.title,p.name,'EXTENSION',e.created_at,e.status,e.decision_comment,e.reason FROM due_date_extensions e JOIN tasks t ON t.id=e.task_id JOIN projects p ON p.id=t.project_id WHERE e.requested_by=$1
    UNION ALL
    SELECT a.id,a.task_id,t.project_id,t.title,p.name,'REASSIGNMENT',a.created_at,a.status,a.decision_comment,a.reason FROM reassignments a JOIN tasks t ON t.id=a.task_id JOIN projects p ON p.id=t.project_id WHERE a.requested_by=$1
    UNION ALL
    SELECT q.id,q.blocked_task_id,t.project_id,t.title,p.name,'PREREQUISITE',q.created_at,CASE WHEN q.status='AWAITING_APPROVAL' THEN 'PENDING' WHEN q.status='REJECTED' THEN 'REJECTED' ELSE 'APPROVED' END,q.resolution,q.description FROM pendencies q JOIN tasks t ON t.id=q.blocked_task_id JOIN projects p ON p.id=t.project_id WHERE q.raised_by=$1
  ) submissions ORDER BY created_at DESC,kind,id DESC`,[u.id]));
}));

api.get('/me/pending-actions',handler(async(_req,res)=>{
  const u=currentUser(res);role(u,['PM','REVIEWER']);
  const [results,extensions,reassignments,approvals,resolutions]=await Promise.all([
    query(db,`SELECT r.id,t.id AS task_id,t.project_id,t.title,t.due_date,'RESULT_REVIEW' AS kind,r.submitted_at AS requested_at,r.work_completed AS summary,u.full_name AS submitted_by,(SELECT coalesce(array_agg(json_build_object('id',a.id,'name',a.original_name)),'{}') FROM attachments a WHERE a.result_id=r.id) AS files FROM task_results r JOIN tasks t ON t.id=r.task_id JOIN projects p ON p.id=t.project_id JOIN users u ON u.id=r.submitted_by WHERE p.manager_id=$1 AND r.review_status='PENDING'`,[u.id]),
    query(db,`SELECT e.id,t.id AS task_id,t.project_id,t.title,t.due_date,'EXTENSION' AS kind,e.created_at AS requested_at,e.reason AS summary,u.full_name AS submitted_by,e.new_due_date FROM due_date_extensions e JOIN tasks t ON t.id=e.task_id JOIN projects p ON p.id=t.project_id JOIN users u ON u.id=e.requested_by WHERE p.manager_id=$1 AND e.status='PENDING'`,[u.id]),
    query(db,`SELECT r.id,t.id AS task_id,t.project_id,t.title,t.due_date,'REASSIGNMENT' AS kind,r.created_at AS requested_at,r.reason AS summary,u.full_name AS submitted_by,r.work_from,r.work_until,nu.full_name AS new_owner_name FROM reassignments r JOIN tasks t ON t.id=r.task_id JOIN users u ON u.id=r.requested_by JOIN users nu ON nu.id=r.new_owner_id WHERE r.reviewer_id=$1 AND r.status='PENDING'`,[u.id]),
    query(db,`SELECT p.id,p.blocked_task_id AS task_id,t.project_id,t.title,t.due_date,'PENDENCY_APPROVAL' AS kind,p.created_at AS requested_at,p.description AS summary,u.full_name AS submitted_by FROM pendencies p JOIN tasks t ON t.id=p.blocked_task_id JOIN users u ON u.id=p.raised_by WHERE p.approver_id=$1 AND p.status='AWAITING_APPROVAL'`,[u.id]),
    query(db,`SELECT p.id,p.blocked_task_id AS task_id,t.project_id,t.title,t.due_date,'PENDENCY_RESOLVE' AS kind,p.created_at AS requested_at,p.description AS summary,u.full_name AS submitted_by FROM pendencies p JOIN tasks t ON t.id=p.blocked_task_id JOIN users u ON u.id=p.raised_by WHERE p.responsible_user_id=$1 AND p.status='OPEN'`,[u.id])
  ]);send(res,[...results,...extensions,...reassignments,...approvals,...resolutions].sort((a,b)=>String(a.requested_at).localeCompare(String(b.requested_at))));
}));
api.post('/decisions/undo',handler(async(req,res)=>{
  const u=currentUser(res),d=parse(z.object({kind:z.enum(['RESULT_REVIEW','EXTENSION','REASSIGNMENT','PENDENCY_APPROVAL']),id:z.number().int().positive()}),req.body);
  const table=d.kind==='RESULT_REVIEW'?'task_results':d.kind==='EXTENSION'?'due_date_extensions':d.kind==='REASSIGNMENT'?'reassignments':'pendencies';
  const record=await one<Record<string,unknown>>(db,`SELECT * FROM ${table} WHERE id=$1`,[d.id]);if(!record)throw new HttpError(404,'Decision not found');
  const task=await taskById(Number(d.kind==='PENDENCY_APPROVAL'?record.blocked_task_id:record.task_id));await projectManager(u,task.project_id);
  const decidedAt=d.kind==='RESULT_REVIEW'?record.reviewed_at:d.kind==='PENDENCY_APPROVAL'?null:record.decided_at;
  const last=await one<{event_type:string;created_at:string;actor_id:number}>(db,'SELECT event_type,created_at,actor_id FROM task_history WHERE task_id=$1 ORDER BY id DESC LIMIT 1',[task.id]);
  const expected=d.kind==='RESULT_REVIEW'?'RESULT_REVIEWED':d.kind==='EXTENSION'?'EXTENSION_DECIDED':d.kind==='REASSIGNMENT'?'REASSIGNMENT_DECIDED':'PENDENCY_DECIDED';
  const when=decidedAt?new Date(String(decidedAt)).getTime():last?new Date(last.created_at).getTime():0;
  if(!last||last.event_type!==expected||Number(last.actor_id)!==u.id||Date.now()-when>30000)throw new HttpError(409,'Undo is no longer available');
  await db.transaction().execute(async tx=>{
    if(d.kind==='RESULT_REVIEW'){
      const review=String(record.review_status),status=review==='ACCEPTED'?'DONE':'RETURNED';if(!['ACCEPTED','RETURNED'].includes(review)||task.status!==status)throw new HttpError(409,'Task changed since decision');
      await query(tx,"UPDATE task_results SET review_status='PENDING',review_comment=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=$1",[d.id]);await query(tx,"UPDATE tasks SET status='SUBMITTED',updated_at=now() WHERE id=$1",[task.id]);
    }else if(d.kind==='EXTENSION'){
      if(record.status==='PENDING'||record.status==='APPROVED'&&String(task.due_date).slice(0,10)!==String(record.new_due_date).slice(0,10))throw new HttpError(409,'Task changed since decision');
      await query(tx,"UPDATE due_date_extensions SET status='PENDING',decided_by=NULL,decided_at=NULL,decision_comment=NULL WHERE id=$1",[d.id]);if(record.status==='APPROVED')await query(tx,'UPDATE tasks SET due_date=$1,updated_at=now() WHERE id=$2',[record.old_due_date,task.id]);
    }else if(d.kind==='REASSIGNMENT'){
      if(record.status==='PENDING'||record.status==='APPROVED'&&task.owner_id!==Number(record.new_owner_id))throw new HttpError(409,'Task changed since decision');
      await query(tx,"UPDATE reassignments SET status='PENDING',decided_at=NULL,decided_by=NULL,decision_comment=NULL WHERE id=$1",[d.id]);if(record.status==='APPROVED')await query(tx,'UPDATE tasks SET owner_id=$1,updated_at=now() WHERE id=$2',[record.original_owner_id,task.id]);
    }else{
      if(!['OPEN','REJECTED'].includes(String(record.status)))throw new HttpError(409,'Prerequisite changed since decision');
      await query(tx,"UPDATE pendencies SET status='AWAITING_APPROVAL',resolution=NULL WHERE id=$1",[d.id]);
    }
    await history(tx,task.project_id,task.id,'DECISION_UNDONE',u.id,{kind:d.kind,decision_id:d.id});
  });send(res,{ok:true});
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
api.get('/projects/:projectId/audit',handler(async(req,res)=>{const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);send(res,await query(db,'SELECT a.*,u.full_name AS actor_name FROM audit_log a JOIN users u ON u.id=a.actor_id WHERE a.project_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 500',[pid]));}));
api.get('/projects/:projectId/dashboard',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const rows=await query<{status:string;owner_id:number;count:number;overdue_count:number}>(db,`SELECT status,owner_id,count(*)::int AS count,count(*) FILTER(WHERE due_date<current_date AND status<>'DONE')::int AS overdue_count FROM tasks WHERE project_id=$1 GROUP BY status,owner_id`,[pid]);
  const byStatus:Record<string,number>={NOT_STARTED:0,IN_PROGRESS:0,SUBMITTED:0,RETURNED:0,DONE:0},byOwner:Record<string,number>={};let total=0,overdue=0;
  for(const r of rows){const n=Number(r.count);total+=n;overdue+=Number(r.overdue_count);byStatus[r.status]=(byStatus[r.status]||0)+n;byOwner[String(r.owner_id)]=(byOwner[String(r.owner_id)]||0)+n;}
  send(res,{total,overdue,by_status:byStatus,by_owner:byOwner,completed:byStatus.DONE || 0,pending:total-(byStatus.DONE || 0)});
}));
api.get('/projects/:projectId/risk',handler(async(req,res)=>{
  const u=currentUser(res),pid=id(req.params.projectId);await projectManager(u,pid);
  const [tasks,activity,project]=await Promise.all([
    query(db,`SELECT t.id,t.title,t.owner_id,t.status,t.due_date,greatest(t.updated_at,coalesce((SELECT max(h.created_at) FROM task_history h WHERE h.task_id=t.id),t.updated_at)) AS updated_at,u.full_name AS owner_name FROM tasks t JOIN users u ON u.id=t.owner_id WHERE t.project_id=$1 ORDER BY t.due_date NULLS LAST,t.id`,[pid]),
    query(db,`SELECT h.id,h.task_id,h.event_type,h.created_at,u.full_name AS actor_name,t.title AS task_title FROM task_history h JOIN users u ON u.id=h.actor_id LEFT JOIN tasks t ON t.id=h.task_id WHERE h.project_id=$1 ORDER BY h.created_at DESC,h.id DESC LIMIT 10`,[pid]),
    one(db,'SELECT target_date FROM projects WHERE id=$1',[pid])
  ]);send(res,{tasks,activity,deadline:project?.target_date||null});
}));
async function report(user:User,kind:'overdue'|'progress',params:Record<string,unknown>){
  role(user,['PM']);const projectId=id(params.project_id);await projectManager(user,projectId);
  const status=typeof params.status==='string'&&params.status?params.status:null,owner=typeof params.owner_id==='string'&&params.owner_id?id(params.owner_id):null;
  const predicate=kind==='overdue'?"AND t.due_date<current_date AND t.status<>'DONE'":'';
  return query(db,`SELECT t.id,t.title,t.status,t.priority,t.due_date,t.owner_id,u.full_name AS owner_name,t.created_at FROM tasks t JOIN users u ON u.id=t.owner_id WHERE t.project_id=$1 AND ($2::text IS NULL OR t.status=$2) AND ($3::bigint IS NULL OR t.owner_id=$3) ${predicate} ORDER BY t.due_date NULLS LAST,t.id`,[projectId,status,owner]);
}
for(const kind of ['overdue','progress'] as const){
  api.get(`/reports/${kind}`,handler(async(req,res)=>{send(res,await report(currentUser(res),kind,req.query));}));
  api.get(`/reports/${kind}.csv`,handler(async(req,res)=>{const rows=await report(currentUser(res),kind,req.query);res.type('text/csv').attachment(`${kind}.csv`).send(csv(rows,['id','title','status','priority','due_date','owner_id','owner_name','created_at']));}));
}
api.use(fileRoutes);

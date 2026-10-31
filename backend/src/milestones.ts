import {Router} from 'express';
import {z} from 'zod';
import {db,one,query} from './db.js';
import {currentUser,handler,history,HttpError,projectManager,projectMember,taskById,uid} from './core.js';

export const milestoneRoutes=Router();
const input=z.object({name:z.string().trim().min(1).max(200),due_date:z.string().date()});

milestoneRoutes.get('/projects/:projectId/milestones',handler(async(req,res)=>{
  const user=currentUser(res),projectId=uid(req.params.projectId);await projectMember(user,projectId);
  res.json(await query(db,`SELECT m.id,m.project_id,m.name,m.due_date,count(t.id)::int AS task_total,count(t.id) FILTER (WHERE t.status='DONE')::int AS task_done
    FROM milestones m LEFT JOIN tasks t ON t.milestone_id=m.id
    WHERE m.project_id=$1 GROUP BY m.id ORDER BY m.due_date,m.id`,[projectId]));
}));
milestoneRoutes.post('/projects/:projectId/milestones',handler(async(req,res)=>{
  const user=currentUser(res),projectId=uid(req.params.projectId);await projectManager(user,projectId);const data=input.parse(req.body);
  const project=await one<{target_date:string|null}>(db,'SELECT target_date FROM projects WHERE id=$1',[projectId]);
  if(project?.target_date&&data.due_date>project.target_date.slice(0,10))throw new HttpError(400,'Milestone due date must be on or before the project due date');
  const created=await db.transaction().execute(async tx=>{
    const row=await one(tx,'INSERT INTO milestones(project_id,name,due_date,created_by) VALUES($1,$2,$3,$4) RETURNING *',[projectId,data.name,data.due_date,user.id]);
    await history(tx,projectId,null,'MILESTONE_CREATED',user.id,{milestone_id:(row as {id:number}).id,name:data.name,due_date:data.due_date});return row;
  });res.status(201).json(created);
}));
milestoneRoutes.patch('/tasks/:taskId/milestone',handler(async(req,res)=>{
  const user=currentUser(res),task=await taskById(uid(req.params.taskId));
  const project=await projectMember(user,task.project_id);
  if(!(user.role==='PM'&&project.manager_id===user.id)&&!(task.sub_project_id&&task.sub_project_owner_id===user.id))throw new HttpError(403,'Only the PM or sub-project owner can link a milestone');
  const {milestone_id}=z.object({milestone_id:z.number().int().positive().nullable()}).strict().parse(req.body);
  if(milestone_id&&!await one(db,'SELECT 1 FROM milestones WHERE id=$1 AND project_id=$2',[milestone_id,task.project_id]))throw new HttpError(400,'Milestone must belong to the task project');
  await db.transaction().execute(async tx=>{
    await query(tx,'UPDATE tasks SET milestone_id=$1,updated_at=now() WHERE id=$2',[milestone_id,task.id]);
    await history(tx,task.project_id,task.id,'TASK_MILESTONE_CHANGED',user.id,{old:task.milestone_id,new:milestone_id});
  });res.json({milestone_id});
}));

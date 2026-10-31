import {Router} from 'express';
import {z} from 'zod';
import {db,one,query,type Executor} from './db.js';
import {currentUser,getProject,handler,history,HttpError,notify,projectMember,uid,type User} from './core.js';

export const meetingRoutes=Router();
const actionInput=z.object({description:z.string().trim().min(1).max(200),owner_id:z.number().int().positive(),due_date:z.string().date()});
const meetingInput=z.object({title:z.string().trim().min(1).max(200),meeting_date:z.string().date(),sub_project_id:z.number().int().positive().nullable().optional(),minutes:z.string().trim().min(1).max(20000),attendee_ids:z.array(z.number().int().positive()).min(1),actions:z.array(actionInput).default([])});
type Meeting={id:number;project_id:number;sub_project_id:number|null;title:string;meeting_date:string;minutes:string;created_by:number};
type Action=z.infer<typeof actionInput>;
const source=(title:string,date:string)=>`${title}, ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date.slice(0,10)+'T00:00:00Z'))}`;

async function editable(user:User,projectId:number,subProjectId:number|null){
  const project=await projectMember(user,projectId);
  if(user.role==='PM'&&project.manager_id===user.id)return;
  if(subProjectId&&await one(db,'SELECT 1 FROM sub_projects WHERE id=$1 AND project_id=$2 AND owner_id=$3',[subProjectId,projectId,user.id]))return;
  throw new HttpError(403,'Only the PM or sub-project owner can edit this meeting');
}
async function meetingById(meetingId:number){const item=await one<Meeting>(db,'SELECT id,project_id,sub_project_id,title,meeting_date,minutes,created_by FROM meetings WHERE id=$1',[meetingId]);if(!item)throw new HttpError(404,'Meeting not found');return item;}
async function validatePeople(projectId:number,attendees:number[],actions:Action[]){
  const project=await getProject(projectId),ids=[...new Set([...attendees,...actions.map(item=>item.owner_id)])];
  const rows=await query<{id:number}>(db,'SELECT u.id FROM users u WHERE u.id=ANY($1::bigint[]) AND u.active AND (u.id=$2 OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=$3 AND pm.user_id=u.id))',[ids,project.manager_id,projectId]);
  if(rows.length!==ids.length)throw new HttpError(400,'Attendees and action owners must be active project members');
}
async function validateDates(projectId:number,subProjectId:number|null,actions:Action[]){
  const project=await one<{target_date:string|null}>(db,'SELECT target_date FROM projects WHERE id=$1',[projectId]);
  const sub=subProjectId?await one<{due_date:string}>(db,'SELECT due_date FROM sub_projects WHERE id=$1 AND project_id=$2',[subProjectId,projectId]):null;
  if(subProjectId&&!sub)throw new HttpError(400,'Sub-project must belong to the project');
  for(const item of actions){if(project?.target_date&&item.due_date>=project.target_date.slice(0,10))throw new HttpError(400,'Action due date must be before the project due date');if(sub&&item.due_date>sub.due_date.slice(0,10))throw new HttpError(400,'Action due date must be on or before the sub-project due date');}
}
async function addActions(tx:Executor,meeting:Meeting,items:Action[],actorId:number){
  const taskIds:number[]=[];
  for(const item of items){
    const task=await one<{id:number}>(tx,`INSERT INTO tasks(project_id,sub_project_id,title,description,expected_deliverables,owner_id,priority,due_date,status,visibility,created_by,source_meeting_id,source_meeting_title) VALUES($1,$2,$3,$4,$5,$6,'MEDIUM',$7,'NOT_STARTED','PRIVATE',$8,$9,$10) RETURNING id`,[meeting.project_id,meeting.sub_project_id,item.description,item.description,'Complete the meeting action and attach evidence.',item.owner_id,item.due_date,actorId,meeting.id,source(meeting.title,meeting.meeting_date)]);
    await history(tx,meeting.project_id,task!.id,'TASK_CREATED',actorId,{title:item.description,owner_id:item.owner_id,source_meeting_id:meeting.id});taskIds.push(task!.id);
  }
  return taskIds;
}
async function notifyActions(items:Action[],ids:number[],meeting:Meeting){for(const [index,item] of items.entries())await notify('ASSIGNED',item.owner_id,ids[index]!,`Meeting action assigned: ${item.description}`,`From: ${source(meeting.title,meeting.meeting_date)}`);}

meetingRoutes.get('/projects/:projectId/meetings',handler(async(req,res)=>{
  const user=currentUser(res),projectId=uid(req.params.projectId);await projectMember(user,projectId);
  res.json(await query(db,`SELECT m.id,m.project_id,m.sub_project_id,m.title,m.meeting_date,m.minutes,m.created_at,sp.name AS sub_project_name,u.full_name AS created_by_name,count(t.id)::int AS action_total,count(t.id) FILTER (WHERE t.status='DONE')::int AS action_done FROM meetings m LEFT JOIN sub_projects sp ON sp.id=m.sub_project_id JOIN users u ON u.id=m.created_by LEFT JOIN tasks t ON t.source_meeting_id=m.id WHERE m.project_id=$1 GROUP BY m.id,sp.name,u.full_name ORDER BY m.meeting_date DESC,m.id DESC`,[projectId]));
}));
meetingRoutes.get('/sub-projects/:subProjectId/meetings',handler(async(req,res)=>{
  const user=currentUser(res),subProjectId=uid(req.params.subProjectId);const sub=await one<{project_id:number}>(db,'SELECT project_id FROM sub_projects WHERE id=$1',[subProjectId]);if(!sub)throw new HttpError(404,'Sub-project not found');await projectMember(user,sub.project_id);
  res.json(await query(db,`SELECT m.id,m.project_id,m.sub_project_id,m.title,m.meeting_date,m.minutes,m.created_at,count(t.id)::int AS action_total,count(t.id) FILTER (WHERE t.status='DONE')::int AS action_done FROM meetings m LEFT JOIN tasks t ON t.source_meeting_id=m.id WHERE m.sub_project_id=$1 GROUP BY m.id ORDER BY m.meeting_date DESC,m.id DESC`,[subProjectId]));
}));
meetingRoutes.post('/projects/:projectId/meetings',handler(async(req,res)=>{
  const user=currentUser(res),projectId=uid(req.params.projectId),input=meetingInput.parse(req.body),subProjectId=input.sub_project_id||null;
  await editable(user,projectId,subProjectId);await validatePeople(projectId,input.attendee_ids,input.actions);await validateDates(projectId,subProjectId,input.actions);
  const {meeting,taskIds}=await db.transaction().execute(async tx=>{
    const meeting=await one<Meeting>(tx,'INSERT INTO meetings(project_id,sub_project_id,title,meeting_date,minutes,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[projectId,subProjectId,input.title,input.meeting_date,input.minutes,user.id]);
    for(const attendeeId of new Set(input.attendee_ids))await query(tx,'INSERT INTO meeting_attendees(meeting_id,user_id) VALUES($1,$2)',[meeting!.id,attendeeId]);
    await history(tx,projectId,null,'MEETING_CREATED',user.id,{meeting_id:meeting!.id,title:input.title,action_count:input.actions.length});
    return {meeting:meeting!,taskIds:await addActions(tx,meeting!,input.actions,user.id)};
  });
  await notifyActions(input.actions,taskIds,meeting);res.status(201).json({id:meeting.id,task_ids:taskIds});
}));
meetingRoutes.get('/meetings/:meetingId',handler(async(req,res)=>{
  const user=currentUser(res),meeting=await meetingById(uid(req.params.meetingId)),project=await projectMember(user,meeting.project_id);
  const canEdit=user.role==='PM'&&project.manager_id===user.id||!!meeting.sub_project_id&&!!await one(db,'SELECT 1 FROM sub_projects WHERE id=$1 AND owner_id=$2',[meeting.sub_project_id,user.id]);
  const [attendees,actions]=await Promise.all([
    query(db,'SELECT u.id,u.full_name FROM meeting_attendees ma JOIN users u ON u.id=ma.user_id WHERE ma.meeting_id=$1 ORDER BY u.full_name',[meeting.id]),
    query(db,`SELECT t.id,t.title AS description,t.owner_id,u.full_name AS owner_name,t.due_date,t.status FROM tasks t JOIN users u ON u.id=t.owner_id WHERE t.source_meeting_id=$1 ORDER BY t.due_date,t.id`,[meeting.id])
  ]);res.json({...meeting,attendees,actions,can_edit:canEdit});
}));
meetingRoutes.patch('/meetings/:meetingId',handler(async(req,res)=>{
  const user=currentUser(res),meeting=await meetingById(uid(req.params.meetingId));await editable(user,meeting.project_id,meeting.sub_project_id);
  const input=meetingInput.omit({sub_project_id:true,actions:true}).partial().strict().parse(req.body);if(!Object.keys(input).length)throw new HttpError(400,'No changes');
  if(input.attendee_ids)await validatePeople(meeting.project_id,input.attendee_ids,[]);
  const updated=await db.transaction().execute(async tx=>{
    const fields=Object.entries(input).filter(([key])=>key!=='attendee_ids');
    if(fields.length)await query(tx,`UPDATE meetings SET ${fields.map(([key],index)=>`${key}=$${index+1}`).join(',')},updated_at=now() WHERE id=$${fields.length+1}`,[...fields.map(([,value])=>value),meeting.id]);
    else await query(tx,'UPDATE meetings SET updated_at=now() WHERE id=$1',[meeting.id]);
    if(input.attendee_ids){await query(tx,'DELETE FROM meeting_attendees WHERE meeting_id=$1',[meeting.id]);for(const attendeeId of new Set(input.attendee_ids))await query(tx,'INSERT INTO meeting_attendees(meeting_id,user_id) VALUES($1,$2)',[meeting.id,attendeeId]);}
    const next={...meeting,...input};
    if(input.title||input.meeting_date)await query(tx,'UPDATE tasks SET source_meeting_title=$1 WHERE source_meeting_id=$2',[source(next.title,next.meeting_date),meeting.id]);
    await history(tx,meeting.project_id,null,'MEETING_UPDATED',user.id,{meeting_id:meeting.id,changes:input});return next;
  });res.json(updated);
}));
meetingRoutes.post('/meetings/:meetingId/actions',handler(async(req,res)=>{
  const user=currentUser(res),meeting=await meetingById(uid(req.params.meetingId));await editable(user,meeting.project_id,meeting.sub_project_id);
  const items=z.array(actionInput).min(1).parse(req.body?.actions);await validatePeople(meeting.project_id,[],items);await validateDates(meeting.project_id,meeting.sub_project_id,items);
  const ids=await db.transaction().execute(tx=>addActions(tx,meeting,items,user.id));await notifyActions(items,ids,meeting);res.status(201).json({task_ids:ids});
}));

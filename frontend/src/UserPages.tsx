import {useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,post,dateOnly,dueClass,dueLabel,formatDate,statusLabel,type Attachment,type Task,type User} from './api';
import {WorkspaceTaskTable} from './Workspace';

type Run=(action:()=>Promise<unknown>,success?:string)=>void;
type WorkTask=Task&{return_reason?:string|null};
type WorkEvent={id:number;task_id:number;title:string;created_at:string;event_type:string;detail:string;actor_name:string};
type Work={tasks:WorkTask[];activity:WorkEvent[];sub_projects:{id:number;name:string;due_date:string|null;task_total:number;task_done:number;overdue_count:number}[];reviews:{id:number;task_id:number;title:string;sub_project_name:string;submitted_at:string;submitted_by:string}[]};
type Submission={id:number;task_id:number;project_id:number;title:string;project_name:string;kind:'RESULT'|'EXTENSION'|'REASSIGNMENT'|'PREREQUISITE';created_at:string;state:string;reviewer_comment:string|null;summary:string};
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const weekEnd=(key:string)=>{const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+6);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dueSort=(a:Task,b:Task)=>String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'))||a.id-b.id;
const eventText=(event:WorkEvent)=>{
  switch(event.event_type){
    case 'COMMENT':return `${event.actor_name} commented: ${event.detail}`;
    case 'RESULT_REVIEWED':return `${event.actor_name} reviewed your submission${event.detail?`: ${event.detail}`:'.'}`;
    case 'EXTENSION_DECIDED':return `${event.actor_name} answered your due date request${event.detail?`: ${event.detail}`:'.'}`;
    case 'REASSIGNMENT_DECIDED':return `${event.actor_name} answered your reassignment request${event.detail?`: ${event.detail}`:'.'}`;
    case 'PENDENCY_DECIDED':return `${event.actor_name} answered a prerequisite request${event.detail?`: ${event.detail}`:'.'}`;
    case 'PENDENCY_RESOLVED':return `${event.actor_name} resolved a prerequisite${event.detail?`: ${event.detail}`:'.'}`;
    case 'STATUS_CHANGED':return `${event.actor_name} changed the task status.`;
    default:return `${event.actor_name} updated the task.`;
  }
};
export function WorkTaskAction({task,run}:{task:Task;run:Run}){
  const [submitting,setSubmitting]=useState(false);
  const attachments=useQuery({queryKey:['attachments',task.id],queryFn:()=>api<Attachment[]>(`/tasks/${task.id}/attachments`),enabled:submitting});
  const readyFiles=(attachments.data||[]).filter(file=>!file.result_id);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,summary=String(new FormData(form).get('summary')||'').trim();run(async()=>{await post(`/tasks/${task.id}/results`,{work_completed:summary,outcome:summary,attachment_ids:readyFiles.map(file=>file.id)});setSubmitting(false);form.reset()},'Submitted for review')}
  if(task.status==='NOT_STARTED')return <button className="primary" onClick={()=>run(()=>post(`/tasks/${task.id}/status`,{}),'Task started')}>Start</button>;
  if(!['IN_PROGRESS','RETURNED'].includes(task.status))return null;
  return <div className="work-action">{submitting?<form onSubmit={submit}><textarea name="summary" aria-label={`Result summary for ${task.title}`} placeholder="Summarise the work delivered" required rows={2}/><div className="button-row"><button type="button" onClick={()=>setSubmitting(false)}>Cancel</button><button className="primary" disabled={!readyFiles.length}>Submit</button></div>{!readyFiles.length&&<small className="evidence-hint">Attach at least one file (report, drawing, results) in the task first.</small>}</form>:<><button className="primary" disabled={!task.available_file_count} onClick={()=>setSubmitting(true)}>Submit for review</button>{!task.available_file_count&&<small className="evidence-hint">Attach at least one file in the task first.</small>}</>}</div>;
}
function TaskList({tasks,onTask,run}:{tasks:WorkTask[];onTask:(id:number)=>void;run:Run}){return <div className="work-task-list">{tasks.map(task=><div className="work-task-row" key={task.id}><button className="work-task-open" onClick={()=>onTask(task.id)}><strong>{task.title}</strong>{task.risk_flag&&<span className="task-risk-chip" title={task.risk_reason||undefined}>At risk</span>}{task.source_meeting_title&&<small className="meeting-source">From: {task.source_meeting_title}</small>}<small>{statusLabel(task.status)} · <span className={dueClass(task.due_date)}>{dueLabel(task.due_date)}</span></small></button><WorkTaskAction task={task} run={run}/></div>)}</div>}
function WorkGroup({title,tasks,onTask,run}:{title:string;tasks:WorkTask[];onTask:(id:number)=>void;run:Run}){return tasks.length?<section className="work-group"><h3>{title} <small>{tasks.length}</small></h3><TaskList tasks={tasks} onTask={onTask} run={run}/></section>:null}
export function UserHome({projectId,onTask,onSubmissions,onReview,run}:{projectId:number|null;onTask:(id:number)=>void;onSubmissions:()=>void;onReview:()=>void;run:Run}){
  const work=useQuery({queryKey:['work',projectId],queryFn:()=>api<Work>(`/me/work?project_id=${projectId}`),enabled:!!projectId});
  if(!projectId)return <section className="card"><p>Select a project to see your work.</p></section>;
  const tasks=work.data?.tasks||[],date=today(),end=weekEnd(date);
  const returned=tasks.filter(t=>t.status==='RETURNED').sort(dueSort),open=tasks.filter(t=>['NOT_STARTED','IN_PROGRESS'].includes(t.status));
  const overdue=open.filter(t=>!!t.due_date&&dateOnly(t.due_date)<date).sort(dueSort);
  const dueWeek=open.filter(t=>!!t.due_date&&dateOnly(t.due_date)>=date&&dateOnly(t.due_date)<=end).sort(dueSort);
  const later=open.filter(t=>t.status==='IN_PROGRESS'&&(!t.due_date||dateOnly(t.due_date)>end)).sort(dueSort);
  const notStarted=open.filter(t=>t.status==='NOT_STARTED'&&(!t.due_date||dateOnly(t.due_date)>end)).sort(dueSort);
  const awaiting=tasks.filter(t=>t.status==='SUBMITTED').sort(dueSort);
  const ownedSubProjects=work.data?.sub_projects||[],reviews=work.data?.reviews||[];
  return <div className="user-home">{returned.length>0&&<section className="card returned-work"><h2>Returned to you <small>{returned.length}</small></h2>{returned.map(task=><div className="returned-item" key={task.id}><div><button className="table-link" onClick={()=>onTask(task.id)}>{task.title}</button>{task.source_meeting_title&&<small className="meeting-source">From: {task.source_meeting_title}</small>}<p className="preserve-lines">{task.return_reason||'The project manager returned this for changes.'}</p><small className={dueClass(task.due_date)}>{dueLabel(task.due_date)}</small></div><WorkTaskAction task={task} run={run}/></div>)}</section>}
    <div className="user-work-grid"><section className="card"><h2>My open tasks</h2>{work.isLoading?<p className="muted">Loading your tasks…</p>:open.length?<><WorkGroup title="Overdue" tasks={overdue} onTask={onTask} run={run}/><WorkGroup title="Due this week" tasks={dueWeek} onTask={onTask} run={run}/><WorkGroup title="Later" tasks={later} onTask={onTask} run={run}/><WorkGroup title="Not started" tasks={notStarted} onTask={onTask} run={run}/></>:<p className="muted">{returned.length?'Your returned tasks are shown above. You have no other open tasks.':'You have no open tasks in this project.'}</p>}</section><aside className="user-work-side">{ownedSubProjects.length>0&&<><section className="card"><h2>Waiting for my review <small>{reviews.length}</small></h2>{reviews.length?reviews.map(item=><button className="bento-row" key={item.id} onClick={onReview}><strong>{item.title}</strong><small>{item.sub_project_name} · {item.submitted_by} · {formatDate(item.submitted_at)}</small></button>):<p className="muted">No submissions are waiting for your review.</p>}<button onClick={onReview}>Open review queue</button></section><section className="card"><h2>My sub-projects</h2>{ownedSubProjects.map(item=><div className="sub-project-summary" key={item.id}><strong>{item.name}</strong><small>{item.task_done} of {item.task_total} tasks done · {item.overdue_count} overdue</small><progress value={item.task_done} max={Math.max(item.task_total,1)}/><small className={dueClass(item.due_date)}>Due {dueLabel(item.due_date)}</small></div>)}</section></>}<section className="card"><h2>Awaiting review</h2>{awaiting.length?awaiting.map(task=><button className="bento-row" key={task.id} onClick={()=>onTask(task.id)}><strong>{task.title}</strong>{task.risk_flag&&<span className="task-risk-chip" title={task.risk_reason||undefined}>At risk</span>}{task.source_meeting_title&&<small className="meeting-source">From: {task.source_meeting_title}</small>}<small>Submitted · awaiting review</small></button>):<p className="muted">No submissions are awaiting review.</p>}<button onClick={onSubmissions}>View all submissions and requests</button></section><section className="card"><h2>Activity on my tasks</h2>{work.data?.activity.length?work.data.activity.map(event=><button className="activity-summary" key={event.event_type+event.id} onClick={()=>onTask(event.task_id)}><span className="preserve-lines">{eventText(event)} <strong>{event.title}</strong></span><small>{formatDate(event.created_at)}</small></button>):<p className="muted">No recent updates on your tasks.</p>}</section></aside></div>
  </div>;
}
export function UserTasks({user,projectId,onTask,run}:{user:User;projectId:number|null;onTask:(id:number)=>void;run:Run}){
  const [tab,setTab]=useState<'mine'|'shared'>('mine');
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!projectId});
  const mine=(tasks.data||[]).filter(t=>t.owner_id===user.id),shared=(tasks.data||[]).filter(t=>t.owner_id!==user.id&&(t.visibility==='GROUP'||!!t.sub_project_id));
  return <><div className="pm-tabs"><button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}>My tasks</button><button className={tab==='shared'?'active':''} onClick={()=>setTab('shared')}>Shared with me</button></div><section className={'card'+(tab==='shared'?' shared-task-table':'')}><h2>{tab==='mine'?'My tasks':'Shared with me'}</h2>{tab==='shared'&&<p className="muted">Shared tasks are available to view and comment on. The owner handles status and submission.</p>}<WorkspaceTaskTable tasks={tab==='mine'?mine:shared} onTask={onTask} renderActions={tab==='mine'?task=><WorkTaskAction task={task} run={run}/>:undefined}/></section></>;
}
export function MySubmissions({onTask}:{onTask:(taskId:number,projectId:number)=>void}){
  const submissions=useQuery({queryKey:['my-submissions'],queryFn:()=>api<Submission[]>('/me/submissions')});
  const label=(state:string)=>({PENDING:'Pending',ACCEPTED:'Accepted',RETURNED:'Returned',APPROVED:'Approved',REJECTED:'Declined'} as Record<string,string>)[state]||state;
  const kind=(value:string)=>({RESULT:'Result',EXTENSION:'Due date extension',REASSIGNMENT:'Reassignment',PREREQUISITE:'Prerequisite request'} as Record<string,string>)[value]||value;
  return <section className="card"><h2>My submissions</h2>{submissions.isLoading?<p className="muted">Loading submissions…</p>:submissions.data?.length?submissions.data.map(item=><article className={'submission-item'+(item.state==='RETURNED'?' returned':'')} key={`${item.kind}-${item.id}`}><div className="row"><button className="table-link" onClick={()=>onTask(item.task_id,item.project_id)}>{item.title}</button><span className={'pill '+item.state.toLowerCase()}>{label(item.state)}</span></div><small>{kind(item.kind)} · {item.project_name} · {formatDate(item.created_at)}</small><p className="preserve-lines">{item.summary}</p>{item.reviewer_comment&&<p className="reviewer-comment"><strong>Reviewer:</strong> {item.reviewer_comment}</p>}</article>):<p className="muted">You have not submitted work or made a request yet.</p>}</section>;
}

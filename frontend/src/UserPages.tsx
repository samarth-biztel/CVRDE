import {useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,post,dateOnly,dueClass,dueLabel,formatDate,statusLabel,type Attachment,type Task,type User} from './api';
import {WorkspaceTaskTable} from './Workspace';
import {demoMode} from './demoMode';

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
  const submissions=useQuery({queryKey:['my-submissions'],queryFn:()=>api<Submission[]>('/me/submissions'),enabled:!!projectId});
  if(!projectId)return <section className="card"><p>Select a project to see your work.</p></section>;
  const tasks=work.data?.tasks||[],date=today(),end=weekEnd(date);
  const returned=tasks.filter(t=>t.status==='RETURNED').sort(dueSort),open=tasks.filter(t=>['NOT_STARTED','IN_PROGRESS'].includes(t.status));
  const overdue=open.filter(t=>!!t.due_date&&dateOnly(t.due_date)<date).sort(dueSort);
  const dueWeek=open.filter(t=>!!t.due_date&&dateOnly(t.due_date)>=date&&dateOnly(t.due_date)<=end).sort(dueSort);
  const later=open.filter(t=>t.status==='IN_PROGRESS'&&(!t.due_date||dateOnly(t.due_date)>end)).sort(dueSort);
  const notStarted=open.filter(t=>t.status==='NOT_STARTED'&&(!t.due_date||dateOnly(t.due_date)>end)).sort(dueSort);
  const awaiting=tasks.filter(t=>t.status==='SUBMITTED').sort(dueSort);
  const ownedSubProjects=work.data?.sub_projects||[],reviews=work.data?.reviews||[];
  const recentActivity=(work.data?.activity||[]).filter(event=>event.event_type!=='RESULT_REVIEWED');
  const submissionHistory=(submissions.data||[]).filter(item=>item.project_id===projectId);
  return <div className="user-home">{returned.length>0&&<section className="card returned-work"><h2>Returned to you <small>{returned.length}</small></h2>{returned.map(task=><div className="returned-item" key={task.id}><div><button className="table-link" onClick={()=>onTask(task.id)}>{task.title}</button>{task.source_meeting_title&&<small className="meeting-source">From: {task.source_meeting_title}</small>}<p className="preserve-lines">{task.return_reason||'The project manager returned this for changes.'}</p><small className={dueClass(task.due_date)}>{dueLabel(task.due_date)}</small></div><WorkTaskAction task={task} run={run}/></div>)}</section>}
    <div className="user-work-grid"><section className="card"><h2>My open tasks</h2>{work.isLoading?<p className="muted">Loading your tasks…</p>:open.length?<><WorkGroup title="Overdue" tasks={overdue} onTask={onTask} run={run}/><WorkGroup title="Due in the next 7 days" tasks={dueWeek} onTask={onTask} run={run}/><WorkGroup title="Later" tasks={later} onTask={onTask} run={run}/><WorkGroup title="Not started" tasks={notStarted} onTask={onTask} run={run}/></>:<p className="muted">{returned.length?'Your returned tasks are shown above. You have no other open tasks.':'You have no open tasks in this project.'}</p>}</section><aside className="user-work-side">{ownedSubProjects.length>0&&<><section className="card"><h2>Waiting for my review <small>{reviews.length}</small></h2>{reviews.length?reviews.map(item=><button className="bento-row" key={item.id} onClick={onReview}><strong>{item.title}</strong><small>{item.sub_project_name} · {item.submitted_by} · {formatDate(item.submitted_at)}</small></button>):<p className="muted">No submissions are waiting for your review.</p>}<button onClick={onReview}>Open review queue</button></section><section className="card"><h2>My sub-projects</h2>{ownedSubProjects.map(item=><div className="sub-project-summary" key={item.id}><strong>{item.name}</strong><small>{item.task_done} of {item.task_total} tasks done · {item.overdue_count} overdue</small><progress value={item.task_done} max={Math.max(item.task_total,1)}/><small className={dueClass(item.due_date)}>Due {dueLabel(item.due_date)}</small></div>)}</section></>}<section className="card"><h2>Submitted and outcomes</h2>{submissionHistory.length?submissionHistory.map(item=><button className={'bento-row'+(item.state==='RETURNED'?' returned':'')} key={`${item.kind}-${item.id}`} onClick={()=>onTask(item.task_id)}><strong>{item.title}</strong><small>{item.kind==='RESULT'?'Result':item.kind==='EXTENSION'?'Due date request':item.kind==='REASSIGNMENT'?'Reassignment request':'Dependency request'} · {item.state==='PENDING'?'Awaiting review':item.state==='ACCEPTED'?'Done':item.state==='REJECTED'?'Declined':item.state[0]+item.state.slice(1).toLowerCase()} · {formatDate(item.created_at)}</small>{item.reviewer_comment&&<small>Reviewer: {item.reviewer_comment}</small>}</button>):<p className="muted">You have not submitted work or a request yet.</p>}{!demoMode&&<button onClick={onSubmissions}>View all submissions and requests</button>}</section><section className="card"><h2>Activity on my tasks</h2>{recentActivity.length?recentActivity.map(event=><button className="activity-summary" key={event.event_type+event.id} onClick={()=>onTask(event.task_id)}><span className="preserve-lines">{eventText(event)} <strong>{event.title}</strong></span><small>{formatDate(event.created_at)}</small></button>):<p className="muted">No recent updates on your tasks.</p>}</section></aside></div>
  </div>;
}
export function UserTasks({user,projectId,onTask,run}:{user:User;projectId:number|null;onTask:(id:number)=>void;run:Run}){
  const [tab,setTab]=useState<'mine'|'subproject'>('mine'),[dependencyTarget,setDependencyTarget]=useState<number|null>(null);
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!projectId});
  const subProjects=useQuery({queryKey:['sub-projects',projectId],queryFn:()=>api<{id:number;name:string;owner_id:number}[]>(`/projects/${projectId}/sub-projects`),enabled:!!projectId});
  const dependencyTasks=useQuery({queryKey:['dependency-tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks?scope=dependencies`),enabled:!!projectId&&tab==='subproject'});
  const mine=(tasks.data||[]).filter(t=>t.owner_id===user.id),ownedIds=new Set((subProjects.data||[]).filter(item=>item.owner_id===user.id).map(item=>item.id));
  const managed=(tasks.data||[]).filter(t=>t.owner_id!==user.id&&!!t.sub_project_id&&ownedIds.has(t.sub_project_id));
  const peers=(dependencyTasks.data||[]).filter(t=>!!t.sub_project_id&&!ownedIds.has(t.sub_project_id));
  return <><div className="pm-tabs"><button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}>My tasks</button><button className={tab==='subproject'?'active':''} onClick={()=>setTab('subproject')}>Sub-project tasks</button></div>
    {tab==='mine'?<section className="card"><h2>My tasks</h2><WorkspaceTaskTable tasks={mine} onTask={onTask} renderActions={task=><WorkTaskAction task={task} run={run}/>}/></section>:
      <div className="subproject-task-view">
        {managed.length>0&&<section className="card"><h2>Tasks I manage</h2><p className="muted">You can review and manage tasks in your sub-project.</p><WorkspaceTaskTable tasks={managed} onTask={onTask}/></section>}
        <section className="card"><h2>Related tasks for dependencies</h2><p className="muted">These are tasks in your sub-project. Use them only to raise a dependency on one of your own tasks.</p>
          {peers.length?peers.map(peer=>{const related=mine.filter(task=>task.sub_project_id===peer.sub_project_id);return <div className="dependency-peer" key={peer.id}><div><strong>{peer.title}</strong><small>{peer.sub_project_name} · {peer.owner_name} · {statusLabel(peer.status)} · <span className={dueClass(peer.due_date)}>{dueLabel(peer.due_date)}</span></small></div><button onClick={()=>setDependencyTarget(dependencyTarget===peer.id?null:peer.id)}>Raise dependency</button>{dependencyTarget===peer.id&&<form className="inline-form dependency-form" onSubmit={event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);run(async()=>{await post('/pendencies',{blocked_task_id:Number(data.get('blocked_task_id')),depends_on_task_ids:[peer.id],responsible_user_id:peer.owner_id,type:'ACTION',description:String(data.get('description')||'').trim(),needs_approval:true});setDependencyTarget(null)},'Dependency raised')}}><label>My task<select name="blocked_task_id" required><option value="">Choose your task</option>{related.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label>What is needed?<input name="description" maxLength={2000} required/></label><button className="primary">Send request</button></form>}</div>}):<p className="muted">{dependencyTasks.isLoading?'Loading related tasks…':'No other tasks in your sub-project are available for dependencies.'}</p>}
        </section>
      </div>}
  </>;
}
export function MySubmissions({onTask}:{onTask:(taskId:number,projectId:number)=>void}){
  const submissions=useQuery({queryKey:['my-submissions'],queryFn:()=>api<Submission[]>('/me/submissions')});
  const label=(state:string)=>({PENDING:'Pending',ACCEPTED:'Accepted',RETURNED:'Returned',APPROVED:'Approved',REJECTED:'Declined'} as Record<string,string>)[state]||state;
  const kind=(value:string)=>({RESULT:'Result',EXTENSION:'Due date extension',REASSIGNMENT:'Reassignment',PREREQUISITE:'Prerequisite request'} as Record<string,string>)[value]||value;
  return <section className="card"><h2>My submissions</h2>{submissions.isLoading?<p className="muted">Loading submissions…</p>:submissions.data?.length?submissions.data.map(item=><article className={'submission-item'+(item.state==='RETURNED'?' returned':'')} key={`${item.kind}-${item.id}`}><div className="row"><button className="table-link" onClick={()=>onTask(item.task_id,item.project_id)}>{item.title}</button><span className={'pill '+item.state.toLowerCase()}>{label(item.state)}</span></div><small>{kind(item.kind)} · {item.project_name} · {formatDate(item.created_at)}</small><p className="preserve-lines">{item.summary}</p>{item.reviewer_comment&&<p className="reviewer-comment"><strong>Reviewer:</strong> {item.reviewer_comment}</p>}</article>):<p className="muted">You have not submitted work or made a request yet.</p>}</section>;
}

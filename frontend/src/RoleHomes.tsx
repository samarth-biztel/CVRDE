import {useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,post,dateOnly,dueLabel,dueClass,statusLabel,formatDate,type Task,type Project,type User,type Action,type Attachment} from './api';
import {WorkspaceTaskTable} from './Workspace';
import {MeetingsPanel} from './Meetings';
import {FileRow} from './EvidenceFiles';

type Run=(action:()=>Promise<unknown>,success?:string)=>void;
type SubProject={id:number;project_id:number;name:string;objective:string;owner_id:number;owner_name:string;due_date:string;task_total:number;task_done:number};
type Props={user:User;projectId:number;subProjectId:number;onTask:(id:number)=>void;onMeeting:(id:number)=>void;onReview:()=>void;run:Run};
function StatusGroups({tasks,onTask}:{tasks:Task[];onTask:(id:number)=>void}){
  return <div className="subproject-status-groups">{(['RETURNED','NOT_STARTED','IN_PROGRESS','SUBMITTED','DONE'] as const).map(status=>{const group=tasks.filter(task=>task.status===status);if(!group.length)return null;return <section className="work-group" key={status}><h3>{statusLabel(status)} <small>{group.length}</small></h3>{status==='SUBMITTED'?<p className="muted">These submissions are shown in Waiting for my review above.</p>:group.map(task=><button className={'subproject-task-compact'+(status==='RETURNED'?' returned':'')} key={task.id} onClick={()=>onTask(task.id)}><strong>{task.title}</strong><span>{task.owner_name} · <span className={dueClass(task.due_date)}>{dueLabel(task.due_date)}</span></span></button>)}</section>})}</div>;
}
export function SubProjectHome({user,projectId,subProjectId,onTask,onMeeting,onReview,run}:Props){
  const sub=useQuery({queryKey:['sub-project',subProjectId],queryFn:()=>api<SubProject>(`/sub-projects/${subProjectId}`)});
  const tasks=useQuery({queryKey:['sub-project-tasks',subProjectId],queryFn:()=>api<Task[]>(`/sub-projects/${subProjectId}/tasks`)});
  const members=useQuery({queryKey:['assignees',subProjectId],queryFn:()=>api<User[]>(`/sub-projects/${subProjectId}/assignees`)});
  const reviews=useQuery({queryKey:['pending'],queryFn:()=>api<Action[]>('/me/pending-actions')});
  const own=useQuery({queryKey:['work',projectId],queryFn:()=>api<{tasks:Task[]}>(`/me/work?project_id=${projectId}`)});
  const [adding,setAdding]=useState(false);
  const list=tasks.data||[],waiting=(reviews.data||[]).filter(item=>item.kind==='RESULT_REVIEW'&&list.some(t=>t.id===item.task_id));
  const personal=(own.data?.tasks||[]).filter(t=>t.owner_id===user.id&&!t.sub_project_id&&t.status!=='DONE');
  function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,data=new FormData(form);run(async()=>{await post(`/projects/${projectId}/tasks`,{sub_project_id:subProjectId,title:String(data.get('title')||'').trim(),description:String(data.get('description')||'').trim(),expected_deliverables:String(data.get('deliverables')||'').trim(),owner_id:Number(data.get('owner_id')),due_date:String(data.get('due_date')),priority:'MEDIUM'});form.reset();setAdding(false)},'Task assigned')}
  return <div className="role-home">
    <section className="card"><h2>{sub.data?.name||'My sub-project'}</h2><p>{sub.data?.objective}</p><div className="row"><span className={dueClass(sub.data?.due_date)}>Due {dueLabel(sub.data?.due_date)}</span><strong>{sub.data?.task_done||0} of {sub.data?.task_total||0} tasks done</strong></div><progress value={sub.data?.task_done||0} max={Math.max(sub.data?.task_total||0,1)}/></section>
    <section className="card"><h2>Waiting for my review <small>{waiting.length}</small></h2>{waiting.length?waiting.map(item=><button className="bento-row" key={item.id} onClick={onReview}><strong>{item.title}</strong><small>{item.submitted_by} · {formatDate(item.requested_at)} · {item.files?.length||0} evidence files</small><p>{item.summary}</p></button>):<p className="muted">No submissions need your decision.</p>}</section>
    <section className="card"><div className="row"><h2>Sub-project tasks</h2><button className="primary" onClick={()=>setAdding(!adding)}>{adding?'Cancel':'New task'}</button></div>{adding&&<form className="form-grid" onSubmit={create}><label>Title<input name="title" required/></label><label>Task owner<select name="owner_id" required><option value="">Choose owner</option>{members.data?.map(member=><option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label><label>Due date<input name="due_date" type="date" max={dateOnly(sub.data?.due_date)} required/></label><label>Details<textarea name="description"/></label><label>Expected deliverables<textarea name="deliverables"/></label><button className="primary">Assign task</button></form>}<StatusGroups tasks={list} onTask={onTask}/></section>
    {personal.length>0&&<section className="card"><h2>My own tasks</h2><WorkspaceTaskTable tasks={personal} onTask={onTask}/></section>}
    <section className="card"><MeetingsPanel projectId={projectId} subProjectId={subProjectId} user={user} members={members.data||[]} onMeeting={onMeeting} run={run} canCreate/></section>
  </div>;
}
export function RoleMeetings({user,projectId,subProjectId,isSubOwner,onMeeting,run}:{user:User;projectId:number;subProjectId:number|null;isSubOwner:boolean;onMeeting:(id:number)=>void;run:Run}){
  const members=useQuery({queryKey:['meeting-assignees',projectId,subProjectId],queryFn:()=>api<User[]>(user.role==='PM'?`/projects/${projectId}/members`:`/sub-projects/${subProjectId}/assignees`),enabled:user.role==='PM'||isSubOwner});
  return <section className="card"><MeetingsPanel projectId={projectId} subProjectId={user.role==='PM'?null:subProjectId} user={user} members={members.data||[]} onMeeting={onMeeting} run={run} canCreate={user.role==='PM'||isSubOwner}/></section>;
}
export function ProjectDetails({projectId,onBack}:{projectId:number;onBack:()=>void}){
  const project=useQuery({queryKey:['project',projectId],queryFn:()=>api<Project>(`/projects/${projectId}`)});
  const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`)});
  const docs=useQuery({queryKey:['docs',projectId],queryFn:()=>api<(Attachment&{uploaded_by_name?:string})[]>(`/projects/${projectId}/documents`)});
  return <section className="card"><button onClick={onBack}>Overview</button><h2>{project.data?.name}</h2><p>{project.data?.description}</p><p className={dueClass(project.data?.target_date)}>Due {dueLabel(project.data?.target_date)}</p><h3>Team</h3>{members.data?.map(member=><p key={member.id}>{member.full_name} · {member.role==='PM'?'Project manager':'Member'}</p>)}<h3>Documents</h3>{docs.data?.length?docs.data.map(doc=><FileRow key={doc.id} file={{...doc,name:doc.original_name}}/>):<p className="muted">No documents uploaded.</p>}</section>;
}
export function SubProjectTasks({subProjectId,onTask}:{subProjectId:number;onTask:(id:number)=>void}){
  const tasks=useQuery({queryKey:['sub-project-tasks',subProjectId],queryFn:()=>api<Task[]>(`/sub-projects/${subProjectId}/tasks`)});
  return <section className="card"><h2>Sub-project tasks</h2><WorkspaceTaskTable tasks={tasks.data||[]} onTask={onTask}/></section>;
}

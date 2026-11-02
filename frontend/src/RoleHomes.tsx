import {useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,post,dateOnly,dueLabel,dueClass,type Task,type Project,type User,type Attachment} from './api';
import {WorkspaceTaskTable} from './Workspace';
import {MeetingsPanel} from './Meetings';
import {FileRow} from './EvidenceFiles';
import {HomeTaskTable,type HomeTask} from './HomeTaskTable';

type Run=(action:()=>Promise<unknown>,success?:string)=>void;
type SubProject={id:number;project_id:number;name:string;objective:string;owner_id:number;owner_name:string;due_date:string;task_total:number;task_done:number};
type Props={user:User;projectId:number;subProjectId:number;onTask:(id:number,section?:'evidence'|'submit'|'review')=>void;onMeeting:(id:number)=>void;onReview:()=>void;run:Run};
export function SubProjectHome({user,projectId,subProjectId,onTask,onMeeting,onReview,run}:Props){
  const sub=useQuery({queryKey:['sub-project',subProjectId],queryFn:()=>api<SubProject>(`/sub-projects/${subProjectId}`)});
  const tasks=useQuery({queryKey:['sub-project-tasks',subProjectId],queryFn:()=>api<HomeTask[]>(`/sub-projects/${subProjectId}/tasks`)});
  const members=useQuery({queryKey:['assignees',subProjectId],queryFn:()=>api<User[]>(`/sub-projects/${subProjectId}/assignees`)});
  const own=useQuery({queryKey:['work',projectId],queryFn:()=>api<{tasks:Task[]}>(`/me/work?project_id=${projectId}`)});
  const [adding,setAdding]=useState(false);
  const list=tasks.data||[],personal=(own.data?.tasks||[]).filter(t=>t.owner_id===user.id&&!t.sub_project_id);
  const combined=[...list,...personal.filter(t=>!list.some(item=>item.id===t.id))],waiting=list.filter(t=>t.status==='SUBMITTED'&&t.owner_id!==user.id);
  function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,data=new FormData(form);run(async()=>{await post(`/projects/${projectId}/tasks`,{sub_project_id:subProjectId,title:String(data.get('title')||'').trim(),description:String(data.get('description')||'').trim(),expected_deliverables:String(data.get('deliverables')||'').trim(),owner_id:Number(data.get('owner_id')),due_date:String(data.get('due_date')),priority:'MEDIUM'});form.reset();setAdding(false)},'Task assigned')}
  return <div className="role-home">
    <section className="card subproject-home-hero"><h2>{sub.data?.name||'My sub-project'}</h2><p>{sub.data?.objective}</p><div className="row"><span className={dueClass(sub.data?.due_date)}>Due {dueLabel(sub.data?.due_date)}</span><strong>{sub.data?.task_done||0} of {sub.data?.task_total||0} tasks done</strong></div><progress value={sub.data?.task_done||0} max={Math.max(sub.data?.task_total||0,1)}/>{waiting.length>0&&<strong className="home-review-count">{waiting.length} waiting for your review</strong>}</section>
    <section className="card home-tasks-card"><div className="home-section-head"><h2>Tasks</h2><button className="primary" onClick={()=>setAdding(!adding)}>{adding?'Cancel':'New task'}</button></div>{adding&&<form className="form-grid" onSubmit={create}><label>Title<input name="title" required/></label><label>Task owner<select name="owner_id" required><option value="">Choose owner</option>{members.data?.map(member=><option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label><label>Due date<input name="due_date" type="date" max={dateOnly(sub.data?.due_date)} required/></label><label>Details<textarea name="description"/></label><label>Expected deliverables<textarea name="deliverables"/></label><button className="primary">Assign task</button></form>}<HomeTaskTable tasks={combined} ownId={user.id} onTask={onTask} run={run} reviewFirst showOwner ownerFilter/></section>
    <section className="card"><MeetingsPanel projectId={projectId} subProjectId={subProjectId} user={user} members={members.data||[]} onMeeting={onMeeting} run={run} canCreate/></section>
  </div>;
}
export function RoleMeetings({user,projectId,subProjectId,isSubOwner,canManageProject,onMeeting,run}:{user:User;projectId:number;subProjectId:number|null;isSubOwner:boolean;canManageProject:boolean;onMeeting:(id:number)=>void;run:Run}){
  const members=useQuery({queryKey:['meeting-assignees',projectId,subProjectId],queryFn:()=>api<User[]>(user.role==='PM'?`/projects/${projectId}/members`:`/sub-projects/${subProjectId}/assignees`),enabled:user.role==='PM'||isSubOwner});
  return <section className="card"><MeetingsPanel projectId={projectId} subProjectId={user.role==='PM'?null:subProjectId} user={user} members={members.data||[]} onMeeting={onMeeting} run={run} canCreate={user.role==='PM'?canManageProject:isSubOwner}/></section>;
}
export function ProjectDetails({projectId,onTasks}:{projectId:number;onTasks:()=>void}){
  const project=useQuery({queryKey:['project',projectId],queryFn:()=>api<Project>(`/projects/${projectId}`)});
  const projects=useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')});
  const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`)});
  const subProjects=useQuery({queryKey:['sub-projects',projectId],queryFn:()=>api<SubProject[]>(`/projects/${projectId}/sub-projects`)});
  const docs=useQuery({queryKey:['docs',projectId],queryFn:()=>api<(Attachment&{uploaded_by_name?:string})[]>(`/projects/${projectId}/documents`)});
  const summary=projects.data?.find(item=>item.id===projectId),done=summary?.task_done||0,total=summary?.task_total||0;
  return <div className="project-overview-page"><div className="project-overview-toolbar"><button onClick={onTasks}>View tasks</button></div>
    <section className="card project-overview-hero"><span className="eyebrow">PROJECT OVERVIEW</span><h2>{project.data?.name||'Project'}</h2><p className="project-overview-description">{project.data?.description||'No description has been added yet.'}</p><div className="project-overview-facts"><div><span>Project manager</span><strong>{summary?.manager_name||'—'}</strong></div><div><span>Due date</span><strong className={dueClass(project.data?.target_date)}>{dueLabel(project.data?.target_date)}</strong></div><div><span>Progress</span><strong>{done} of {total} tasks done</strong></div></div><progress value={done} max={Math.max(total,1)}/></section>
    <div className="project-overview-lower"><section className="card"><div className="project-overview-section-head"><h3>Team</h3><span>{members.data?.length||0} members</span></div>{members.data?.length?members.data.map(member=>{const owns=subProjects.data?.filter(item=>item.owner_id===member.id)||[];return <div className="project-team-row" key={member.id}><span className="avatar-initials">{member.full_name.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><div><strong>{member.full_name}</strong><small>{owns.length?`Sub-project owner · ${owns.map(item=>item.name).join(', ')}`:'Team member'}</small></div></div>}):<p className="muted">No team members have been added yet.</p>}</section>
    <section className="card"><div className="project-overview-section-head"><h3>Documents</h3><span>{docs.data?.length||0} files</span></div>{docs.data?.length?<div className="standard-file-list">{docs.data.map(doc=><FileRow key={doc.id} file={{...doc,name:doc.original_name}}/>)}</div>:<p className="muted">No project documents have been uploaded yet.</p>}</section></div>
  </div>;
}
export function SubProjectTasks({subProjectId,onTask}:{subProjectId:number;onTask:(id:number)=>void}){
  const tasks=useQuery({queryKey:['sub-project-tasks',subProjectId],queryFn:()=>api<Task[]>(`/sub-projects/${subProjectId}/tasks`)});
  return <section className="card"><h2>Sub-project tasks</h2><WorkspaceTaskTable tasks={tasks.data||[]} onTask={onTask}/></section>;
}

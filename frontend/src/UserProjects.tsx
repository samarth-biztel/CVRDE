import {useQuery} from '@tanstack/react-query';
import {api,dueClass,dueLabel,formatDate,type Attachment,type Project,type User} from './api';
import {SubProjects} from './SubProjects';

type Run=(action:()=>Promise<unknown>,success?:string)=>void;
type SubProject={id:number;name:string;objective:string;owner_id:number;owner_name:string;due_date:string|null};

export function UserProjects({user,projectId,onTasks,onTask,onMeeting,run,focusSubProjectId}:{user:User;projectId:number|null;onTasks:()=>void;onTask:(id:number)=>void;onMeeting:(id:number)=>void;run:Run;focusSubProjectId?:number|null}){
  const projects=useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')});
  const subProjects=useQuery({queryKey:['sub-projects',projectId],queryFn:()=>api<SubProject[]>(`/projects/${projectId}/sub-projects`),enabled:!!projectId});
  const documents=useQuery({queryKey:['docs',projectId],queryFn:()=>api<(Attachment&{uploaded_by_name?:string})[]>(`/projects/${projectId}/documents`),enabled:!!projectId});
  const owned=(subProjects.data||[]).filter(item=>item.owner_id===user.id);
  const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`),enabled:!!projectId&&owned.length>0});
  const project=projects.data?.find(item=>item.id===projectId);

  if(!project)return <section className="card"><p className="muted">{projects.isLoading?'Loading your project…':'No project is assigned to your work.'}</p></section>;
  return <div className="user-projects">
    <section className="card project-detail">
      <div className="project-detail-head"><div><h2>{project.name}</h2><p className="project-description">{project.description||'No description yet.'}</p></div><button onClick={onTasks}>View my tasks</button></div>
      <div className="project-summary-meta"><div><small>Project manager</small><strong>{project.manager_name||'Unassigned'}</strong></div><div><small>Due date</small><strong className={dueClass(project.target_date)}>{dueLabel(project.target_date)}</strong></div></div>
      {owned.length>0&&<SubProjects user={user} projectId={project.id} projectDue={project.target_date} members={members.data||[]} onTask={onTask} onMeeting={onMeeting} run={run} focusSubProjectId={focusSubProjectId} ownerOnly/>}
      <section className="member-project-docs"><h3>Project documents</h3>{documents.data?.length?documents.data.map(file=><div className="file-item" key={file.id}><a href={`/api/v1/attachments/${file.id}/download`}>{file.original_name}</a><small>{file.uploaded_by_name||'Team member'} · {formatDate(file.uploaded_at)}</small></div>):<p className="muted">No project documents have been uploaded.</p>}</section>
    </section>
  </div>;
}

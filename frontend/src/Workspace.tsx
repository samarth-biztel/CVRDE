import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api,post,patch,del,dateOnly,type User,type Project,type Task,type Group,type Action,type Result,type Attachment,type Pendency} from './api';

type Run=(action:()=>Promise<unknown>,success?:string)=>void;
type PageProps={user:User;projectId:number|null;onProject:(id:number)=>void;onTask:(id:number)=>void};
const value=(form:HTMLFormElement,key:string)=>String(new FormData(form).get(key)||'').trim();
const num=(form:HTMLFormElement,key:string)=>Number(value(form,key));
function Card({title,children,extra}:{title:string;children:ReactNode;extra?:ReactNode}){return <section className="card"><div className="card-head"><h2>{title}</h2>{extra}</div>{children}</section>}
function Empty({children}:{children:ReactNode}){return <p className="muted">{children}</p>}
function Pill({text}:{text:string}){return <span className={'pill '+text.toLowerCase()}>{text.replaceAll('_',' ')}</span>}
function UploadForm({path,queryKey,buttonLabel,inline=false}:{path:string;queryKey:readonly unknown[];buttonLabel:string;inline?:boolean}){
  const qc=useQueryClient();
  const [uploadedName,setUploadedName]=useState('');
  const [error,setError]=useState('');
  const [uploading,setUploading]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const file=(form.elements.namedItem('file') as HTMLInputElement).files?.[0];
    if(!file)return;
    setUploadedName('');setError('');setUploading(true);
    const data=new FormData();
    data.set('document_key',value(form,'document_key'));
    data.set('file',file);
    try{
      await api(path,{method:'POST',body:data});
      setUploadedName(file.name);
      form.reset();
      void qc.invalidateQueries({queryKey}).catch(()=>{});
    }catch(failure){
      setError(failure instanceof Error?failure.message:'Upload failed');
    }finally{setUploading(false)}
  }
  return <div className="upload-area"><form className={inline?'inline-form':'stack compact-stack'} onSubmit={submit}><input name="document_key" placeholder="Document key" aria-label="Document key" required/><input name="file" type="file" aria-label="Choose file" required onChange={()=>{setUploadedName('');setError('')}}/><button disabled={uploading}>{uploading?'Uploading…':buttonLabel}</button></form>{uploadedName&&<div className="upload-confirmation" role="status" data-testid="upload-success"><span className="upload-tick" aria-hidden="true">✓</span><strong>{uploadedName}</strong><span>uploaded</span></div>}{error&&<div className="notice error upload-error" role="alert" data-testid="upload-error">{error}</div>}</div>
}
function useProjects(){return useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')})}
function ProjectSelect({id,onChange}:{id:number|null;onChange:(id:number)=>void}){const projects=useProjects();useEffect(()=>{if(!id&&projects.data?.length)onChange(projects.data[0]!.id)},[id,projects.data,onChange]);return <select aria-label="Project" value={id||''} onChange={e=>onChange(Number(e.target.value))}><option value="">Select project</option>{projects.data?.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>}
export function WorkspaceTaskTable({tasks,onTask}:{tasks:Task[];onTask:(id:number)=>void}){
  if(!tasks.length)return <Empty>No tasks to show.</Empty>;
  const titles=new Map(tasks.map(t=>[t.id,t.title]));
  return <div className="table-wrap"><table className="workspace-table"><thead><tr><th>Task</th><th>Due date</th><th>Linked to</th><th>Owner</th><th>Status</th><th>Priority</th></tr></thead><tbody>{tasks.map(t=><tr className="clickable" key={t.id} onClick={()=>onTask(t.id)}><td><button className="table-link" onClick={e=>{e.stopPropagation();onTask(t.id)}}>{t.title}</button></td><td>{dateOnly(t.due_date)||'—'}</td><td>{t.parent_task_id?titles.get(t.parent_task_id)||`Task #${t.parent_task_id}`:'—'}</td><td>{t.owner_name||'—'}</td><td><Pill text={t.status}/></td><td>{t.priority}</td></tr>)}</tbody></table></div>
}
function maxTaskDate(targetDate:string|null|undefined){
  if(!targetDate)return undefined;
  return new Date(Date.parse(dateOnly(targetDate)+'T00:00:00Z')-86400000).toISOString().slice(0,10);
}
function CreateProjectForm({run,onProject,onClose}:{run:Run;onProject:(id:number)=>void;onClose:()=>void}){
  return <Card title="New project"><form className="form-grid task-create" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{const created=await post<Project>('/projects',{name:value(f,'name'),description:value(f,'description'),target_date:value(f,'target_date')});onProject(created.id);onClose()},'Project created')}}><label>Project name<input name="name" required/></label><label>Project deadline<input name="target_date" type="date" required/></label><label className="full-field">Description<textarea name="description" rows={3}/></label><div className="button-row"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Create project</button></div></form></Card>
}
function EditProjectForm({project,tasks,onClose}:{project:Project;tasks:Task[];onClose:()=>void}){
  const qc=useQueryClient();
  const [deadline,setDeadline]=useState(dateOnly(project.target_date));
  const [error,setError]=useState('');
  const lateTasks=tasks.filter(task=>task.due_date&&dateOnly(task.due_date)>=deadline);
  const shortening=deadline<dateOnly(project.target_date);
  return <Card title="Edit project"><form className="form-grid task-create" onSubmit={async e=>{
    e.preventDefault();setError('');const form=e.currentTarget;
    try{
      await patch(`/projects/${project.id}`,{name:value(form,'name'),description:value(form,'description'),target_date:value(form,'target_date')});
      await qc.invalidateQueries({queryKey:['projects']});onClose();
    }catch(failure){setError(failure instanceof Error?failure.message:'Project could not be updated')}
  }}><label>Project name<input name="name" defaultValue={project.name} required/></label><label>Project deadline<input name="target_date" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} required/></label><label className="full-field">Description<textarea name="description" defaultValue={project.description} rows={3}/></label>{lateTasks.length>0&&<div className="notice full-field"><strong>{lateTasks.length} task{lateTasks.length===1?'':'s'} due on or after this deadline:</strong> {lateTasks.map(task=>`${task.title} (${dateOnly(task.due_date)})`).join(', ')}. {shortening?'Move these task dates before shortening the deadline.':'You can save a later deadline, then adjust these task dates.'}</div>}{error&&<div className="notice error full-field">{error}</div>}<div className="button-row"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={shortening&&lateTasks.length>0}>Save project</button></div></form></Card>
}
function CreateTaskForm({projectId,deadline,members,groups,tasks,run,onClose}:{projectId:number;deadline?:string;members:User[];groups:Group[];tasks:Task[];run:Run;onClose:()=>void}){
  return <Card title="New task"><form className="form-grid task-create" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{const created=await post<Task>(`/projects/${projectId}/tasks`,{title:value(f,'title'),description:value(f,'description'),owner_id:num(f,'owner_id'),priority:value(f,'priority'),due_date:value(f,'due_date'),parent_task_id:num(f,'parent_task_id')||null});const groupId=num(f,'group_id');if(groupId)await patch(`/tasks/${created.id}/visibility`,{group_id:groupId});onClose()},'Task created')}}><label>Task title<input name="title" required/></label><label>Assign to<select name="owner_id" required><option value="">Select team member</option>{members.map(m=><option value={m.id} key={m.id}>{m.full_name}</option>)}</select></label><label>Due date<input name="due_date" type="date" max={deadline} required/></label><label>Linked to<select name="parent_task_id"><option value="">No linked task</option>{tasks.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label><label>Priority<select name="priority"><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="LOW">Low</option></select></label><label>Share with group<select name="group_id"><option value="">Private</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label><label className="full-field">Description<textarea name="description" rows={3}/></label>{deadline&&<p className="muted full-field">Task due date must be before the project deadline.</p>}<div className="button-row"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Create task</button></div></form></Card>
}
export function WorkspaceTasks({user,projectId,onProject,onTask,run}:PageProps&{run:Run}){
  const projects=useProjects();
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!projectId});
  const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`),enabled:!!projectId&&user.role==='PM'});
  const groups=useQuery({queryKey:['groups',projectId],queryFn:()=>api<Group[]>(`/projects/${projectId}/groups`),enabled:!!projectId&&user.role==='PM'});
  const [showCreate,setShowCreate]=useState(false);
  const deadline=maxTaskDate(projects.data?.find(p=>p.id===projectId)?.target_date);
  return <><div className="toolbar"><ProjectSelect id={projectId} onChange={onProject}/>{user.role==='PM'&&<button className="primary" disabled={!projectId} onClick={()=>setShowCreate(open=>!open)}>New task</button>}</div>{showCreate&&projectId&&user.role==='PM'&&<CreateTaskForm projectId={projectId} deadline={deadline} members={members.data||[]} groups={groups.data||[]} tasks={tasks.data||[]} run={run} onClose={()=>setShowCreate(false)}/>}<Card title={user.role==='MEMBER'?'My and shared tasks':'Project tasks'}>{tasks.isLoading?<Empty>Loading tasks…</Empty>:tasks.isError?<Empty>Tasks could not be loaded.</Empty>:<WorkspaceTaskTable tasks={tasks.data||[]} onTask={onTask}/>}</Card></>
}

export function WorkspaceProjects({user,projectId,onProject,onTask,run}:PageProps&{run:Run}){
  const projects=useProjects();
  const [showCreate,setShowCreate]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`),enabled:!!projectId});
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!projectId});
  const groups=useQuery({queryKey:['groups',projectId],queryFn:()=>api<Group[]>(`/projects/${projectId}/groups`),enabled:!!projectId});
  const docs=useQuery({queryKey:['docs',projectId],queryFn:()=>api<Attachment[]>(`/projects/${projectId}/documents`),enabled:!!projectId});
  const project=projects.data?.find(p=>p.id===projectId);
  return <><div className="toolbar"><ProjectSelect id={projectId} onChange={onProject}/>{user.role==='PM'&&<><button className="primary" onClick={()=>{setShowCreate(open=>!open);setShowEdit(false)}}>New project</button><button disabled={!project} onClick={()=>{setShowEdit(open=>!open);setShowCreate(false)}}>Edit project</button></>}</div>{showCreate&&user.role==='PM'&&<CreateProjectForm run={run} onProject={onProject} onClose={()=>setShowCreate(false)}/>} {showEdit&&user.role==='PM'&&project&&<EditProjectForm key={project.id} project={project} tasks={tasks.data||[]} onClose={()=>setShowEdit(false)}/>} {projectId&&<><div className="project-summary"><div><span className="eyebrow">PROJECT</span><h2>{project?.name}</h2><p>{project?.description||'No project description.'}</p><p className="project-deadline">Deadline: <strong>{dateOnly(project?.target_date)||'Not set'}</strong></p></div><div className="project-summary-stats"><strong>{members.data?.length??'—'}</strong><span>Team members</span><strong>{groups.data?.length??'—'}</strong><span>Groups</span></div></div><Card title="Tasks">{tasks.isLoading?<Empty>Loading tasks…</Empty>:<WorkspaceTaskTable tasks={tasks.data||[]} onTask={onTask}/>}</Card><Card title="Project documents">{user.role==='PM'&&<UploadForm key={`project:${projectId}`} path={`/projects/${projectId}/documents`} queryKey={['docs',projectId]} buttonLabel="Upload" inline/>}{docs.data?.length?<div className="file-list">{docs.data.map(d=><a href={`/api/v1/attachments/${d.id}/download`} key={d.id}><strong>{d.original_name}</strong><small>{d.document_key} · v{d.version_no}</small></a>)}</div>:<Empty>No project documents yet.</Empty>}</Card></>}</>
}

export function WorkspaceSettings({projectId,onProject,run}:{projectId:number|null;onProject:(id:number)=>void;run:Run}){
  const projects=useProjects();
  const users=useQuery({queryKey:['users'],queryFn:()=>api<User[]>('/users')});
  const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`),enabled:!!projectId});
  const groups=useQuery({queryKey:['groups',projectId],queryFn:()=>api<Group[]>(`/projects/${projectId}/groups`),enabled:!!projectId});
  const [sheet,setSheet]=useState<File|null>(null);
  async function importSheet(){
    if(!projectId||!sheet)throw new Error('Select a project and Excel file');
    if(!users.data||!members.data||!groups.data)throw new Error('Wait for team data to finish loading');
    const {readSheet}=await import('read-excel-file/browser');
    const rows=await readSheet(sheet);
    if(rows.length<2)throw new Error('The sheet has no member rows');
    const header=rows[0]!.map(cell=>String(cell||'').trim().toLowerCase());
    const usernameIndex=header.indexOf('username'),groupIndex=header.indexOf('group');
    if(usernameIndex<0)throw new Error('The first row must include a username column');
    const entries=rows.slice(1).map((row,i)=>({username:String(row[usernameIndex]||'').trim(),group:groupIndex<0?'':String(row[groupIndex]||'').trim(),line:i+2})).filter(x=>x.username);
    if(!entries.length)throw new Error('The sheet has no usernames');
    const known=new Map((users.data||[]).filter(u=>u.role==='MEMBER').map(u=>[u.username.toLowerCase(),u]));
    const unknown=entries.filter(x=>!known.has(x.username.toLowerCase()));
    if(unknown.length)throw new Error('Unknown usernames: '+unknown.map(x=>`${x.username} (row ${x.line})`).join(', '));
    const currentMembers=new Set((members.data||[]).map(m=>m.id));
    const groupIds=new Map((groups.data||[]).map(g=>[g.name.toLowerCase(),g.id]));
    const assigned=new Set<string>();
    for(const entry of entries){
      const member=known.get(entry.username.toLowerCase())!;
      if(!currentMembers.has(member.id)){await post(`/projects/${projectId}/members`,{user_id:member.id});currentMembers.add(member.id)}
      if(entry.group){
        const key=entry.group.toLowerCase();
        if(!groupIds.has(key)){const created=await post<Group>(`/projects/${projectId}/groups`,{name:entry.group});groupIds.set(key,created.id)}
        const groupId=groupIds.get(key)!;
        const pair=`${groupId}:${member.id}`;
        if(!assigned.has(pair)){await post(`/groups/${groupId}/members`,{user_id:member.id});assigned.add(pair)}
      }
    }
  }
  return <><div className="toolbar"><ProjectSelect id={projectId} onChange={onProject}/></div><Card title="Add team member"><p className="muted">Select an existing user account for {projects.data?.find(p=>p.id===projectId)?.name||'this project'}.</p><form className="inline-form" onSubmit={e=>{e.preventDefault();run(()=>post(`/projects/${projectId}/members`,{user_id:num(e.currentTarget,'user_id')}),'Team member added')}}><select name="user_id" required><option value="">Select user</option>{users.data?.filter(u=>u.role==='MEMBER'&&!members.data?.some(m=>m.id===u.id)).map(u=><option value={u.id} key={u.id}>{u.full_name} ({u.username})</option>)}</select><button disabled={!projectId}>Add to team</button></form><div className="chips">{members.data?.map(m=><span className="team-chip" key={m.id}>{m.full_name}</span>)}</div></Card>{projectId&&<><Card title="Import team and groups from Excel"><p className="muted">Use an .xlsx sheet with a <strong>username</strong> column and an optional <strong>group</strong> column. Usernames must already exist. New group names in the sheet are created for this project.</p><div className="inline-form"><input type="file" accept=".xlsx" aria-label="Excel member sheet" onChange={e=>setSheet(e.target.files?.[0]||null)}/><button disabled={!sheet||!users.data||!members.data||!groups.data} onClick={()=>run(importSheet,'Excel members and groups imported')}>Import Excel sheet</button></div></Card><Card title="Groups"><form className="inline-form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post(`/projects/${projectId}/groups`,{name:value(f,'name')});f.reset()},'Group created')}}><input name="name" placeholder="New group name" required/><button>Create group</button></form>{groups.data?.length?groups.data.map(g=><div className="group-row" key={g.id}><div className="row"><strong>{g.name}</strong><small>{g.member_ids?.length||0} team members</small></div><div className="group-switches">{(['can_view_results','can_comment','can_link_pendency'] as const).map(permission=><label key={permission}><input type="checkbox" checked={g[permission]} onChange={e=>run(()=>patch(`/groups/${g.id}`,{[permission]:e.target.checked}),'Group permission updated')}/>{permission.replaceAll('_',' ')}</label>)}</div><form className="inline-form" onSubmit={e=>{e.preventDefault();run(()=>post(`/groups/${g.id}/members`,{user_id:num(e.currentTarget,'user_id')}),'Group member added')}}><select name="user_id" required><option value="">Select team member</option>{members.data?.filter(m=>!g.member_ids?.includes(m.id)).map(m=><option value={m.id} key={m.id}>{m.full_name}</option>)}</select><button>Add to group</button></form><div className="chips">{g.member_ids?.map(id=><button key={id} onClick={()=>run(()=>del(`/groups/${g.id}/members/${id}`),'Group member removed')}>{members.data?.find(m=>m.id===id)?.full_name||`User #${id}`} ×</button>)}</div></div>):<Empty>No groups yet.</Empty>}</Card></>}</>
}

type Reassignment={id:number;new_owner_id:number;requested_by:number;status:string;reason:string;work_from:string|null;work_until:string|null};
type Extension={id:number;new_due_date:string;status:string;reason:string};
type Comment={id:number;body:string;author_name:string;created_at:string};
type Event={id:number;event_type:string;actor_name:string;created_at:string;details:unknown};
export function WorkspaceTaskDetail({user,taskId,onBack,onTask,run}:{user:User;taskId:number;onBack:()=>void;onTask:(id:number)=>void;run:Run}){
  const task=useQuery({queryKey:['task',taskId],queryFn:()=>api<Task>(`/tasks/${taskId}`)});
  const t=task.data,full=!!t&&!t.limited;
  const tasks=useQuery({queryKey:['tasks',t?.project_id],queryFn:()=>api<Task[]>(`/projects/${t?.project_id}/tasks`),enabled:full});
  const members=useQuery({queryKey:['members',t?.project_id],queryFn:()=>api<User[]>(`/projects/${t?.project_id}/members`),enabled:full});
  const users=useQuery({queryKey:['users'],queryFn:()=>api<User[]>('/users'),enabled:full});
  const results=useQuery({queryKey:['results',taskId],queryFn:()=>api<Result[]>(`/tasks/${taskId}/results`),enabled:full});
  const comments=useQuery({queryKey:['comments',taskId],queryFn:()=>api<Comment[]>(`/tasks/${taskId}/comments`),enabled:full});
  const attachments=useQuery({queryKey:['attachments',taskId],queryFn:()=>api<Attachment[]>(`/tasks/${taskId}/attachments`),enabled:full});
  const extensions=useQuery({queryKey:['extensions',taskId],queryFn:()=>api<Extension[]>(`/tasks/${taskId}/extensions`),enabled:full});
  const reassignments=useQuery({queryKey:['reassignments',taskId],queryFn:()=>api<Reassignment[]>(`/tasks/${taskId}/reassignments`),enabled:full});
  const pendencies=useQuery({queryKey:['pendencies'],queryFn:()=>api<Pendency[]>('/pendencies'),enabled:full});
  const history=useQuery({queryKey:['history',taskId],queryFn:()=>api<Event[]>(`/tasks/${taskId}/history`),enabled:full});
  const projects=useProjects();
  const deadline=maxTaskDate(projects.data?.find(p=>p.id===t?.project_id)?.target_date);
  const [showResult,setShowResult]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [historyFilter,setHistoryFilter]=useState('');
  useEffect(()=>{setShowResult(false);setShowEdit(false);setHistoryFilter('')},[taskId]);
  if(task.isLoading)return <Empty>Loading task…</Empty>;
  if(task.isError||!t)return <div className="notice error">Task could not be opened.</div>;
  const owner=t.owner_id===user.id,pm=user.role==='PM';
  const linked=tasks.data?.find(x=>x.id===t.parent_task_id);
  const taskPendencies=(pendencies.data||[]).filter(p=>p.blocked_task_id===taskId);
  const pendingReassignment=reassignments.data?.some(r=>r.status==='PENDING');
  return <><button className="text-button" onClick={onBack}>← Back to tasks</button><div className="task-heading simplified"><div><span className="eyebrow">TASK #{t.id}</span><h2>{t.title}</h2><p>{t.description||'No description yet.'}</p><div className="task-facts"><span>Due date <strong>{dateOnly(t.due_date)||'Not set'}</strong></span>{linked&&<span>Linked to <button className="text-button" onClick={()=>onTask(t.parent_task_id!)}>{linked.title}</button></span>}</div></div><div className="task-heading-actions"><Pill text={t.status}/>{(owner||pm)&&<button onClick={()=>setShowEdit(open=>!open)}>{showEdit?'Cancel edit':'Edit task'}</button>}</div></div>
  {t.limited?<Card title="Review context"><p>Only the task title and status are available for this decision.</p></Card>:<>
  <Card title="Task and progress"><div className="task-work-grid"><div>
    <label>Status<select aria-label="Task status" value={showResult?'SUBMIT':t.status} onChange={e=>{if(e.target.value==='IN_PROGRESS')run(()=>post(`/tasks/${taskId}/status`,{}),'Task started');if(e.target.value==='SUBMIT')setShowResult(true)}} disabled={!owner||t.status==='SUBMITTED'||t.status==='COMPLETED'}><option value="NEW" disabled={t.status!=='NEW'}>New</option><option value="IN_PROGRESS" disabled={t.status==='NEW'?false:t.status!=='IN_PROGRESS'}>In progress</option>{t.status==='IN_PROGRESS'&&<option value="SUBMIT">Submit for review</option>}{t.status==='SUBMITTED'&&<option value="SUBMITTED">Submitted for review</option>}{t.status==='COMPLETED'&&<option value="COMPLETED">Completed</option>}</select></label>
    {owner&&t.status==='IN_PROGRESS'&&showResult&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{const description=value(f,'description');await post(`/tasks/${taskId}/results`,{work_completed:description,outcome:description});f.reset();setShowResult(false)},'Result submitted for review')}}><label>Result description<textarea name="description" rows={4} required placeholder="Describe the completed work"/></label><button className="primary">Submit result</button></form>}
    {(owner||pm)&&showEdit&&<div className="inline-details"><form className="form-grid compact" key={t.id+'-'+t.title+'-'+t.due_date} onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await patch(`/tasks/${taskId}`,{title:value(f,'title'),description:value(f,'description'),priority:value(f,'priority'),due_date:value(f,'due_date'),parent_task_id:num(f,'parent_task_id')||null});setShowEdit(false)},'Task updated')}}><label>Task title<input name="title" defaultValue={t.title} required/></label><label>Due date<input name="due_date" type="date" max={deadline} defaultValue={dateOnly(t.due_date)} required/></label><label>Linked to<select name="parent_task_id" defaultValue={t.parent_task_id||''}><option value="">No linked task</option>{tasks.data?.filter(x=>x.id!==taskId).map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label>Priority<select name="priority" defaultValue={t.priority}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label><label className="full-field">Description<textarea name="description" defaultValue={t.description} rows={3}/></label>{deadline&&<p className="muted full-field">Task due date must be before the project deadline.</p>}<button className="primary">Save task</button></form></div>}
  </div><div><h3>Results</h3>{results.data?.length?results.data.map(r=><div className="result" key={r.id}><div className="row"><strong>Version {r.version_no}</strong><Pill text={r.review_status}/></div><p>{r.work_completed}</p>{r.review_comment&&<p className="muted">Review: {r.review_comment}</p>}{pm&&r.review_status==='PENDING'&&<form className="inline-form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,submitter=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;run(()=>post(`/results/${r.id}/review`,{accept:submitter.value==='accept',comment:value(f,'comment')}),'Review recorded')}}><input name="comment" placeholder="Review note"/><button value="return">Return</button><button value="accept" className="primary">Accept</button></form>}</div>):<Empty>No result submitted yet.</Empty>}</div></div></Card>
  <Card title="Requests and prerequisites"><div className="request-grid"><details><summary>Due date extension</summary>{extensions.data?.map(x=><div className="approval" key={x.id}><strong>{dateOnly(x.new_due_date)}</strong> <Pill text={x.status}/><p>{x.reason}</p>{pm&&x.status==='PENDING'&&<div className="button-row"><button onClick={()=>run(()=>post(`/extension-requests/${x.id}/decision`,{approve:false}),'Extension rejected')}>Reject</button><button className="primary" onClick={()=>run(()=>post(`/extension-requests/${x.id}/decision`,{approve:true}),'Extension approved')}>Approve</button></div>}</div>)}{owner&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post(`/tasks/${taskId}/extension-requests`,{new_due_date:value(f,'new_due_date'),reason:value(f,'reason')});f.reset()},'Extension requested')}}><label>New due date<input name="new_due_date" type="date" max={deadline} required/></label><label>Reason<input name="reason" required/></label><button>Request extension</button></form>}</details>
    <details><summary>Reassignment</summary>{reassignments.data?.map(r=><div className="approval" key={r.id}><div className="row"><strong>To {members.data?.find(m=>m.id===r.new_owner_id)?.full_name||`User #${r.new_owner_id}`}</strong><Pill text={r.status}/></div><p>{r.reason}</p>{r.work_from&&r.work_until&&<small>Work window: {dateOnly(r.work_from)} to {dateOnly(r.work_until)}</small>}</div>)}{(owner||pm)&&!pendingReassignment&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post(`/tasks/${taskId}/reassignments`,{new_owner_id:num(f,'new_owner_id'),reviewer_id:pm?num(f,'reviewer_id'):undefined,work_from:value(f,'work_from'),work_until:value(f,'work_until'),reason:value(f,'reason')});f.reset()},pm?'Sent to reviewer':'Sent to manager for approval')}}><label>New owner<select name="new_owner_id" required><option value="">Select team member</option>{members.data?.filter(m=>m.id!==t.owner_id).map(m=><option value={m.id} key={m.id}>{m.full_name}</option>)}</select></label>{pm&&<label>Reviewer<select name="reviewer_id" required><option value="">Select reviewer</option>{users.data?.filter(u=>u.role==='REVIEWER').map(u=><option value={u.id} key={u.id}>{u.full_name}</option>)}</select></label>}<div className="date-pair"><label>From<input name="work_from" type="date" required/></label><label>Until<input name="work_until" type="date" required/></label></div><label>Reason<textarea name="reason" rows={2} required/></label><button>Request reassignment</button><small>{owner?'Manager accepts or rejects this request.':'Reviewer accepts or rejects this request.'} Dates record the work window.</small></form>}{pendingReassignment&&<Empty>A reassignment is awaiting a decision.</Empty>}</details>
    <details id="linked-task-note"><summary>Prerequisite tasks and pendencies</summary>{taskPendencies.map(p=><div className="approval" key={p.id}><div className="row"><strong>{p.description}</strong><Pill text={p.status}/></div><small>{p.type} · Responsible: {members.data?.find(m=>m.id===p.responsible_user_id)?.full_name||`User #${p.responsible_user_id}`}</small></div>)}{owner&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post('/pendencies',{blocked_task_id:taskId,depends_on_task_ids:[num(f,'depends_on_task_id')],responsible_user_id:num(f,'responsible_user_id'),type:value(f,'type'),description:value(f,'description'),needs_approval:true});f.reset()},'Prerequisite sent for manager approval')}}><label>Waiting on task<select name="depends_on_task_id" required><option value="">Select prerequisite task</option>{tasks.data?.filter(x=>x.id!==taskId).map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label>Responsible team member<select name="responsible_user_id" required><option value="">Select person</option>{members.data?.filter(m=>m.id!==user.id).map(m=><option value={m.id} key={m.id}>{m.full_name}</option>)}</select></label><label>Type<select name="type"><option value="ACTION">Action</option><option value="CLARIFICATION">Clarification</option><option value="APPROVAL">Approval</option></select></label><label>What is needed?<textarea name="description" rows={2} required/></label><button>Add prerequisite task</button></form>}</details></div></Card>
  <Card title="Discussion and files"><div className="two-col"><div><h3>Comments</h3>{comments.data?.map(c=><div className="comment" key={c.id}><p>{c.body}</p><small>{c.author_name} · {new Date(c.created_at).toLocaleString()}</small></div>)}<form className="inline-form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post(`/tasks/${taskId}/comments`,{body:value(f,'body')});f.reset()},'Comment added')}}><input name="body" placeholder="Add a comment" required/><button>Add</button></form></div><div><h3>Files</h3>{attachments.data?.length?<div className="file-list">{attachments.data.map(a=><a href={`/api/v1/attachments/${a.id}/download`} key={a.id}><strong>{a.original_name}</strong><small>{a.document_key} · v{a.version_no}</small></a>)}</div>:<Empty>No files uploaded.</Empty>}{owner&&<UploadForm key={`task:${taskId}`} path={`/tasks/${taskId}/attachments`} queryKey={['attachments',taskId]} buttonLabel="Upload file"/>}</div></div></Card>
  <details className="task-history"><summary>Task history</summary><div className="history-controls"><select aria-label="History event filter" value={historyFilter} onChange={e=>setHistoryFilter(e.target.value)}><option value="">All events</option>{[...new Set(history.data?.map(x=>x.event_type)||[])].map(event=><option value={event} key={event}>{event.replaceAll('_',' ')}</option>)}</select><a className="button" href={`/api/v1/tasks/${taskId}/history.csv`}>Export CSV</a></div>{history.data?.filter(h=>!historyFilter||h.event_type===historyFilter).map(h=><div className="history-row" key={h.id}><span className="history-dot"/><div><strong>{h.event_type.replaceAll('_',' ')}</strong><small>{h.actor_name} · {new Date(h.created_at).toLocaleString()}</small><pre>{JSON.stringify(h.details,null,2)}</pre></div></div>)}</details>
  </>}</>
}

export function WorkspacePending({onTask,run}:{onTask:(id:number)=>void;run:Run}){
  const actions=useQuery({queryKey:['pending'],queryFn:()=>api<Action[]>('/me/pending-actions')});
  const [kind,setKind]=useState(''),[search,setSearch]=useState('');
  const filtered=(actions.data||[]).filter(a=>(!kind||a.kind===kind)&&a.title.toLowerCase().includes(search.toLowerCase()));
  return <Card title="Review and approvals" extra={<div className="review-filters"><select aria-label="Review type" value={kind} onChange={e=>setKind(e.target.value)}><option value="">All request types</option><option value="RESULT_REVIEW">Results</option><option value="EXTENSION">Due date</option><option value="REASSIGNMENT">Reassignment</option><option value="PENDENCY_APPROVAL">Prerequisites</option><option value="PENDENCY_RESOLVE">Resolution</option></select><input aria-label="Filter reviews by task" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by task"/></div>}>{actions.isLoading?<Empty>Loading review queue…</Empty>:filtered.length?filtered.map(a=><div className="pending-row" key={a.kind+'-'+a.id}><div><Pill text={a.kind}/><strong>{a.title}</strong><small>Task #{a.task_id}</small>{a.kind==="REASSIGNMENT"&&<small>{a.reason}{a.work_from&&a.work_until?' · Work window: '+dateOnly(a.work_from)+' to '+dateOnly(a.work_until):''}</small>}</div><div className="button-row"><button onClick={()=>onTask(a.task_id)}>View task</button>{a.kind==='RESULT_REVIEW'&&<><button onClick={()=>run(()=>post(`/results/${a.id}/review`,{accept:false,comment:'Returned for changes'}),'Result returned')}>Return</button><button className="primary" onClick={()=>run(()=>post(`/results/${a.id}/review`,{accept:true,comment:'Accepted'}),'Result accepted')}>Accept</button></>}{a.kind==='EXTENSION'&&<><button onClick={()=>run(()=>post(`/extension-requests/${a.id}/decision`,{approve:false}),'Extension rejected')}>Reject</button><button className="primary" onClick={()=>run(()=>post(`/extension-requests/${a.id}/decision`,{approve:true}),'Extension approved')}>Approve</button></>}{a.kind==='REASSIGNMENT'&&<><button onClick={()=>run(()=>post(`/reassignments/${a.id}/decision`,{approve:false}),'Reassignment rejected')}>Reject</button><button className="primary" onClick={()=>run(()=>post(`/reassignments/${a.id}/decision`,{approve:true}),'Reassignment approved')}>Approve</button></>}{a.kind==='PENDENCY_APPROVAL'&&<><button onClick={()=>run(()=>post(`/pendencies/${a.id}/decision`,{approve:false}),'Prerequisite rejected')}>Reject</button><button className="primary" onClick={()=>run(()=>post(`/pendencies/${a.id}/decision`,{approve:true}),'Prerequisite approved')}>Approve</button></>}{a.kind==='PENDENCY_RESOLVE'&&<button className="primary" onClick={()=>{const resolution=window.prompt('Resolution');if(resolution)run(()=>post(`/pendencies/${a.id}/resolve`,{resolution}),'Resolved')}}>Resolve</button>}</div></div>):<Empty>No matching reviews need your action.</Empty>}</Card>
}

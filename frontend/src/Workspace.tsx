import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api,post,patch,del,dateOnly,formatDate,dueLabel,dueClass,statusLabel,type User,type Project,type Task,type Group,type Action,type Result,type Attachment,type Pendency} from './api';
import {Link2} from 'lucide-react';

type Run=(action:()=>Promise<unknown>,success?:string)=>void;
type PageProps={user:User;projectId:number|null;onProject:(id:number)=>void;onTask:(id:number)=>void};
const value=(form:HTMLFormElement,key:string)=>String(new FormData(form).get(key)||'').trim();
const num=(form:HTMLFormElement,key:string)=>Number(value(form,key));
function Card({title,children,extra}:{title:string;children:ReactNode;extra?:ReactNode}){return <section className="card"><div className="card-head"><h2>{title}</h2>{extra}</div>{children}</section>}
function Empty({children}:{children:ReactNode}){return <p className="muted">{children}</p>}
function Pill({text}:{text:string}){return <span className={'pill '+text.toLowerCase()}>{statusLabel(text)}</span>}
function UploadForm({path,queryKey,buttonLabel,inline=false}:{path:string;queryKey:readonly unknown[];buttonLabel:string;inline?:boolean}){
  const qc=useQueryClient();
  const [uploadedName,setUploadedName]=useState('');
  const [selectedName,setSelectedName]=useState('');
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
      setSelectedName('');
      form.reset();
      void qc.invalidateQueries({queryKey}).catch(()=>{});
    }catch(failure){
      setError(failure instanceof Error?failure.message:'Upload failed');
    }finally{setUploading(false)}
  }
  return <div className="upload-area"><form className={inline?'inline-form':'stack compact-stack'} onSubmit={submit}><input name="document_key" placeholder="Document key" aria-label="Document key" required/><label className="upload-dropzone">Drop a file here or choose one<input name="file" type="file" aria-label="Choose file" required onChange={e=>{setSelectedName(e.target.files?.[0]?.name||'');setUploadedName('');setError('')}}/></label><button disabled={uploading}>{uploading?'Uploading…':buttonLabel}</button></form>{selectedName&&!uploading&&!error&&<p className="upload-selected" role="status">Selected: <strong>{selectedName}</strong> · Click {buttonLabel} to save it. <button type="button" onClick={e=>{const input=e.currentTarget.parentElement?.parentElement?.querySelector<HTMLInputElement>('input[name=file]');if(input)input.value='';setSelectedName('')}}>Remove</button></p>}{uploading&&<p className="upload-selected" role="status">Uploading <strong>{selectedName}</strong>…</p>}{uploadedName&&<div className="upload-confirmation" role="status" data-testid="upload-success"><span className="upload-tick" aria-hidden="true">✓</span><strong>{uploadedName}</strong><span>uploaded successfully</span></div>}{error&&<div className="notice error upload-error" role="alert" data-testid="upload-error">Upload failed for {selectedName}: {error}</div>}</div>
}
function UploadedFileList({files,canRemove=false}:{files:Attachment[];canRemove?:boolean}){const qc=useQueryClient();return <div className="file-list">{files.map(file=><div className="file-item" key={file.id}><a href={`/api/v1/attachments/${file.id}/download`}><span className="upload-tick" aria-label="Uploaded successfully">OK</span><span className="file-label"><strong>{file.original_name}</strong><small>{file.document_key} | v{file.version_no}</small></span></a>{canRemove&&!file.result_id&&<button aria-label={`Remove ${file.original_name}`} onClick={async()=>{await del(`/attachments/${file.id}`);await qc.invalidateQueries()}}>Remove</button>}</div>)}</div>}
function useProjects(){return useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')})}

export function WorkspaceTaskTable({tasks,onTask,renderActions}:{tasks:Task[];onTask:(id:number)=>void;renderActions?:(task:Task)=>ReactNode}){
  const [search,setSearch]=useState(''),[owner,setOwner]=useState(''),[status,setStatus]=useState(''),[priority,setPriority]=useState(''),[due,setDue]=useState(''),[sort,setSort]=useState<'due_date'|'title'|'owner_name'|'status'|'priority'>('due_date'),[reverse,setReverse]=useState(false);
  const owners=[...new Map(tasks.map(t=>[t.owner_id,t.owner_name||`User ${t.owner_id}`])).entries()];
  const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const rows=tasks.filter(t=>(!search||t.title.toLowerCase().includes(search.toLowerCase()))&&(!owner||String(t.owner_id)===owner)&&(!status||t.status===status)&&(!priority||t.priority===priority)&&(due!=='today'||dateOnly(t.due_date)===today)&&(due!=='overdue'||!!t.due_date&&dateOnly(t.due_date)<today&&t.status!=='DONE')).sort((a,b)=>{const x=String(a[sort]||'zzzz'),y=String(b[sort]||'zzzz');return (reverse?-1:1)*x.localeCompare(y)});
  const showDue=rows.some(t=>!!t.due_date);
  const heading=(label:string,key:typeof sort)=><button className="table-sort" onClick={()=>{if(sort===key)setReverse(!reverse);else{setSort(key);setReverse(false)}}}>{label}{sort===key?(reverse?' v':' ^'):''}</button>;
  return <><div className="table-filters"><input aria-label="Search tasks" placeholder="Search tasks" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter owner" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All owners</option>{owners.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['NOT_STARTED','IN_PROGRESS','SUBMITTED','RETURNED','DONE'].map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select><select aria-label="Filter priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">All priorities</option>{['HIGH','MEDIUM','LOW'].map(x=><option key={x} value={x}>{x[0]+x.slice(1).toLowerCase()}</option>)}</select><select aria-label="Filter due date" value={due} onChange={e=>setDue(e.target.value)}><option value="">Any due date</option><option value="today">Today</option><option value="overdue">Overdue</option></select></div>{!rows.length?<Empty>{tasks.length?'There are no tasks in this view.':'No tasks have been assigned in this project yet.'}</Empty>:<div className="table-wrap"><table className="workspace-table"><thead><tr><th>{heading('Task','title')}</th>{showDue&&<th>{heading('Due date','due_date')}</th>}<th>{heading('Owner','owner_name')}</th><th>{heading('Status','status')}</th><th>{heading('Priority','priority')}</th>{renderActions&&<th>Actions</th>}</tr></thead><tbody>{rows.map(t=><tr className="clickable" tabIndex={0} key={t.id} onKeyDown={e=>{if(e.key==='Enter')onTask(t.id)}} onClick={()=>onTask(t.id)}><td>{t.parent_task_id&&<span title="Has parent task" className="dependency-icon"><Link2 size={14}/></span>}<button className="table-link" onClick={e=>{e.stopPropagation();onTask(t.id)}}>{t.title}</button></td>{showDue&&<td className={dueClass(t.due_date)}>{dueLabel(t.due_date)}</td>}<td><span className="avatar-initials">{(t.owner_name||'?').split(' ').map(x=>x[0]).slice(0,2).join('')}</span> {t.owner_name||'Unassigned'}</td><td><Pill text={t.status}/></td><td className={t.priority==='HIGH'?'priority-high':''}>{t.priority[0]+t.priority.slice(1).toLowerCase()}</td>{renderActions&&<td onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>{renderActions(t)}</td>}</tr>)}</tbody></table></div>}</>;
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
  }}><label>Project name<input name="name" defaultValue={project.name} required/></label><label>Project deadline<input name="target_date" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} required/></label><label className="full-field">Description<textarea name="description" defaultValue={project.description} rows={3}/></label>{lateTasks.length>0&&<div className="notice full-field"><strong>{lateTasks.length} task{lateTasks.length===1?'':'s'} due on or after this deadline:</strong> {lateTasks.map(task=>`${task.title} (${formatDate(task.due_date)})`).join(', ')}. {shortening?'Move these task dates before shortening the deadline.':'You can save a later deadline, then adjust these task dates.'}</div>}{error&&<div className="notice error full-field">{error}</div>}<div className="button-row"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={shortening&&lateTasks.length>0}>Save project</button></div></form></Card>
}
function CreateTaskForm({projectId,deadline,members,groups,tasks,run,onClose}:{projectId:number;deadline?:string;members:User[];groups:Group[];tasks:Task[];run:Run;onClose:()=>void}){
  return <Card title="New task"><form className="form-grid task-create" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{const created=await post<Task>(`/projects/${projectId}/tasks`,{title:value(f,'title'),description:value(f,'description'),expected_deliverables:value(f,'expected_deliverables'),owner_id:num(f,'owner_id'),priority:value(f,'priority'),due_date:value(f,'due_date'),parent_task_id:num(f,'parent_task_id')||null});const groupId=num(f,'group_id');if(groupId)await patch(`/tasks/${created.id}/visibility`,{group_id:groupId});onClose()},'Task created')}}><label>Task title<input name="title" required/></label><label>Assign to<select name="owner_id" required><option value="">Select team member</option>{members.map(m=><option value={m.id} key={m.id}>{m.full_name}</option>)}</select></label><label>Due date<input name="due_date" type="date" max={deadline} required/></label><label>Linked to<select name="parent_task_id"><option value="">No linked task</option>{tasks.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label><label>Priority<select name="priority"><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="LOW">Low</option></select></label><label>Share with group<select name="group_id"><option value="">Private</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label><label className="full-field">Description<textarea name="description" rows={3}/></label><label className="full-field">Expected deliverables<textarea name="expected_deliverables" rows={3}/></label>{deadline&&<p className="muted full-field">Task due date must be before the project deadline.</p>}<div className="button-row"><button type="button" onClick={onClose}>Cancel</button><button className="primary">Create task</button></div></form></Card>
}
export function WorkspaceTasks({user,projectId,onProject,onTask,run}:PageProps&{run:Run}){
  const projects=useProjects();
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!projectId});
  const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`),enabled:!!projectId&&user.role==='PM'});
  const groups=useQuery({queryKey:['groups',projectId],queryFn:()=>api<Group[]>(`/projects/${projectId}/groups`),enabled:!!projectId&&user.role==='PM'});
  const [showCreate,setShowCreate]=useState(false);
  const deadline=maxTaskDate(projects.data?.find(p=>p.id===projectId)?.target_date);
  return <><div className="toolbar">{user.role==='PM'&&<button className="primary" disabled={!projectId} onClick={()=>setShowCreate(open=>!open)}>New task</button>}</div>{showCreate&&projectId&&user.role==='PM'&&<CreateTaskForm projectId={projectId} deadline={deadline} members={members.data||[]} groups={groups.data||[]} tasks={tasks.data||[]} run={run} onClose={()=>setShowCreate(false)}/>}<Card title={user.role==='MEMBER'?'My and shared tasks':'Project tasks'}>{tasks.isLoading?<Empty>Loading tasks…</Empty>:tasks.isError?<Empty>Tasks could not be loaded.</Empty>:<WorkspaceTaskTable tasks={tasks.data||[]} onTask={onTask}/>}</Card></>
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
  return <><div className="toolbar">{user.role==='PM'&&<><button className="primary" onClick={()=>{setShowCreate(open=>!open);setShowEdit(false)}}>New project</button><button disabled={!project} onClick={()=>{setShowEdit(open=>!open);setShowCreate(false)}}>Edit project</button></>}</div>{showCreate&&user.role==='PM'&&<CreateProjectForm run={run} onProject={onProject} onClose={()=>setShowCreate(false)}/>} {showEdit&&user.role==='PM'&&project&&<EditProjectForm key={project.id} project={project} tasks={tasks.data||[]} onClose={()=>setShowEdit(false)}/>} {projectId&&<><div className="project-summary"><div><span className="eyebrow">PROJECT</span><h2>{project?.name}</h2><p>{project?.description||'No project description.'}</p><p className="project-deadline">Deadline: <strong>{dueLabel(project?.target_date)}</strong></p></div><div className="project-summary-stats"><strong>{members.data?.length??'—'}</strong><span>Team members</span><strong>{groups.data?.length??'—'}</strong><span>Groups</span></div></div><Card title="Tasks">{tasks.isLoading?<Empty>Loading tasks…</Empty>:<WorkspaceTaskTable tasks={tasks.data||[]} onTask={onTask}/>}</Card><Card title="Project documents">{user.role==='PM'&&<UploadForm key={`project:${projectId}`} path={`/projects/${projectId}/documents`} queryKey={['docs',projectId]} buttonLabel="Upload" inline/>}{docs.data?.length?<UploadedFileList files={docs.data} canRemove={user.role==='PM'}/>:<Empty>No project documents yet.</Empty>}</Card></>}</>
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
  return <><div className="toolbar"></div><Card title="Add team member"><p className="muted">Select an existing user account for {projects.data?.find(p=>p.id===projectId)?.name||'this project'}.</p><form className="inline-form" onSubmit={e=>{e.preventDefault();run(()=>post(`/projects/${projectId}/members`,{user_id:num(e.currentTarget,'user_id')}),'Team member added')}}><select name="user_id" required><option value="">Select user</option>{users.data?.filter(u=>u.role==='MEMBER'&&!members.data?.some(m=>m.id===u.id)).map(u=><option value={u.id} key={u.id}>{u.full_name} ({u.username})</option>)}</select><button disabled={!projectId}>Add to team</button></form><div className="chips">{members.data?.map(m=><span className="team-chip" key={m.id}>{m.full_name}</span>)}</div></Card>{projectId&&<><Card title="Import team and groups from Excel"><p className="muted">Use an .xlsx sheet with a <strong>username</strong> column and an optional <strong>group</strong> column. Usernames must already exist. New group names in the sheet are created for this project.</p><div className="inline-form"><input type="file" accept=".xlsx" aria-label="Excel member sheet" onChange={e=>setSheet(e.target.files?.[0]||null)}/><button disabled={!sheet||!users.data||!members.data||!groups.data} onClick={()=>run(importSheet,'Excel members and groups imported')}>Import Excel sheet</button></div></Card><Card title="Groups"><form className="inline-form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post(`/projects/${projectId}/groups`,{name:value(f,'name')});f.reset()},'Group created')}}><input name="name" placeholder="New group name" required/><button>Create group</button></form>{groups.data?.length?groups.data.map(g=><div className="group-row" key={g.id}><div className="row"><strong>{g.name}</strong><small>{g.member_ids?.length||0} team members</small></div><p className="muted">Group members can view and comment on shared tasks.</p><form className="inline-form" onSubmit={e=>{e.preventDefault();run(()=>post(`/groups/${g.id}/members`,{user_id:num(e.currentTarget,'user_id')}),'Group member added')}}><select name="user_id" required><option value="">Select team member</option>{members.data?.filter(m=>!g.member_ids?.includes(m.id)).map(m=><option value={m.id} key={m.id}>{m.full_name}</option>)}</select><button>Add to group</button></form><div className="chips">{g.member_ids?.map(id=><button key={id} onClick={()=>run(()=>del(`/groups/${g.id}/members/${id}`),'Group member removed')}>{members.data?.find(m=>m.id===id)?.full_name||`User #${id}`} ×</button>)}</div></div>):<Empty>No groups yet.</Empty>}</Card></>}</>
}

type Reassignment={id:number;new_owner_id:number;requested_by:number;status:string;reason:string;work_from:string|null;work_until:string|null};
type Extension={id:number;new_due_date:string;status:string;reason:string};
type Comment={id:number;body:string;author_name:string;created_at:string};
type Event={id:number;event_type:string;actor_name:string;created_at:string;details:unknown};
export function WorkspaceTaskDetail({user,taskId,onBack,onTask,run}:{user:User;taskId:number;onBack:()=>void;onTask:(id:number)=>void;run:Run}){
  const task=useQuery({queryKey:['task',taskId],queryFn:()=>api<Task>(`/tasks/${taskId}`)});
  const t=task.data,full=!!t&&!t.limited;
  const groupPermissions=useQuery({queryKey:['groups',t?.project_id],queryFn:()=>api<Group[]>(`/projects/${t?.project_id}/groups`),enabled:full&&!!t?.group_id});
  const sharedGroup=groupPermissions.data?.find(g=>g.id===t?.group_id);
  const tasks=useQuery({queryKey:['tasks',t?.project_id],queryFn:()=>api<Task[]>(`/projects/${t?.project_id}/tasks`),enabled:full});
  const subProjectColleague=!!t?.sub_project_id&&(tasks.data||[]).some(item=>item.sub_project_id===t.sub_project_id&&item.owner_id===user.id);
  const directAccess=!!t&&(t.owner_id===user.id||user.role==='PM'||t.sub_project_owner_id===user.id);
  const canViewResults=directAccess||!!sharedGroup?.can_view_results;
  const canComment=directAccess||subProjectColleague||!!sharedGroup?.can_comment;
  const members=useQuery({queryKey:['members',t?.project_id],queryFn:()=>api<User[]>(`/projects/${t?.project_id}/members`),enabled:full});
  const users=useQuery({queryKey:['users'],queryFn:()=>api<User[]>('/users'),enabled:full});
  const results=useQuery({queryKey:['results',taskId],queryFn:()=>api<Result[]>(`/tasks/${taskId}/results`),enabled:full&&canViewResults});
  const comments=useQuery({queryKey:['comments',taskId],queryFn:()=>api<Comment[]>(`/tasks/${taskId}/comments`),enabled:full});
  const attachments=useQuery({queryKey:['attachments',taskId],queryFn:()=>api<Attachment[]>(`/tasks/${taskId}/attachments`),enabled:full&&canViewResults});
  const extensions=useQuery({queryKey:['extensions',taskId],queryFn:()=>api<Extension[]>(`/tasks/${taskId}/extensions`),enabled:full});
  const reassignments=useQuery({queryKey:['reassignments',taskId],queryFn:()=>api<Reassignment[]>(`/tasks/${taskId}/reassignments`),enabled:full});
  const pendencies=useQuery({queryKey:['prerequisites',taskId],queryFn:()=>api<Pendency[]>(`/tasks/${taskId}/prerequisites`),enabled:full});
  const history=useQuery({queryKey:['history',taskId],queryFn:()=>api<Event[]>(`/tasks/${taskId}/history`),enabled:full});
  const projects=useProjects();
  const deadline=maxTaskDate(projects.data?.find(p=>p.id===t?.project_id)?.target_date);
  const [showResult,setShowResult]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [historyFilter,setHistoryFilter]=useState('');
  useEffect(()=>{setShowResult(false);setShowEdit(false);setHistoryFilter('')},[taskId]);
  if(task.isLoading)return <Empty>Loading task…</Empty>;
  if(task.isError||!t)return <div className="notice error">Task could not be opened.</div>;
  const owner=t.owner_id===user.id,pm=user.role==='PM',taskEditor=pm||t.sub_project_owner_id===user.id;
  const linked=tasks.data?.find(x=>x.id===t.parent_task_id);
  const taskPendencies=pendencies.data||[];
  const pendingReassignment=reassignments.data?.some(r=>r.status==='PENDING');
  const subtasks=tasks.data?.filter(x=>x.parent_task_id===taskId)||[];
  const latest=results.data?.at(-1);
  const returned=results.data?.find(x=>x.review_status==='RETURNED');
  const people=new Map((users.data||[]).map(x=>[x.id,x.full_name]));
  const describe=(event:Event)=>{const d=(event.details||{}) as Record<string,unknown>;const person=(id:unknown)=>people.get(Number(id))||'A team member';switch(event.event_type){
    case 'TASK_CREATED':return `${event.actor_name} created this task and assigned it to ${person(d.owner_id)}.`;
    case 'TASK_UPDATED':return `${event.actor_name} updated the task.`;
    case 'STATUS_CHANGED':return `${event.actor_name} started the task.`;
    case 'PROGRESS_CHANGED':return `${event.actor_name} set progress to ${d.new}%. ${d.justification||''}`;
    case 'RESULT_SUBMITTED':return `${event.actor_name} submitted version ${d.version_no} for review.`;
    case 'RESULT_REVIEWED':return `${event.actor_name} ${d.review==='ACCEPTED'?'accepted':'returned'} the submission. ${d.comment||''}`;
    case 'REASSIGNMENT_DECIDED':return `${event.actor_name} ${d.status==='APPROVED'?`assigned this to ${person(d.new)}`:'rejected the reassignment'}.`;
    case 'ATTACHMENT_UPLOADED':return `${event.actor_name} uploaded a file.`;
    case 'PENDENCY_RESOLVED':return `${event.actor_name} answered a prerequisite request.`;
    default:return `${event.actor_name} ${event.event_type.toLowerCase().replaceAll('_',' ')}.`;
  }};
  const activity=[...(history.data||[]).filter(x=>x.event_type!=='COMMENT_ADDED').map(x=>({id:`h${x.id}`,at:x.created_at,text:describe(x)})),...(comments.data||[]).map(x=>({id:`c${x.id}`,at:x.created_at,text:`${x.author_name} commented: ${x.body}`}))].sort((a,b)=>a.at.localeCompare(b.at));
  return <><div className="breadcrumb"><button className="text-button" onClick={onBack}>Tasks</button><span>/</span><span>{t.title}</span></div><section className="task-heading"><div><span className="eyebrow">TASK #{t.id}</span><h2>{t.title}</h2><div className="task-facts"><Pill text={t.status}/><span>Owner <strong>{t.owner_name||members.data?.find(x=>x.id===t.owner_id)?.full_name||'Unknown'}</strong></span><span>Priority <strong className={t.priority==='HIGH'?'priority-high':''}>{t.priority[0]+t.priority.slice(1).toLowerCase()}</strong></span><span className={dueClass(t.due_date)}>Due <strong>{dueLabel(t.due_date)}</strong></span><span>Project <strong>{t.project_name||projects.data?.find(x=>x.id===t.project_id)?.name}</strong></span>{t.sub_project_name&&<span>Sub-project <strong>{t.sub_project_name}</strong></span>}<span>Assigned by <strong>{t.assigned_by_name||'Project manager'}</strong></span></div></div><div className="task-heading-actions">{owner&&t.status==='NOT_STARTED'&&<button className="primary" onClick={()=>run(()=>post(`/tasks/${taskId}/status`,{}),'Task started')}>Start task</button>}{owner&&['IN_PROGRESS','RETURNED'].includes(t.status)&&<button className="primary" onClick={()=>document.getElementById('submission-panel')?.scrollIntoView({behavior:'smooth'})}>Submit for review</button>}{taskEditor&&<button onClick={()=>setShowEdit(!showEdit)}>{showEdit?'Cancel edit':'Edit task'}</button>}{owner&&<details className="request-menu"><summary>Request</summary><div><a href="#request-extension">Due date extension</a><a href="#request-reassignment">Reassignment</a></div></details>}</div></section>
  {t.limited?<Card title="Review context"><p>Only the task title and status are available for this decision.</p></Card>:<>
  {t.status==='RETURNED'&&returned&&<div className="notice returned-banner"><strong>Returned for changes</strong><p>{returned.review_comment||'The manager requested changes.'}</p></div>}
  {showEdit&&taskEditor&&<Card title="Edit task"><form className="form-grid" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await patch(`/tasks/${taskId}`,{title:value(f,'title'),description:value(f,'description'),expected_deliverables:value(f,'expected_deliverables'),priority:value(f,'priority'),due_date:value(f,'due_date'),parent_task_id:num(f,'parent_task_id')||null});if(Number(value(f,'owner_id'))!==t.owner_id)await patch('/tasks/'+taskId+'/assignment',{owner_id:Number(value(f,'owner_id'))});setShowEdit(false)},'Task updated')}}><label>Title<input name="title" defaultValue={t.title} required/></label><label>Task owner<select name="owner_id" defaultValue={t.owner_id}>{[user,...(members.data||[])].map(person=><option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label><label>Due date<input name="due_date" type="date" defaultValue={dateOnly(t.due_date)}/></label><label>Priority<select name="priority" defaultValue={t.priority}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label><label>Parent task<select name="parent_task_id" defaultValue={t.parent_task_id||''}><option value="">None</option>{tasks.data?.filter(x=>x.id!==taskId&&x.sub_project_id===t.sub_project_id).map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label><label className="full-field">Description<textarea name="description" rows={4} defaultValue={t.description}/></label><label className="full-field">Expected deliverables<textarea name="expected_deliverables" rows={3} defaultValue={t.expected_deliverables||''}/></label><button className="primary">Save changes</button></form></Card>}
  <Card title="Description and expected deliverables"><p className="preserve-lines">{t.description||'The project manager has not added a description yet.'}</p><h3>Expected deliverables</h3><p className="preserve-lines">{t.expected_deliverables||'No deliverables specified yet.'}</p></Card>
  <Card title="Prerequisites"><h3>Blocked by</h3>{taskPendencies.length?taskPendencies.map(p=><div className="approval" key={p.id}><strong>{p.depends_on_title||p.description}</strong> <Pill text={p.depends_on_status||p.status}/><p>{p.description}</p>{p.blocked&&<span className="priority-high">Blocked</span>}</div>):<Empty>No prerequisites are blocking this task.</Empty>}{owner&&<details><summary>Add prerequisite</summary><form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(()=>post('/pendencies',{blocked_task_id:taskId,depends_on_task_ids:[num(f,'depends_on_task_id')],responsible_user_id:num(f,'responsible_user_id'),type:'ACTION',description:value(f,'description'),needs_approval:true}),'Prerequisite requested')}}><select name="depends_on_task_id" required><option value="">Task</option>{tasks.data?.filter(x=>x.id!==taskId&&x.sub_project_id===t.sub_project_id).map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select><select name="responsible_user_id" required><option value="">Responsible person</option>{members.data?.map(x=><option value={x.id} key={x.id}>{x.full_name}</option>)}</select><textarea name="description" placeholder="What is needed?" required/><button>Add prerequisite</button></form></details>}</Card>
  <Card title="Subtasks and progress"><div className="row"><strong>{t.subtask_count?.done??subtasks.filter(x=>x.status==='DONE').length} of {t.subtask_count?.total??subtasks.length} subtasks done</strong><strong>{t.progress_percent??0}% progress</strong></div>{subtasks.length?subtasks.map(x=><button className="bento-row" key={x.id} onClick={()=>onTask(x.id)}><strong>{x.title}</strong><small>{x.description} | {x.owner_name} | {dueLabel(x.due_date)} | {statusLabel(x.status)}</small></button>):<Empty>No subtasks yet.</Empty>}{pm&&<details><summary>Add subtask</summary><form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(()=>post(`/projects/${t.project_id}/tasks`,{title:value(f,'title'),description:value(f,'description'),expected_deliverables:value(f,'expected_deliverables'),owner_id:num(f,'owner_id'),priority:'MEDIUM',due_date:value(f,'due_date'),parent_task_id:taskId}),'Subtask created')}}><input name="title" placeholder="Subtask title" required/><textarea name="description" placeholder="Details"/><select name="owner_id" required><option value="">Owner</option>{members.data?.map(x=><option value={x.id} key={x.id}>{x.full_name}</option>)}</select><input name="due_date" type="date" required/><button>Create subtask</button></form></details>}{owner&&['IN_PROGRESS','RETURNED'].includes(t.status)&&<form className="progress-form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post(`/tasks/${taskId}/progress`,{percent:num(f,'percent'),justification:value(f,'justification')});f.reset()},'Progress updated')}}><label>Progress percentage<input type="number" name="percent" min="0" max="100" defaultValue={t.progress_percent??0} required/></label><label>Why did progress change?<textarea name="justification" rows={2} required/></label><button>Update progress</button></form>}</Card>
  <Card title="Activity"><div className="activity-list">{activity.length?activity.map(x=><div className="history-row" key={x.id}><span className="history-dot"/><div><p className="preserve-lines">{x.text}</p><small>{new Date(x.at).toLocaleString('en-GB')}</small></div></div>):<Empty>Activity will appear here as the task moves forward.</Empty>}</div>{canComment&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{await post(`/tasks/${taskId}/comments`,{body:value(f,'body')});f.reset()},'Comment added')}}><label>Comment<textarea name="body" rows={3} placeholder="Write a comment; use @name to mention a teammate" required/></label><button>Add comment</button></form>}</Card>
  <Card title="Files">{!canViewResults?<Empty>Files are hidden for this group.</Empty>:attachments.data?.length?<UploadedFileList files={attachments.data} canRemove={owner||pm}/>:<Empty>No supporting files have been added.</Empty>}{owner&&<UploadForm key={`task:${taskId}`} path={`/tasks/${taskId}/attachments`} queryKey={['attachments',taskId]} buttonLabel="Upload file"/>}</Card>
  {owner&&<Card title="Requests"><div id="request-extension"><h3>Due date extension</h3>{extensions.data?.map(x=><p key={x.id}>{formatDate(x.new_due_date)} ? {x.reason} ? {x.status}</p>)}<form className="inline-form" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(()=>post(`/tasks/${taskId}/extension-requests`,{new_due_date:value(f,'new_due_date'),reason:value(f,'reason')}),'Extension requested')}}><input name="new_due_date" type="date" max={deadline} required/><input name="reason" placeholder="Reason" required/><button>Request extension</button></form></div><div id="request-reassignment"><h3>Reassignment</h3>{reassignments.data?.map(x=><p key={x.id}>{x.reason} ? {x.status}</p>)}{!pendingReassignment&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(()=>post(`/tasks/${taskId}/reassignments`,{new_owner_id:num(f,'new_owner_id'),work_from:value(f,'work_from'),work_until:value(f,'work_until'),reason:value(f,'reason')}),'Reassignment requested')}}><select name="new_owner_id" required><option value="">New owner</option>{members.data?.filter(x=>x.id!==t.owner_id).map(x=><option value={x.id} key={x.id}>{x.full_name}</option>)}</select><div className="date-pair"><input name="work_from" type="date" required/><input name="work_until" type="date" required/></div><textarea name="reason" placeholder="Reason" required/><button>Request reassignment</button></form>}</div></Card>}
  <section id="submission-panel"><Card title="Submission">{!canViewResults?<Empty>Submissions are hidden for this group.</Empty>:results.data?.length?results.data.map(r=><div className="result" key={r.id}><div className="row"><strong>Version {r.version_no}</strong><Pill text={r.review_status}/></div><p className="preserve-lines">{r.work_completed}</p>{!!r.attachment_names?.length&&<p className="muted">Files: {r.attachment_names.join(', ')}</p>}{r.review_comment&&<p className="muted">Review outcome: {r.review_comment}</p>}{pm&&r.review_status==='PENDING'&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,button=(e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;run(()=>post(`/results/${r.id}/review`,{accept:button.value==='accept',comment:value(f,'comment')}),'Review recorded')}}><label>Review note<textarea name="comment" rows={2} required/></label><div className="button-row"><button value="return">Return</button><button value="accept" className="primary">Accept</button></div></form>}</div>):<Empty>The owner has not submitted a result yet.</Empty>}{owner&&['IN_PROGRESS','RETURNED'].includes(t.status)&&<form className="stack compact-stack" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;run(async()=>{const summary=value(f,'summary');await post(`/tasks/${taskId}/results`,{work_completed:summary,outcome:summary,attachment_ids:(attachments.data||[]).filter(x=>!x.result_id).map(x=>x.id)});f.reset()},'Result submitted for review')}}><label>Result summary<textarea name="summary" rows={4} required placeholder="Describe the work delivered"/></label><p className="muted">Files included: {attachments.data?.length?attachments.data.map(x=>x.original_name).join(', '):'None attached'}</p><button className="primary">Submit for review</button></form>}</Card></section>

  </>}</>;

}

export function WorkspacePending({onTask,run}:{onTask:(id:number)=>void;run:Run}){
  const actions=useQuery({queryKey:['pending'],queryFn:()=>api<Action[]>('/me/pending-actions')});
  const [kind,setKind]=useState(''),[search,setSearch]=useState('');
  const filtered=(actions.data||[]).filter(a=>(!kind||a.kind===kind)&&a.title.toLowerCase().includes(search.toLowerCase()));
  return <Card title="Review and approvals" extra={<div className="review-filters"><select aria-label="Review type" value={kind} onChange={e=>setKind(e.target.value)}><option value="">All request types</option><option value="RESULT_REVIEW">Results</option><option value="EXTENSION">Due date</option><option value="REASSIGNMENT">Reassignment</option><option value="PENDENCY_APPROVAL">Prerequisites</option><option value="PENDENCY_RESOLVE">Resolution</option></select><input aria-label="Filter reviews by task" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by task"/></div>}>{actions.isLoading?<Empty>Loading review queue…</Empty>:filtered.length?filtered.map(a=><div className="pending-row" key={a.kind+'-'+a.id}><div><Pill text={a.kind}/><strong>{a.title}</strong><small>Task #{a.task_id}</small>{a.kind==="REASSIGNMENT"&&<small>{a.reason}{a.work_from&&a.work_until?' · Work window: '+formatDate(a.work_from)+' to '+formatDate(a.work_until):''}</small>}</div><div className="button-row"><button onClick={()=>onTask(a.task_id)}>View task</button>{a.kind==='RESULT_REVIEW'&&<><button onClick={()=>run(()=>post(`/results/${a.id}/review`,{accept:false,comment:'Returned for changes'}),'Result returned')}>Return</button><button className="primary" onClick={()=>run(()=>post(`/results/${a.id}/review`,{accept:true,comment:'Accepted'}),'Result accepted')}>Accept</button></>}{a.kind==='EXTENSION'&&<><button onClick={()=>run(()=>post(`/extension-requests/${a.id}/decision`,{approve:false}),'Extension rejected')}>Reject</button><button className="primary" onClick={()=>run(()=>post(`/extension-requests/${a.id}/decision`,{approve:true}),'Extension approved')}>Approve</button></>}{a.kind==='REASSIGNMENT'&&<><button onClick={()=>run(()=>post(`/reassignments/${a.id}/decision`,{approve:false}),'Reassignment rejected')}>Reject</button><button className="primary" onClick={()=>run(()=>post(`/reassignments/${a.id}/decision`,{approve:true}),'Reassignment approved')}>Approve</button></>}{a.kind==='PENDENCY_APPROVAL'&&<><button onClick={()=>run(()=>post(`/pendencies/${a.id}/decision`,{approve:false}),'Prerequisite rejected')}>Reject</button><button className="primary" onClick={()=>run(()=>post(`/pendencies/${a.id}/decision`,{approve:true}),'Prerequisite approved')}>Approve</button></>}{a.kind==='PENDENCY_RESOLVE'&&<button className="primary" onClick={()=>{const resolution=window.prompt('Resolution');if(resolution)run(()=>post(`/pendencies/${a.id}/resolve`,{resolution}),'Resolved')}}>Resolve</button>}</div></div>):<Empty>No matching reviews need your action.</Empty>}</Card>
}

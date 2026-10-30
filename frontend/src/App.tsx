import {useEffect,useLayoutEffect,useState,type FormEvent,type MouseEvent,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api,post,dateOnly,formatDate,dueLabel,dueClass,statusLabel,type User,type Project,type Task,type Action} from './api';
import CommandPalette from './CommandPalette';
import {WorkspaceTasks,WorkspaceTaskDetail,WorkspacePending,WorkspaceTaskTable} from './Workspace';
import {PMOverview,PMProjects,PMTasks,PMReview,PMSettings,AdminAccounts} from './PMPages';
import {demoAccounts,demoPassword} from '../../backend/src/demo';
import {ChartNoAxesCombined,FolderKanban,Inbox,LayoutDashboard,ListTodo,LogOut,Moon,PanelLeftClose,PanelLeftOpen,Search,Settings as SettingsIcon,Sun,Bell} from 'lucide-react';
import {motion,useReducedMotion} from 'motion/react';

function Card({title,children,extra}:{title:string;children:ReactNode;extra?:ReactNode}){return <section className="card"><div className="card-head"><h2>{title}</h2>{extra}</div>{children}</section>}
function Empty({text}:{text:string}){return <p className="muted">{text}</p>}
function Pill({value}:{value:string}){return <span className={'pill '+value.toLowerCase()}>{statusLabel(value)}</span>}
function DateText({value}:{value:string|null|undefined}){return <span className={dueClass(value)}>{dueLabel(value)}</span>}
function useInteractiveTestIds(role:string,screen:string){
  useEffect(()=>{
    const root=document.getElementById('root');if(!root)return;
    let serial=0;
    const assign=()=>root.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]').forEach(element=>{
      if(element.hasAttribute('data-testid'))return;
      const label=(element.getAttribute('aria-label')||element.getAttribute('name')||element.getAttribute('title')||element.textContent||element.tagName).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'control';
      element.setAttribute('data-testid',`${role}-${screen}-${label}-${++serial}`);
    });
    const observer=new MutationObserver(assign);
    observer.observe(root,{subtree:true,childList:true});
    assign();
    return()=>observer.disconnect();
  },[role,screen]);
}
function App(){
  const qc=useQueryClient();const [user,setUser]=useState<User|null>(null),[screen,setScreen]=useState('overview'),[projectId,setProjectId]=useState<number|null>(()=>Number(localStorage.getItem('cvrde-project-id'))||null),[taskId,setTaskId]=useState<number|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[taskFilter,setTaskFilter]=useState('');
  const reducedMotion=useReducedMotion();
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem('cvrde-sidebar-collapsed')==='true');
  const [theme,setTheme]=useState<'light'|'dark'>(()=>localStorage.getItem('cvrde-theme')==='dark'?'dark':'light');
  const [commandOpen,setCommandOpen]=useState(false);const [bellOpen,setBellOpen]=useState(false);const notifications=useQuery({queryKey:['notifications',user?.id],queryFn:()=>api<{id:number;event_type:string;task_id:number|null;subject:string;sent_at:string;read_at:string|null}[]>('/me/notifications'),enabled:!!user,refetchInterval:30000});const unread=(notifications.data||[]).filter(n=>!n.read_at).length;const pendingCount=useQuery({queryKey:['pending'],queryFn:()=>api<Action[]>('/me/pending-actions'),enabled:!!user});const memberTasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!user&&user.role==='MEMBER'&&!!projectId});const returnedCount=(memberTasks.data||[]).filter(t=>t.owner_id===user?.id&&t.status==='RETURNED').length;const projectList=useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects'),enabled:!!user});const currentProjectName=projectList.data?.find(p=>p.id===projectId)?.name||'Project';
  useInteractiveTestIds(user?.role.toLowerCase()||'guest',user?screen:'login');
  useEffect(()=>{localStorage.setItem('cvrde-sidebar-collapsed',String(collapsed));},[collapsed]);useEffect(()=>{if(projectId)localStorage.setItem('cvrde-project-id',String(projectId))},[projectId]);
  useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('cvrde-theme',theme);},[theme]);
  function toggleTheme(event:MouseEvent<HTMLButtonElement>){
    const next=theme==='light'?'dark':'light';
    const rect=event.currentTarget.getBoundingClientRect();
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    if(reducedMotion||!document.startViewTransition){setTheme(next);return}
    const radius=Math.hypot(Math.max(x,window.innerWidth-x),Math.max(y,window.innerHeight-y));
    document.documentElement.classList.add('theme-transitioning');
    const transition=document.startViewTransition(()=>{document.documentElement.dataset.theme=next;flushSync(()=>setTheme(next))});
    transition.ready.then(()=>document.documentElement.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},{duration:580,easing:'cubic-bezier(.22,1,.36,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{});
    transition.finished.finally(()=>document.documentElement.classList.remove('theme-transitioning'));
  }
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setCommandOpen(open=>!open)}if(event.key==='Escape')setCommandOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
  useEffect(()=>{api<User>('/auth/me').then(u=>{setUser(u);setScreen(u.role==='PM'?'overview':u.role==='MEMBER'?'mine':u.role==='ADMIN'?'accounts':'pending')}).catch(()=>{});},[]);
  async function run(action:()=>Promise<unknown>,success='Saved'){setError('');setMessage('');try{await action();setMessage(success);await qc.invalidateQueries();}catch(e){setError(e instanceof Error?e.message:String(e));}}
  function go(name:string){setScreen(name);setTaskId(null);setTaskFilter('');setMessage('');setError('');}
  function goFilteredTasks(filter:string){setTaskFilter(filter);setScreen('tasks');setTaskId(null)}
  if(!user)return <Login theme={theme} onThemeChange={toggleTheme} onLogin={u=>{setUser(u);setScreen(u.role==='PM'?'overview':u.role==='MEMBER'?'mine':u.role==='ADMIN'?'accounts':'pending')}}/>;
  const showTask=(id:number)=>{setTaskId(id);setScreen('task');setMessage('');setError('');};
  const navItems: [string, typeof LayoutDashboard][]=(user.role==='PM'?[['overview',LayoutDashboard],['projects',FolderKanban],['tasks',ListTodo],['pending',Inbox],['reports',ChartNoAxesCombined],['settings',SettingsIcon]]:user.role==='ADMIN'?[['accounts',SettingsIcon]]:user.role==='REVIEWER'?[['pending',Inbox],['tasks',ListTodo]]:[['mine',LayoutDashboard],['projects',FolderKanban],['tasks',ListTodo],['submissions',Inbox]]);
  return <div className={'shell'+(collapsed?' sidebar-collapsed':'')}><aside className="sidebar"><div className="sidebar-brand-row"><div className="brand"><span className="brand-icon">C</span><div className="brand-copy"><strong>CVRDE</strong><small>WORK MANAGEMENT</small></div></div><button data-testid="toggle-sidebar" className="collapse-button" title={collapsed?'Expand sidebar':'Collapse sidebar'} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<PanelLeftOpen size={16} strokeWidth={1.5}/>:<PanelLeftClose size={16} strokeWidth={1.5}/>}</button></div><div className="sidebar-org">Combat Vehicles Research and Development Establishment</div>{user.role!=='ADMIN'&&<div className="sidebar-project"><ProjectPicker value={projectId} onChange={setProjectId}/></div>}<div className="nav-caption">WORKSPACE</div><nav>
    {navItems.map(([name,Icon])=><button key={name} data-testid={`nav-${name}`} title={name==='pending'?'Review':name==='mine'?'My work':name==='submissions'?'My submissions':name[0]!.toUpperCase()+name.slice(1)} aria-label={name==='pending'?'Review':name==='mine'?'My work':name==='submissions'?'My submissions':name[0]!.toUpperCase()+name.slice(1)} aria-current={screen===name?'page':undefined} className={screen===name?'active':''} onClick={()=>go(name)}><span className="nav-icon"><Icon size={18} strokeWidth={1.5}/></span><span className="nav-label">{name==='pending'?'Review':name==='mine'?'My work':name==='submissions'?'My submissions':name[0]!.toUpperCase()+name.slice(1)}</span>{name==='pending'&&!!pendingCount.data?.length&&<span className="nav-count">{pendingCount.data.length}</span>}{name==='submissions'&&returnedCount>0&&<span className="nav-count">{returnedCount}</span>}</button>)}
  </nav><div className="sidebar-foot"><div className="user-avatar">{user.full_name.slice(0,1)}</div><div className="user-copy"><strong>{user.full_name}</strong><small>{user.role}</small></div><button title="Sign out" aria-label="Sign out" onClick={()=>run(async()=>{await post('/auth/logout',{});setUser(null)},'Signed out')}><span className="nav-icon"><LogOut size={18} strokeWidth={1.5}/></span><span className="nav-label">Sign out</span></button></div></aside>
  <motion.main key={screen} initial={reducedMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reducedMotion?0:.22}}><header className="top"><div>{user.role==='ADMIN'?<nav className="page-breadcrumb" aria-label="Breadcrumb"><span>Administration</span><span>/</span><span>Accounts</span></nav>:<nav className="page-breadcrumb" aria-label="Breadcrumb"><button onClick={()=>go('projects')}>Projects</button><span>/</span><span>{currentProjectName}</span>{screen!=='projects'&&<><span>/</span><span>{screen==='task'?'Task detail':screen==='pending'?'Review':screen==='mine'?'My work':screen==='submissions'?'My submissions':screen}</span></>}</nav>}<h1>{screen==='task'?'Task detail':screen==='pending'?'Review':screen==='mine'?'My work':screen==='submissions'?'My submissions':screen[0]!.toUpperCase()+screen.slice(1)}</h1></div><div className="top-actions"><button data-testid="open-command-palette" className="search-trigger" onClick={()=>setCommandOpen(true)}><Search size={15} strokeWidth={1.5}/><span>Search workspace</span><kbd>{navigator.platform.toLowerCase().includes('mac')?'\u2318K':'Ctrl K'}</kbd></button><div className="notification-wrap"><button className="bell-button" aria-label={`Notifications, ${unread} unread`} onClick={()=>setBellOpen(!bellOpen)}><Bell size={18}/>{unread>0&&<span className="nav-count">{unread}</span>}</button>{bellOpen&&<div className="notification-popover"><div className="row"><strong>Notifications</strong><button onClick={()=>run(()=>post('/me/notifications/read-all',{}),'Notifications read')}>Mark all read</button></div>{notifications.data?.length?notifications.data.map(n=><button key={n.id} className={'notification-row'+(!n.read_at?' unread':'')} onClick={async()=>{await post(`/me/notifications/${n.id}/read`,{});await qc.invalidateQueries({queryKey:['notifications']});setBellOpen(false);if(n.task_id)showTask(n.task_id)}}><strong>{n.subject}</strong><small>{formatDate(n.sent_at)}</small></button>):<p>No notifications yet.</p>}</div>}</div><button data-testid="toggle-theme" className="theme-toggle" title={theme==='light'?'Switch to dark mode':'Switch to light mode'} aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={toggleTheme}>{theme==='light'?<Moon size={18} strokeWidth={1.5}/>:<Sun size={18} strokeWidth={1.5}/>}</button><span className="demo-badge">PILOT DEMO</span></div></header>
    {message&&<div className="notice success">{message}</div>}{error&&<div className="notice error">{error}</div>}
    {screen==='overview'&&user.role==='PM'&&<PMOverview user={user} projectId={projectId} onTask={showTask} onTasks={goFilteredTasks} onReview={()=>go('pending')}/>}
    {screen==='mine'&&<Overview user={user} projectId={projectId} onProject={setProjectId} onTask={showTask}/>}
    {screen==='projects'&&<PMProjects user={user} projectId={projectId} onProject={setProjectId} onTasks={()=>goFilteredTasks('')} run={run}/>}
    {screen==='tasks'&&(user.role==='PM'?<PMTasks user={user} projectId={projectId} onTask={showTask} run={run} initialFilter={taskFilter}/>:<WorkspaceTasks user={user} projectId={projectId} onProject={setProjectId} onTask={showTask} run={run}/>)}
    {screen==='task'&&taskId&&<WorkspaceTaskDetail user={user} taskId={taskId} onBack={()=>go('tasks')} onTask={showTask} run={run}/>}
    {screen==='submissions'&&<MySubmissions user={user} projectId={projectId} onTask={showTask}/>}
    {screen==='pending'&&user.role!=='MEMBER'&&(user.role==='PM'?<PMReview projectId={projectId} onTask={showTask} run={run}/>:<WorkspacePending onTask={showTask} run={run}/>)}
    {screen==='reports'&&user.role==='PM'&&<Reports user={user} projectId={projectId} onProject={setProjectId} onTask={showTask}/>}
    {screen==='settings'&&user.role==='PM'&&<PMSettings projectId={projectId} run={run}/>}
    {screen==='accounts'&&user.role==='ADMIN'&&<AdminAccounts user={user} run={run}/>}
  </motion.main><CommandPalette open={commandOpen} onClose={()=>setCommandOpen(false)} onNavigate={go} onTask={showTask} projectId={projectId} role={user.role}/></div>;
}
function Login({onLogin,theme,onThemeChange}:{onLogin:(u:User)=>void;theme:'light'|'dark';onThemeChange:(event:MouseEvent<HTMLButtonElement>)=>void}){
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [username,setUsername]=useState(''),[password,setPassword]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setLoading(true);setError('');try{onLogin(await post<User>('/auth/login',{username,password}));}catch(err){setError(err instanceof Error?err.message:'Login failed')}finally{setLoading(false)}}
  return <div className="login-wrap"><div className="login-panel">
    <div className="login-tools"><button data-testid="login-toggle-theme" className="theme-toggle" title={theme==='light'?'Switch to dark mode':'Switch to light mode'} aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={onThemeChange}>{theme==='light'?<Moon size={18} strokeWidth={1.5}/>:<Sun size={18} strokeWidth={1.5}/>}</button></div>
    <div className="brand dark"><span className="brand-icon">C</span><div><strong>CVRDE</strong><small>Work Management Demo</small></div></div>
    <span className="eyebrow">SECURE PROJECT WORKSPACE</span><h1>Welcome back</h1><p className="muted">Sign in to the engine component work management pilot.</p>
    <div className="demo-logins"><strong>Explore as a demo user</strong><p>Choose a role to fill the sign in form.</p><div className="demo-login-grid">{demoAccounts.map(account=><button data-testid={`demo-${account.username.replaceAll('.','-')}`} type="button" key={account.username} onClick={()=>{setUsername(account.username);setPassword(demoPassword)}}><span>{account.label}</span><small>{account.username}</small></button>)}</div><small>Shared demo password: <code>{demoPassword}</code></small></div>
    <form onSubmit={submit} className="stack"><label>Username<input data-testid="login-username" name="username" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label><label>Password<input data-testid="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className="notice error">{error}</div>}<button data-testid="login-submit" className="primary" disabled={loading}>{loading?'Signing in…':'Sign in'}</button></form>
    <p className="login-note">Fictional pilot data only</p>
  </div></div>;
}
function useProjects(){return useQuery({queryKey:['projects'],queryFn:()=>api<Project[]>('/projects')});}
function ProjectPicker({value,onChange}:{value:number|null;onChange:(id:number)=>void}){const q=useProjects();useEffect(()=>{if(q.data?.length&&!q.data.some(p=>p.id===value))onChange(q.data[0]!.id)},[q.data,value,onChange]);return <select value={value||''} onChange={e=>onChange(Number(e.target.value))}><option value="">Select project</option>{q.data?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
function TaskTable({tasks,onTask}:{tasks:Task[];onTask:(id:number)=>void}){return <WorkspaceTaskTable tasks={tasks} onTask={onTask}/>;}
function Overview({user,projectId,onProject,onTask}:{user:User;projectId:number|null;onProject:(id:number)=>void;onTask:(id:number)=>void}){
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!projectId});
  const dashboard=useQuery({queryKey:['dashboard',projectId],queryFn:()=>api<{total:number;overdue:number;completed:number;pending:number;by_status:Record<string,number>}>(`/projects/${projectId}/dashboard`),enabled:!!projectId&&user.role==='PM'});
  const pending=useQuery({queryKey:['pending'],queryFn:()=>api<Action[]>('/me/pending-actions')});
  const attention=(tasks.data||[]).filter(task=>task.status!=='DONE'&&task.due_date&&task.due_date.slice(0,10)<new Date().toISOString().slice(0,10)).slice(0,4);
  const upcoming=(tasks.data||[]).filter(task=>task.status!=='DONE'&&task.due_date).sort((a,b)=>a.due_date!.localeCompare(b.due_date!)).slice(0,4);
  return <><div className="stat-grid">
    {user.role==='PM'&&<><div className="stat"><span>Total tasks</span><strong>{dashboard.data?.total??'…'}</strong></div><div className="stat"><span>Done</span><strong>{dashboard.data?.completed??'…'}</strong></div><div className="stat"><span>Overdue</span><strong>{dashboard.data?.overdue??'…'}</strong></div></>}
    <div className="stat"><span>Pending my action</span><strong>{pending.data?.length??'…'}</strong></div>
  </div><div className="bento-grid">
    <Card title={user.role==='PM'?'Needs your decision':user.role==='REVIEWER'?'Review queue':'My actions'}>{pending.data?.length?pending.data.slice(0,4).map(action=><button className="bento-row" key={`${action.kind}-${action.id}`} onClick={()=>onTask(action.task_id)}><strong>{action.title}</strong><small>{action.kind.replaceAll('_',' ')}</small></button>):<Empty text="Nothing needs your action."/>}</Card>
    <Card title="Past due">{attention.length?attention.map(task=><button className="bento-row" key={task.id} onClick={()=>onTask(task.id)}><strong>{task.title}</strong><small><DateText value={task.due_date}/></small></button>):<Empty text="No overdue tasks."/>}</Card>
    <Card title="Upcoming deadlines">{upcoming.length?upcoming.map(task=><button className="bento-row" key={task.id} onClick={()=>onTask(task.id)}><strong>{task.title}</strong><small><DateText value={task.due_date}/></small></button>):<Empty text="No upcoming dates."/>}</Card>
  </div><Card title="Project tasks">{tasks.isLoading?<Empty text="Loading tasks…"/>:tasks.isError?<Empty text="Tasks could not be loaded."/>:<TaskTable tasks={tasks.data||[]} onTask={onTask}/>}</Card></>;
}
function Reports({user,projectId,onProject,onTask}:{user:User;projectId:number|null;onProject:(id:number)=>void;onTask:(id:number)=>void}){const [kind,setKind]=useState<'overdue'|'progress'>('overdue'),[status,setStatus]=useState(''),[owner,setOwner]=useState('');const members=useQuery({queryKey:['members',projectId],queryFn:()=>api<User[]>(`/projects/${projectId}/members`),enabled:!!projectId&&user.role==='PM'});const params=new URLSearchParams({project_id:String(projectId||'')});if(status)params.set('status',status);if(owner)params.set('owner_id',owner);const q=useQuery({queryKey:['report',kind,projectId,status,owner],queryFn:()=>api<Task[]>(`/reports/${kind}?${params}`),enabled:!!projectId&&user.role==='PM'});if(user.role!=='PM')return <Empty text="Reports are available to Project Managers."/>;return <><div className="toolbar"><select value={kind} onChange={e=>setKind(e.target.value as 'overdue'|'progress')}><option value="overdue">Overdue Tasks</option><option value="progress">Project Progress</option></select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['NOT_STARTED','IN_PROGRESS','SUBMITTED','RETURNED','DONE'].map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select><select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All owners</option>{members.data?.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select><a className="button" href={`/api/v1/reports/${kind}.csv?${params}`}>Export CSV</a></div><Card title={kind==='overdue'?'Overdue Tasks':'Project Progress'}><WorkspaceTaskTable tasks={q.data||[]} onTask={onTask}/></Card></>}
export default App;

function MySubmissions({user,projectId,onTask}:{user:User;projectId:number|null;onTask:(id:number)=>void}){const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:!!projectId});return <Card title="My submissions"><WorkspaceTaskTable tasks={(tasks.data||[]).filter(t=>t.owner_id===user.id&&['SUBMITTED','RETURNED','DONE'].includes(t.status))} onTask={onTask}/></Card>}

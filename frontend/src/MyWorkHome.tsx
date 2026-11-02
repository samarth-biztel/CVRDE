import {useQuery} from '@tanstack/react-query';
import {api,type Task} from './api';
import {HomeTaskTable,type HomeTask} from './HomeTaskTable';

type Run=(action:()=>Promise<unknown>,success?:string)=>void;
export function MyWorkHome({projectId,ownId,onTask,run}:{projectId:number|null;ownId:number;onTask:(id:number,section?:'evidence'|'submit'|'review')=>void;run:Run}){
  const work=useQuery({queryKey:['work',projectId],queryFn:()=>api<{tasks:HomeTask[]}>(`/me/work?project_id=${projectId}`),enabled:!!projectId});
  if(!projectId)return <section className="card"><p>Select a project to see your work.</p></section>;
  const tasks=(work.data?.tasks||[]).filter((task:Task)=>task.owner_id===ownId);
  const subProjects=new Set(tasks.map(task=>task.sub_project_id).filter(Boolean));
  return <section className="card home-tasks-card"><div className="home-section-head"><h2>Tasks</h2><span>{tasks.length} assigned</span></div>{work.isLoading?<p className="muted">Loading your tasks…</p>:<HomeTaskTable tasks={tasks} ownId={ownId} onTask={onTask} run={run} showSubProject={subProjects.size>1}/>}</section>;
}

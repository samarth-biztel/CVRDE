import {useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,post,patch,dateOnly,dueClass,dueLabel,type Task,type User} from './api';

export type Milestone={id:number;project_id:number;name:string;due_date:string;task_total:number;task_done:number};
type Run=(action:()=>Promise<unknown>,success?:string)=>void;
export function Milestones({projectId,projectDue,user,onTask,run}:{projectId:number;projectDue:string|null;user:User;onTask:(id:number)=>void;run:Run}){
  const list=useQuery({queryKey:['milestones',projectId],queryFn:()=>api<Milestone[]>(`/projects/${projectId}/milestones`)});
  const tasks=useQuery({queryKey:['tasks',projectId],queryFn:()=>api<Task[]>(`/projects/${projectId}/tasks`),enabled:user.role==='PM'});
  const [creating,setCreating]=useState(false);
  function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);run(async()=>{await post(`/projects/${projectId}/milestones`,{name:String(data.get('name')||'').trim(),due_date:String(data.get('due_date')||'')});form.reset();setCreating(false)},'Milestone created')}
  return <section className="milestones"><div className="sub-projects-heading"><h3>Milestones</h3>{user.role==='PM'&&<button onClick={()=>setCreating(value=>!value)}>New milestone</button>}</div>
    {creating&&user.role==='PM'&&<form className="inline-form" onSubmit={create}><label>Name<input name="name" required maxLength={200}/></label><label>Due date<input name="due_date" type="date" max={dateOnly(projectDue)||undefined} required/></label><button className="primary">Create milestone</button></form>}
    {list.data?.length?<div className="milestone-list">{list.data.map(item=>{const linked=(tasks.data||[]).filter(task=>task.milestone_id===item.id);return <div className="milestone-card" key={item.id}><div className="row"><strong>{item.name}</strong><span className={dueClass(item.due_date)}>{dueLabel(item.due_date)}</span></div><p>{item.task_done} of {item.task_total} linked tasks done</p><progress value={item.task_done} max={Math.max(item.task_total,1)}/>{user.role==='PM'&&<><div className="milestone-linked">{linked.map(task=><div className="row" key={task.id}><button onClick={()=>onTask(task.id)}>{task.title}</button><button onClick={()=>run(()=>patch(`/tasks/${task.id}/milestone`,{milestone_id:null}),'Task unlinked')}>Unlink</button></div>)}</div><label>Link a task<select aria-label={`Link a task to ${item.name}`} value="" onChange={event=>{const id=Number(event.target.value);if(id)run(()=>patch(`/tasks/${id}/milestone`,{milestone_id:item.id}),'Task linked')}}><option value="">Choose task</option>{tasks.data?.filter(task=>task.milestone_id!==item.id).map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label></>}</div>})}</div>:<p className="muted">No milestones yet. Add one to track formal progress.</p>}
  </section>;
}

import {useState} from 'react';
import {dateOnly,dueClass,dueTimingLabel,formatDate,post,statusLabel,type Task} from './api';

export type HomeTask=Task&{return_reason?:string|null};
type Run=(action:()=>Promise<unknown>,success?:string)=>void;
type Props={tasks:HomeTask[];ownId:number;onTask:(id:number,section?:'evidence'|'submit'|'review')=>void;run:Run;reviewFirst?:boolean;showOwner?:boolean;showSubProject?:boolean;ownerFilter?:boolean};
const day=(value:string|null|undefined)=>dateOnly(value)||'9999-12-31';
const today=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`};

export function HomeTaskTable({tasks,ownId,onTask,run,reviewFirst=false,showOwner=false,showSubProject=false,ownerFilter=false}:Props){
  const [showCompleted,setShowCompleted]=useState(false),[owner,setOwner]=useState('');
  const owners=[...new Map(tasks.map(task=>[task.owner_id,task.owner_name||'Unassigned'])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const current=today();
  const rank=(task:HomeTask)=>reviewFirst&&task.status==='SUBMITTED'&&task.owner_id!==ownId?0:task.status==='RETURNED'?1:task.status!=='DONE'&&task.status!=='SUBMITTED'&&day(task.due_date)<current?2:task.status==='IN_PROGRESS'?3:task.status==='NOT_STARTED'?4:task.status==='SUBMITTED'?5:6;
  const ordered=tasks.filter(task=>!owner||task.owner_id===Number(owner)).sort((a,b)=>rank(a)-rank(b)||(a.status==='DONE'&&b.status==='DONE'?String(b.completed_at||b.updated_at||'').localeCompare(String(a.completed_at||a.updated_at||'')):day(a.due_date).localeCompare(day(b.due_date)))||a.id-b.id);
  const completed=ordered.filter(task=>task.status==='DONE'),shown=ordered.filter(task=>task.status!=='DONE'||showCompleted||completed.indexOf(task)<3);
  const action=(task:HomeTask)=>{
    if(reviewFirst&&task.status==='SUBMITTED'&&task.owner_id!==ownId)return <button className="primary" onClick={()=>onTask(task.id,'review')}>Review</button>;
    if(task.owner_id!==ownId)return null;
    if(task.status==='NOT_STARTED')return <button className="primary" onClick={()=>run(()=>post(`/tasks/${task.id}/status`,{}),'Task started')}>Start</button>;
    if(task.status==='IN_PROGRESS')return task.available_file_count?<button className="primary" onClick={()=>onTask(task.id,'submit')}>Submit for review</button>:<button onClick={()=>onTask(task.id,'evidence')}>Add evidence</button>;
    if(task.status==='RETURNED')return <button className="primary" onClick={()=>onTask(task.id)}>Fix and resubmit</button>;
    return null;
  };
  return <div className="home-task-table-wrap">
    {ownerFilter&&owners.length>1&&<div className="home-task-filter"><label htmlFor="home-owner-filter">Owner</label><select id="home-owner-filter" value={owner} onChange={event=>setOwner(event.target.value)}><option value="">All owners</option>{owners.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div>}
    {shown.length?<div className="table-wrap"><table className="home-task-table"><thead><tr><th>Task</th>{showOwner&&<th>Owner</th>}{showSubProject&&<th>Sub-project</th>}<th>Status</th><th>Due date</th><th>Timing</th><th>Action</th></tr></thead><tbody>{shown.map(task=><tr key={task.id} className={task.status==='RETURNED'?'home-row-returned':''}><td><button className="home-task-name" onClick={()=>onTask(task.id)}>{task.title}</button>{task.status==='RETURNED'&&task.return_reason&&<small className="home-return-reason">{task.return_reason}</small>}</td>{showOwner&&<td>{task.owner_name||'Unassigned'}</td>}{showSubProject&&<td>{task.sub_project_name||'Project task'}</td>}<td><span className={`pill ${task.status.toLowerCase()}`}>{statusLabel(task.status)}</span></td><td>{task.status==='DONE'?`Completed ${formatDate(task.completed_at||task.updated_at)}`:formatDate(task.due_date)}</td><td className={task.status==='DONE'?'':dueClass(task.due_date)}>{task.status==='DONE'?'—':dueTimingLabel(task.due_date)}</td><td>{action(task)}</td></tr>)}</tbody></table></div>:<p className="muted">No tasks are assigned here yet.</p>}
    {completed.length>3&&<button className="home-show-completed" onClick={()=>setShowCompleted(!showCompleted)}>{showCompleted?'Show fewer completed':`Show completed (${completed.length-3} more)`}</button>}
  </div>;
}

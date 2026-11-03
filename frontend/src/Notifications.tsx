import {useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {api,formatDateTime,post} from './api';

export type Notification={
  id:number;event_type:string;category:string;task_id:number|null;project_id:number|null;
  meeting_id:number|null;meeting_title:string|null;task_title:string;sub_project_name:string|null;
  subject:string;body:string|null;actor_name:string|null;sent_at:string;read_at:string|null;
};
export type NotificationCounts={total:number;unread:number};

function eventText(item:Notification){
  const actor=item.actor_name||'A team member';
  const detail=item.body?.trim();
  if(!item.actor_name)return `${item.subject}${detail?`: ${detail}`:''}`;
  switch(item.category){
    case 'Assigned':return `${actor} assigned ${item.task_title} to you`;
    case 'Submitted':return `${actor} submitted ${item.task_title}${detail?`: ${detail}`:''}`;
    case 'Returned':return `${actor} returned ${item.task_title}${detail?`: ${detail}`:''}`;
    case 'Signed off':return `${actor} signed off ${item.task_title}${detail&&detail!=='ACCEPTED'?`: ${detail}`:''}`;
    case 'Commented':return `${actor} commented on ${item.task_title}${detail?`: ${detail}`:''}`;
    case 'Action item':return `${actor} assigned you an action item: ${item.task_title}`;
    default:return `${item.subject}${detail?` · ${detail}`:''}`;
  }
}

export function NotificationRow({item,onOpen,compact=false}:{item:Notification;onOpen:(item:Notification)=>void;compact?:boolean}){
  return <button type="button" className={`notification-history-row${item.read_at?'':' unread'}${compact?' compact':''}`} onClick={()=>onOpen(item)}>
    <span className="notification-history-dot" aria-hidden="true"/>
    <span className="notification-history-main"><strong>{eventText(item)}</strong><span className="notification-target">{item.meeting_title||item.task_title}</span><span className="notification-history-meta">{item.sub_project_name&&<span>{item.sub_project_name}</span>}<time dateTime={item.sent_at}>{formatDateTime(item.sent_at)}</time></span></span>
  </button>;
}

export function NotificationCenter({userId,counts,onOpen,onMarkAll}:{userId:number;counts:NotificationCounts|undefined;onOpen:(item:Notification)=>void;onMarkAll:()=>Promise<void>}){
  const [unreadOnly,setUnreadOnly]=useState(false);
  const [category,setCategory]=useState('');
  const [marking,setMarking]=useState(false);
  const list=useInfiniteQuery({
    queryKey:['notification-history',userId,unreadOnly,category],
    initialPageParam:0,
    enabled:!unreadOnly||counts===undefined||counts.unread>0,
    queryFn:({pageParam})=>api<Notification[]>(`/me/notifications?limit=51&offset=${pageParam}${unreadOnly?'&unread=1':''}${category?`&type=${encodeURIComponent(category)}`:''}`),
    getNextPageParam:(last,pages)=>last.length>50?pages.length*50:undefined
  });
  const items=list.data?.pages.flatMap(page=>page.slice(0,50))||[];
  return <section className="card notification-centre" data-testid="notification-centre">
    <div className="notification-centre-head"><div><h2>Notification history</h2><p>Updates on your tasks and meetings, newest first.</p></div>{!!counts?.unread&&<button type="button" disabled={marking} onClick={async()=>{setMarking(true);try{await onMarkAll()}finally{setMarking(false)}}}>{marking?'Marking…':'Mark all as read'}</button>}</div>
    <div className="notification-filters"><div className="notification-view-tabs" role="group" aria-label="Notification view"><button type="button" aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>All</button><button type="button" aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>Unread{counts?.unread?` (${counts.unread})`:''}</button></div><label>Event type<select value={category} onChange={event=>setCategory(event.target.value)}><option value="">All event types</option>{['Assigned','Submitted','Returned','Signed off','Commented','Action item'].map(type=><option key={type} value={type}>{type}</option>)}</select></label></div>
    {unreadOnly&&counts?.unread===0?<p className="notification-empty">{counts.total===0?'No notifications yet':'No notifications match this view.'}</p>:list.isPending?<p className="notification-empty">Loading notifications…</p>:list.isError?<p className="notification-empty">Could not load notifications. <button onClick={()=>void list.refetch()}>Try again</button></p>:items.length?<div className="notification-history-list">{items.map(item=><NotificationRow key={item.id} item={item} onOpen={onOpen}/>)}</div>:<p className="notification-empty">{counts?.total===0?'No notifications yet':'No notifications match this view.'}</p>}
    {!(unreadOnly&&counts?.unread===0)&&list.hasNextPage&&<div className="notification-load-more"><button type="button" onClick={()=>void list.fetchNextPage()} disabled={list.isFetchingNextPage}>{list.isFetchingNextPage?'Loading…':'Load more'}</button></div>}
  </section>;
}

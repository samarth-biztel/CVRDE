export type User={id:number;username:string;full_name:string;email?:string;active?:boolean;role:'ADMIN'|'PM'|'MEMBER'|'REVIEWER'};
export type Project={id:number;name:string;description:string;target_date:string|null;manager_id:number;manager_name?:string;task_total?:number;task_done?:number;at_risk?:boolean};
export type Task={id:number;project_id:number;sub_project_id:number|null;sub_project_owner_id?:number|null;sub_project_name?:string|null;title:string;description:string;expected_deliverables?:string;owner_id:number;owner_name?:string;assigned_by_name?:string;project_name?:string;created_by?:number;priority:string;due_date:string|null;updated_at?:string;status:string;visibility:string;group_id:number|null;parent_task_id:number|null;plm_ref:string|null;progress_percent?:number;subtask_count?:{total:number;done:number};limited?:boolean};
export type Group={id:number;name:string;description:string;can_view_results:boolean;can_comment:boolean;can_link_pendency:boolean;member_ids:number[]};
export type Action={id:number;task_id:number;project_id:number;title:string;kind:string;requested_at:string;submitted_by:string;summary?:string;due_date?:string|null;new_due_date?:string|null;new_owner_name?:string;files?:{id:number;name:string}[];reason?:string;work_from?:string|null;work_until?:string|null};
export type Result={id:number;task_id:number;version_no:number;work_completed:string;outcome:string;review_status:string;review_comment:string|null;attachment_names?:string[]};
export type Attachment={id:number;document_key:string;version_no:number;original_name:string;uploaded_at:string;result_id?:number|null};
export type Pendency={id:number;blocked_task_id:number;responsible_user_id:number;status:string;description:string;type:string;raised_by:number;approver_id:number;depends_on_task_id?:number;depends_on_title?:string;depends_on_status?:string;blocked?:boolean};
export async function api<T=unknown>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch('/api/v1'+path,{credentials:'include',...options,headers:options.body instanceof FormData?options.headers:{'Content-Type':'application/json',...options.headers}});
  if(!response.ok){const body=await response.json().catch(()=>({error:response.statusText}));throw new Error(body.error||response.statusText);}
  if(response.status===204)return undefined as T;
  return response.json() as Promise<T>;
}
export const post=<T=unknown>(path:string,data:unknown)=>api<T>(path,{method:'POST',body:JSON.stringify(data)});
export const patch=<T=unknown>(path:string,data:unknown)=>api<T>(path,{method:'PATCH',body:JSON.stringify(data)});
export const del=<T=unknown>(path:string)=>api<T>(path,{method:'DELETE'});
export const dateOnly=(value:string|null|undefined)=>value?value.slice(0,10):'';
export const statusLabel=(value:string)=>({NOT_STARTED:'Not started',IN_PROGRESS:'In progress',SUBMITTED:'Submitted',RETURNED:'Returned',DONE:'Done'} as Record<string,string>)[value]||value.replaceAll('_',' ').toLowerCase();
export const formatDate=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(dateOnly(value)+'T00:00:00Z')):'Not set';
export function dueLabel(value:string|null|undefined){if(!value)return 'Not set';const today=new Date();const local=new Date(today.getFullYear(),today.getMonth(),today.getDate());const due=new Date(dateOnly(value)+'T00:00:00');const days=Math.round((due.getTime()-local.getTime())/86400000);return `${formatDate(value)} · ${days===0?'Today':days>0?`in ${days} day${days===1?'':'s'}`:`${-days} day${days===-1?'':'s'} overdue`}`}
export function dueClass(value:string|null|undefined){if(!value)return '';const today=new Date();const key=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');return dateOnly(value)<key?'due-overdue':dateOnly(value)===key?'due-today':''}

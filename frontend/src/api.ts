export type User={id:number;username:string;full_name:string;role:'PM'|'MEMBER'|'REVIEWER'};
export type Project={id:number;name:string;description:string;target_date:string|null;manager_id:number};
export type Task={id:number;project_id:number;title:string;description:string;owner_id:number;owner_name?:string;priority:string;due_date:string|null;status:string;visibility:string;group_id:number|null;parent_task_id:number|null;plm_ref:string|null;limited?:boolean};
export type Group={id:number;name:string;description:string;can_view_results:boolean;can_comment:boolean;can_link_pendency:boolean;member_ids:number[]};
export type Action={id:number;task_id:number;title:string;kind:string};
export type Result={id:number;task_id:number;version_no:number;work_completed:string;outcome:string;review_status:string;review_comment:string|null};
export type Attachment={id:number;document_key:string;version_no:number;original_name:string;uploaded_at:string};
export type Pendency={id:number;blocked_task_id:number;responsible_user_id:number;status:string;description:string;type:string;raised_by:number;approver_id:number};
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

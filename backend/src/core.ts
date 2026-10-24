import type { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { db, one, query, type Executor } from './db.js';
import nodemailer from 'nodemailer';

export type User = { id: number; username: string; full_name: string; email: string; role: 'PM' | 'MEMBER' | 'REVIEWER' };
export type Task = { id: number; project_id: number; parent_task_id: number | null; owner_id: number; manager_id: number; group_id: number | null; visibility: string; status: string; title: string; description: string; priority: string; due_date: string | null; plm_ref: string | null };
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export const assert = (value: unknown, status: number, message: string): asserts value => { if (!value) throw new HttpError(status, message); };
export const uid = (value: unknown) => { const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, 'Invalid ID'); return n; };
export const currentUser = (res: Response): User => res.locals.user as User;
export const handler = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res)).catch(next);

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.cvrde_session;
    if (typeof token !== 'string') throw new HttpError(401, 'Login required');
    const hash = createHash('sha256').update(token).digest('hex');
    const user = await one<User>(db, `SELECT u.id,u.username,u.full_name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`, [hash]);
    if (!user) throw new HttpError(401, 'Session expired');
    res.locals.user = user;
    next();
  } catch (error) { next(error); }
}
export function role(user: User, allowed: User['role'][]): void { if (!allowed.includes(user.role)) throw new HttpError(403, 'Forbidden'); }
export async function issueSession(res: Response, userId: number) {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  await query(db, 'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval \'12 hours\')', [hash,userId]);
  res.cookie('cvrde_session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true' || (Boolean(process.env.VERCEL) && process.env.COOKIE_SECURE !== 'false'), maxAge: 12 * 3600 * 1000, path: '/' });
}
export async function getProject(projectId: number) {
  const project = await one<{ id:number; manager_id:number; name:string }>(db,'SELECT id,manager_id,name FROM projects WHERE id=$1',[projectId]);
  if (!project) throw new HttpError(404,'Project not found');
  return project;
}
export async function projectMember(user: User, projectId: number) {
  const p = await getProject(projectId);
  if (p.manager_id === user.id) return p;
  const member = await one(db,'SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2',[projectId,user.id]);
  if (!member) throw new HttpError(404,'Project not found');
  return p;
}
export async function projectManager(user: User, projectId: number) {
  const p = await getProject(projectId);
  if (p.manager_id !== user.id || user.role !== 'PM') throw new HttpError(404,'Project not found');
  return p;
}
export async function taskById(id: number): Promise<Task> {
  const task = await one<Task>(db,'SELECT t.*,p.manager_id FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=$1',[id]);
  if (!task) throw new HttpError(404,'Task not found');
  return task;
}
export type Action = 'VIEW' | 'EDIT' | 'RESULTS' | 'COMMENT' | 'LINK';
export async function taskAccess(user: User, task: Task, action: Action): Promise<'FULL' | 'LIMITED'> {
  if (user.id === task.manager_id || user.id === task.owner_id) return 'FULL';
  if (task.visibility === 'GROUP' && task.group_id) {
    const permission = await one<{ can_view_results:boolean; can_comment:boolean; can_link_pendency:boolean }>(db,
      'SELECT g.can_view_results,g.can_comment,g.can_link_pendency FROM project_groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=$1 AND gm.user_id=$2',[task.group_id,user.id]);
    if (permission) {
      if (action === 'EDIT') throw new HttpError(403,'Task is read only');
      if (action === 'RESULTS' && !permission.can_view_results) throw new HttpError(403,'Results access denied');
      if (action === 'COMMENT' && !permission.can_comment) throw new HttpError(403,'Comment access denied');
      if (action === 'LINK' && !permission.can_link_pendency) throw new HttpError(403,'Pendency linking denied');
      return 'FULL';
    }
  }
  if (action === 'VIEW') {
    const linked = await one(db,`SELECT 1 FROM pendencies p LEFT JOIN pendency_dependencies d ON d.pendency_id=p.id WHERE (p.blocked_task_id=$1 OR d.depends_on_task_id=$1) AND (p.responsible_user_id=$2 OR p.approver_id=$2) LIMIT 1`,[task.id,user.id]);
    if (linked) return 'LIMITED';
    const reviewer = await one(db,`SELECT 1 FROM reassignments WHERE task_id=$1 AND reviewer_id=$2 AND status='PENDING'`,[task.id,user.id]);
    if (reviewer) return 'LIMITED';
    const parent = await one(db,'SELECT 1 FROM tasks WHERE parent_task_id=$1 AND owner_id=$2 LIMIT 1',[task.id,user.id]);
    if (parent) return 'LIMITED';
  }
  throw new HttpError(404,'Task not found');
}
export async function visibleTaskIds(user: User, projectId: number): Promise<number[]> {
  const records = await query<{ id:number }>(db,`SELECT t.id FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.project_id=$1 AND (p.manager_id=$2 OR t.owner_id=$2 OR (t.visibility='GROUP' AND EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=t.group_id AND gm.user_id=$2))) ORDER BY t.id`,[projectId,user.id]);
  return records.map(x=>Number(x.id));
}
export async function history(executor: Executor, projectId:number, taskId:number|null, eventType:string, actorId:number, details:unknown) {
  await query(executor,'INSERT INTO task_history(project_id,task_id,event_type,actor_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[projectId,taskId,eventType,actorId,JSON.stringify(details)]);
}
export async function notify(eventType:string, toUserId:number, taskId:number|null, subject:string, body:string) {
  try {
    const recipient = await one<{email:string}>(db,'SELECT email FROM users WHERE id=$1',[toUserId]);
    if (!recipient) return;
    let delivery = 'SKIPPED', error: string | null = null;
    if (process.env.SMTP_HOST) {
      try {
        const transport = nodemailer.createTransport({ host:process.env.SMTP_HOST, port:Number(process.env.SMTP_PORT || 587), secure:Number(process.env.SMTP_PORT)===465,
          auth:process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD} : undefined });
        await transport.sendMail({from:process.env.SMTP_FROM || 'CVRDE Demo <no-reply@example.invalid>',to:recipient.email,subject,text:body});
        delivery = 'SENT';
      } catch { delivery='FAILED'; error='Email delivery failed; check SMTP configuration'; }
    }
    await query(db,'INSERT INTO notification_log(event_type,to_user_id,task_id,subject,delivery_status,error) VALUES($1,$2,$3,$4,$5,$6)',[eventType,toUserId,taskId,subject,delivery,error]);
  } catch {
    // Notification failures must not change the outcome of committed task work.
  }
}

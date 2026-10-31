import nodemailer from 'nodemailer';

export type MailContext={eventType:string;projectName:string;taskTitle:string;taskId:number;recipientEmail:string;actorName:string;detail:string;meetingTitle:string|null};
type EventCopy={label:string;headline:string;intro:string;icon:string;action:string;detailLabel?:string};

const events:Record<string,EventCopy>={
  ASSIGNED:{label:'Assigned',headline:'A task has been assigned to you',intro:'A new task is ready for your attention.',icon:'📌',action:'View task'},
  SUBMITTED:{label:'Submitted for review',headline:'A result is ready for review',intro:'The task owner has submitted work for your decision.',icon:'📤',action:'Review submission'},
  RETURNED:{label:'Returned',headline:'Your submission needs changes',intro:'The reviewer has returned this work for revision.',icon:'↩',action:'View feedback',detailLabel:'Reviewer’s reason'},
  ACCEPTED:{label:'Signed off',headline:'Your result has been signed off',intro:'The reviewer has accepted the submitted work.',icon:'✅',action:'View outcome',detailLabel:'Review note'},
  DUE_CHANGED:{label:'Due date changed',headline:'The due date has changed',intro:'The task schedule has been updated.',icon:'📅',action:'View task',detailLabel:'Date change'},
  OWNER_CHANGED:{label:'Owner changed',headline:'The task owner has changed',intro:'The task assignment has been updated.',icon:'🔄',action:'View task',detailLabel:'Assignment change'}
};
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
export function emailEnabled(eventType:string){return Object.hasOwn(events,eventType)}

export function mailContent(context:MailContext){
  const meetingAction=context.eventType==='ASSIGNED'&&!!context.meetingTitle;
  const event:EventCopy=meetingAction?{...events.ASSIGNED,label:'Meeting action assigned',headline:'You have a new meeting action',intro:'An action from the review meeting has been assigned to you.',action:'View action item'}:events[context.eventType]||{label:context.eventType,headline:'Task update',intro:'This task has been updated.',icon:'📌',action:'View task'};
  const base=(process.env.PUBLIC_APP_URL||(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'')||process.env.APP_ORIGIN||'http://localhost:5173').replace(/\/$/,'');
  const taskUrl=`${base}/?task=${context.taskId}`;
  const when=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date())+' IST';
  const detail=event.detailLabel?context.detail.trim().slice(0,500):'';
  const subject=`[${context.projectName}] ${event.label}: ${context.taskTitle}`;
  const text=[event.headline,'',event.intro,'',`Task: ${context.taskTitle}`,
    ...(context.meetingTitle?[`Meeting: ${context.meetingTitle}`]:[]),
    ...(detail?['',`${event.detailLabel}: ${detail}`]:[]),
    '',`Project: ${context.projectName}`,`Updated by: ${context.actorName}`,`When: ${when}`,
    '',`Open task: ${taskUrl}`].join('\n');

  const s={headline:escapeHtml(event.headline),intro:escapeHtml(event.intro),label:escapeHtml(event.label),icon:escapeHtml(event.icon),task:escapeHtml(context.taskTitle),project:escapeHtml(context.projectName),actor:escapeHtml(context.actorName),when:escapeHtml(when),url:escapeHtml(taskUrl),action:escapeHtml(event.action)};
  const meeting=context.meetingTitle?`<tr><td style="padding:0 0 18px;color:#526174;font-size:14px;line-height:21px">From the meeting: <strong style="color:#17263c">${escapeHtml(context.meetingTitle)}</strong></td></tr>`:'';
  const detailPanel=detail?`<tr><td style="padding:0 0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;border-left:3px solid #3856a6;border-radius:6px"><tr><td style="padding:16px 18px"><div style="color:#59677a;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:7px">${escapeHtml(event.detailLabel!)}</div><div style="color:#17263c;font-size:14px;line-height:22px;white-space:pre-line">${escapeHtml(detail)}</div></td></tr></table></td></tr>`:'';
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s.headline}</title></head><body style="margin:0;padding:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#17263c"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fa"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e4eaf1;border-radius:10px"><tr><td style="padding:26px 32px 18px;border-bottom:1px solid #e9edf3"><span style="color:#183153;font-size:16px;font-weight:700;letter-spacing:.02em">CVRDE</span><span style="color:#8190a3;font-size:12px;margin-left:10px">WORK MANAGEMENT</span></td></tr><tr><td style="padding:30px 32px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 0 15px;color:#3856a6;font-size:12px;font-weight:700">${s.icon} &nbsp;${s.label}</td></tr><tr><td style="padding:0 0 10px;font-size:23px;line-height:30px;font-weight:700">${s.headline}</td></tr><tr><td style="padding:0 0 24px;color:#526174;font-size:14px;line-height:22px">${s.intro}</td></tr><tr><td style="padding:0 0 8px;color:#7a8798;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase">Task</td></tr><tr><td style="padding:0 0 18px;font-size:18px;line-height:25px;font-weight:700">${s.task}</td></tr>${meeting}${detailPanel}<tr><td style="padding:0 0 23px;border-top:1px solid #e9edf3"><table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:17px;color:#526174;font-size:13px;line-height:22px"><tr><td style="padding-right:20px">Project</td><td style="color:#17263c">${s.project}</td></tr><tr><td style="padding-right:20px">Updated by</td><td style="color:#17263c">${s.actor}</td></tr><tr><td style="padding-right:20px">When</td><td style="color:#17263c">${s.when}</td></tr></table></td></tr><tr><td><a href="${s.url}" style="display:inline-block;background:#263f83;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:6px">${s.action} →</a></td></tr></table></td></tr></table><div style="max-width:600px;padding:16px 4px;color:#8190a3;font-size:11px;line-height:17px;text-align:center">Automated update from the fictional CVRDE work management demo.</div></td></tr></table></body></html>`;
  return {to:process.env.EMAIL_REDIRECT_TO||context.recipientEmail,subject,text,html};
}

export async function sendNotificationEmail(context:MailContext){
  const provider=process.env.EMAIL_PROVIDER||(process.env.RESEND_API_KEY?'resend':'smtp');
  if(provider==='resend'){
    if(!process.env.RESEND_API_KEY)throw new Error('RESEND_API_KEY is not configured');
    if(!process.env.RESEND_FROM)throw new Error('RESEND_FROM is not configured');
    const content=mailContent(context);
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[content.to],subject:content.subject,text:content.text,html:content.html}),signal:AbortSignal.timeout(8000)});
    if(!response.ok){const failure=await response.json().catch(()=>({message:response.statusText})) as {message?:string};throw new Error(`Resend delivery failed (${response.status}): ${(failure.message||response.statusText).slice(0,160)}`)}
    return;
  }
  if(provider!=='smtp')throw new Error(`Unknown email provider: ${provider}`);
  if(!process.env.SMTP_HOST)throw new Error('SMTP_HOST is not configured');
  const port=Number(process.env.SMTP_PORT||587);
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,connectionTimeout:3000,greetingTimeout:3000,socketTimeout:5000,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
  await transport.sendMail({from:process.env.SMTP_FROM||'CVRDE Demo <no-reply@example.invalid>',...mailContent(context)});
}

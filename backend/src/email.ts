import nodemailer from 'nodemailer';

export type MailContext={eventType:string;projectName:string;taskTitle:string;taskId:number;recipientEmail:string;actorName:string;detail:string;meetingTitle:string|null};
const events:Record<string,string>={ASSIGNED:'Assigned',SUBMITTED:'Submitted for review',RETURNED:'Returned',ACCEPTED:'Signed off',DUE_CHANGED:'Due date changed',OWNER_CHANGED:'Owner changed'};
export function emailEnabled(eventType:string){return Object.hasOwn(events,eventType)}
export function mailContent(context:MailContext){
  const label=context.eventType==='ASSIGNED'&&context.meetingTitle?'Meeting action assigned':events[context.eventType]||context.eventType;
  const base=(process.env.PUBLIC_APP_URL||process.env.APP_ORIGIN||(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:'http://localhost:5173')).replace(/\/$/,'');
  const when=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date());
  const lines=[`${label}: ${context.taskTitle}`,`Project: ${context.projectName}`,`By: ${context.actorName}`,`When: ${when}`];
  if(context.meetingTitle)lines.push(`Meeting: ${context.meetingTitle}`);
  if(context.detail&&['RETURNED','ACCEPTED','DUE_CHANGED','OWNER_CHANGED'].includes(context.eventType))lines.push(`${context.eventType==='RETURNED'?'Reason':'Details'}: ${context.detail.slice(0,500)}`);
  lines.push(`Open task: ${base}/?task=${context.taskId}`);
  return {to:process.env.EMAIL_REDIRECT_TO||context.recipientEmail,subject:`[${context.projectName}] ${label}: ${context.taskTitle}`,text:lines.join('\n')};
}
export async function sendNotificationEmail(context:MailContext){
  const provider=process.env.EMAIL_PROVIDER||(process.env.RESEND_API_KEY?'resend':'smtp');
  if(provider==='resend'){
    if(!process.env.RESEND_API_KEY)throw new Error('RESEND_API_KEY is not configured');
    if(!process.env.RESEND_FROM)throw new Error('RESEND_FROM is not configured');
    const content=mailContent(context);
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM,to:[content.to],subject:content.subject,text:content.text}),signal:AbortSignal.timeout(8000)});
    if(!response.ok){const failure=await response.json().catch(()=>({message:response.statusText})) as {message?:string};throw new Error(`Resend delivery failed (${response.status}): ${(failure.message||response.statusText).slice(0,160)}`)}
    return;
  }
  if(provider!=='smtp')throw new Error(`Unknown email provider: ${provider}`);
  if(!process.env.SMTP_HOST)throw new Error('SMTP_HOST is not configured');
  const port=Number(process.env.SMTP_PORT||587);
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:port===465,connectionTimeout:3000,greetingTimeout:3000,socketTimeout:5000,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
  await transport.sendMail({from:process.env.SMTP_FROM||'CVRDE Demo <no-reply@example.invalid>',...mailContent(context)});
}

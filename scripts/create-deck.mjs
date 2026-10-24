import pptxgen from 'pptxgenjs';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';

const pptx=new pptxgen();pptx.layout='LAYOUT_WIDE';pptx.author='BiztelAI';pptx.subject='CVRDE work management pilot';pptx.title='CVRDE Work Management Demo';pptx.lang='en-IN';
pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-IN'};
const C={ink:'14353E',teal:'087E73',pale:'EAF4F2',gray:'607984',line:'DCE8E8',white:'FFFFFF'};
const root=process.cwd(),screens=join(root,'docs','screenshots');
function slide(title,subtitle,image,points){
  const s=pptx.addSlide();s.background={color:'F6F9F9'};
  s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.16,line:{color:C.teal},fill:{color:C.teal}});
  s.addText(title,{x:.48,y:.34,w:12.1,h:.42,fontFace:'Aptos Display',fontSize:25,bold:true,color:C.ink,margin:0});
  s.addText(subtitle,{x:.5,y:.83,w:12,h:.32,fontSize:10.5,color:C.gray,margin:0});
  s.addShape(pptx.ShapeType.roundRect,{x:.4,y:1.36,w:8.55,h:5.48,rectRadius:.1,line:{color:C.line,width:1},fill:{color:C.white}});
  s.addImage({path:join(screens,image+'.png'),x:.45,y:1.41,w:8.45,h:5.38});
  s.addShape(pptx.ShapeType.roundRect,{x:9.23,y:1.36,w:3.68,h:5.48,rectRadius:.1,line:{color:C.line,width:1},fill:{color:C.white}});
  s.addText('What this shows',{x:9.5,y:1.68,w:3.1,h:.35,fontSize:15,bold:true,color:C.ink,margin:0});
  let y=2.25;for(const point of points){s.addShape(pptx.ShapeType.ellipse,{x:9.51,y:y+.06,w:.1,h:.1,line:{color:C.teal},fill:{color:C.teal}});s.addText(point,{x:9.75,y,w:2.85,h:.83,fontSize:12,color:C.ink,breakLine:false,margin:0,fit:'shrink'});y+=1.1;}
  s.addText('FICTIONAL DATA · PILOT DEMO',{x:.5,y:7.16,w:4.5,h:.2,fontSize:8,bold:true,charSpacing:1,color:C.teal,margin:0});
  s.addText(String(pptx._slides.length).padStart(2,'0'),{x:12.2,y:7.12,w:.6,h:.25,align:'right',fontSize:9,color:C.gray,margin:0});
}
slide('CVRDE Work Management Demo','Pilot workflow beneath the Project Manager level','01-login',[
  'A focused demonstration using fictional accounts and data.',
  'Four accounts cover PM, scientist, and reviewer views.',
  'Apex and Windchill integration remain outside this pilot.'
]);
slide('Live project overview','Project Manager view','02-pm-overview',[
  'Dashboard totals come from the current database.',
  'Tasks show owner, status, priority, due date, and overdue work.',
  'One reset restores a predictable demonstration picture.'
]);
slide('Project planning and groups','Project Manager view','03-projects-and-groups',[
  'Create projects, parent tasks, and assigned work.',
  'Project groups control sharing and three fixed permissions.',
  'Members can belong to more than one group.'
]);
slide('Scientist task view','Member view','07-member-tasks',[
  'Members see their own tasks and tasks shared with their groups.',
  'Private tasks stay hidden from other members.',
  'Owners update progress and submit work.'
]);
slide('Results, review, and history','Task detail','04-task-detail',[
  'The PM can return or accept a submitted result.',
  'Earlier result and attachment versions remain available.',
  'The timeline records task events and supports CSV export.'
]);
slide('Approvals awaiting action','PM and reviewer queues','05-pending-actions',[
  'The PM sees result reviews and extension requests together.',
  'Reassignments use a separate reviewer approval step.',
  'Decisions update task history and leave the queue.'
]);
slide('Reviewer decision','Reviewer view','08-reviewer-actions',[
  'A live reassignment request appears for the reviewer.',
  'Approval changes ownership; rejection keeps it unchanged.',
  'Old and new owners receive a notification when SMTP is configured.'
]);
slide('Reports and deployment readiness','Project Manager report','06-reports',[
  'Overdue Tasks and Project Progress support filters and CSV.',
  'Local browser and API workflows have been verified.',
  'Cloud VM, Neon, HTTPS, and email delivery need deployment settings.'
]);
const output=join(root,'docs','CVRDE_Demo_Presentation.pptx');await mkdir(join(root,'docs'),{recursive:true});await pptx.writeFile({fileName:output});console.log(output);

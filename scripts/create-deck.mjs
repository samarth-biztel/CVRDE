import pptxgen from 'pptxgenjs';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';

const pptx=new pptxgen();
pptx.layout='LAYOUT_WIDE';
pptx.author='samarth-biztel';
pptx.subject='CVRDE fictional pilot demonstration';
pptx.title='CVRDE Work Management Demo';
pptx.lang='en-IN';
pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-IN'};
const C={ink:'0A0A0A',accent:'4338CA',gray:'52525B',line:'E4E4E7',white:'FFFFFF'};
const root=process.cwd(),screens=join(root,'docs','screenshots');

function slide(title,eyebrow,image,points){
  const s=pptx.addSlide();s.background={color:'FAFAFA'};
  s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.12,h:7.5,line:{color:C.accent},fill:{color:C.accent}});
  s.addText(eyebrow.toUpperCase(),{x:.45,y:.3,w:10,h:.2,fontSize:8,bold:true,charSpacing:1.8,color:C.accent,margin:0});
  s.addText(title,{x:.45,y:.58,w:12.1,h:.5,fontFace:'Aptos Display',fontSize:28,bold:true,color:C.ink,margin:0});
  s.addShape(pptx.ShapeType.rect,{x:.4,y:1.32,w:8.55,h:5.5,line:{color:C.line,width:1},fill:{color:C.white}});
  s.addImage({path:join(screens,image+'.png'),x:.44,y:1.36,w:8.47,h:5.42});
  s.addShape(pptx.ShapeType.rect,{x:9.23,y:1.32,w:3.68,h:5.5,line:{color:C.line,width:1},fill:{color:C.white}});
  s.addText('IN THIS VIEW',{x:9.5,y:1.69,w:3.1,h:.23,fontSize:9,bold:true,charSpacing:1.6,color:C.accent,margin:0});
  let y=2.2;for(const point of points){
    s.addShape(pptx.ShapeType.rect,{x:9.51,y:y+.06,w:.08,h:.08,line:{color:C.accent},fill:{color:C.accent}});
    s.addText(point,{x:9.75,y,w:2.85,h:.93,fontSize:12.5,color:C.ink,margin:0,fit:'shrink'});
    y+=1.35;
  }
  s.addText('FICTIONAL DATA  /  OCT 2026',{x:.45,y:7.13,w:4.5,h:.2,fontSize:8,bold:true,charSpacing:1,color:C.gray,margin:0});
  s.addText(String(pptx._slides.length).padStart(2,'0')+' / 08',{x:12.05,y:7.12,w:.75,h:.25,align:'right',fontSize:9,color:C.gray,margin:0});
}

slide('CVRDE Work Management','Pilot demonstration','01-login',[
  'Four fictional accounts cover the PM, two scientists, and reviewer.',
  'The login page includes the public demo password.',
  'One Vercel project hosts the interface and API.'
]);
slide('Project overview','Project manager','02-pm-overview',[
  'Dashboard totals come from current task and approval data.',
  'Seventeen seeded tasks cover varied owners and deadlines.',
  'Decision and overdue lists lead to the underlying work.'
]);
slide('Project setup and groups','Project manager settings','03-projects-and-groups',[
  'Create projects and add existing team members.',
  'Add groups manually or import an Excel sheet.',
  'Group permissions control shared work.'
]);
slide('Scientist workspace','Scientist one','07-member-tasks',[
  'The table shows task, due date, and linked work.',
  'Members see owned and permitted shared tasks.',
  'Status and results are updated inside task detail.'
]);
slide('Results and evidence','Task detail','04-task-detail',[
  'Status changes through a dropdown.',
  'A single description submits each result version.',
  'Prerequisites and reassignment live in task detail.'
]);
slide('Review and approvals','Project manager','05-pending-actions',[
  'Filter decisions by request type and task.',
  'Managers decide employee reassignment requests.',
  'Results, extensions, and prerequisites share one queue.'
]);
slide('Independent reviewer','Reviewer','08-reviewer-actions',[
  'A PM reassignment request reaches the reviewer.',
  'The reason and work window are visible before a decision.',
  'Approval changes ownership; rejection retains it.'
]);
slide('Reports and pilot readiness','Project manager','06-reports',[
  'Overdue Tasks and Project Progress offer CSV export.',
  'The HTTPS demo runs on biztel-ai-cvrde.vercel.app.',
  'SMTP delivery requires controlled inboxes and settings.'
]);
const output=join(root,'docs','CVRDE_Demo_Presentation.pptx');
await mkdir(join(root,'docs'),{recursive:true});
await pptx.writeFile({fileName:output});
console.log(output);

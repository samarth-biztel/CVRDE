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
  s.addText(String(pptx._slides.length).padStart(2,'0')+' / 09',{x:12.05,y:7.12,w:.75,h:.25,align:'right',fontSize:9,color:C.gray,margin:0});
}

slide('CVRDE Work Management','Pilot demonstration','01-login',[
  'Four fictional accounts cover the PM, two scientists, and reviewer.',
  'The login page includes the public demo password.',
  'One Vercel project hosts the interface and API.'
]);
slide('Project overview','Project manager','02-pm-overview',[
  'Three sub-projects are at different stages.',
  'Risk shows overdue, due soon, and stale tasks.',
  'Decisions and progress lead to the underlying work.'
]);
slide('Project structure','Project manager','03-projects-and-groups',[
  'Project → Sub-project → Task.',
  'PM sets each sub-project objective, owner, and due date.',
  'Sub-project owners assign tasks within their scope.'
]);
slide('Task owner workspace','My work','07-member-tasks',[
  'Owned tasks are grouped by when action is due.',
  'Returned work shows the reviewer reason.',
  'Submitted work waits for review.'
]);
slide('Results and evidence','Task detail','04-task-detail',[
  'Start, attach a report, and submit a result.',
  'Reviewers return with a reason or sign off.',
  'Activity explains each change in plain language.'
]);
slide('Evidence review','Sub-project owner','05-pending-actions',[
  'Submitted evidence is visible in the review queue.',
  'Return requires a reason and alerts the task owner.',
  'Sign-off increases sub-project progress.'
]);
slide('Meeting follow-up','Project manager','08-reviewer-actions',[
  'Record minutes and assign an action item.',
  'The action appears in its owner’s My work.',
  'The owner receives an assignment notification.'
]);
slide('Pilot readiness','Hosted demo','06-reports',[
  'The eight-step loop runs on the hosted build.',
  'Email uses Resend with a redirected team inbox.',
  'Live delivery check follows deployment configuration.'
]);
{
  const s=pptx.addSlide();s.background={color:'FAFAFA'};
  s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.12,h:7.5,line:{color:C.accent},fill:{color:C.accent}});
  s.addText('ROADMAP',{x:.45,y:.3,w:10,h:.2,fontSize:8,bold:true,charSpacing:1.8,color:C.accent,margin:0});
  s.addText('After the pilot',{x:.45,y:.58,w:12,h:.5,fontFace:'Aptos Display',fontSize:28,bold:true,color:C.ink,margin:0});
  const items=['Milestone planning and tracking','Minutes approval workflow','Technology readiness level (TRL) tracking','Multi-level review','On-premise deployment and object storage'];
  items.forEach((item,i)=>{const y=1.5+i*1.02;s.addShape(pptx.ShapeType.rect,{x:.52,y:y+.16,w:.12,h:.12,line:{color:C.accent},fill:{color:C.accent}});s.addText(item,{x:.86,y,w:11.5,h:.6,fontSize:20,color:C.ink,margin:0})});
  s.addText('PLANNED  /  NOT IN CURRENT DEMO',{x:.45,y:7.13,w:7,h:.2,fontSize:8,bold:true,charSpacing:1,color:C.gray,margin:0});
  s.addText('09 / 09',{x:12.05,y:7.12,w:.75,h:.25,align:'right',fontSize:9,color:C.gray,margin:0});
}
const output=join(root,'docs','CVRDE_Demo_Presentation.pptx');
await mkdir(join(root,'docs'),{recursive:true});
await pptx.writeFile({fileName:output});
console.log(output);

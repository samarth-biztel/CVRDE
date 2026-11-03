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
const C={ink:'111827',accent:'4338CA',gray:'52525B',line:'E4E4E7',white:'FFFFFF'};
const root=process.cwd(),screens=join(root,'docs','screenshots');
const slides=[
  ['CVRDE Work Management','Pilot demo','01-login',['Six fictional accounts cover the PM, three sub-project owners, and two task owners.','Choose a person to fill the sign-in form.','The same hosted workspace serves the interface and API.']],
  ['Programme overview','Project manager','02-overview',['Three sub-projects show different stages of work.','Review decisions and at-risk tasks appear before the project structure.','The PM can open any task or sub-project from here.']],
  ['Project task register','Project manager','03-tasks',['Find work by sub-project, owner, status, priority, and due date.','Assigned, due date, timing, owner, and reviewer are visible together.','Open a task to inspect its evidence and history.']],
  ['My sub-project','Sub-project owner','04-subproject',['One table puts submitted work first for review.','Returned and overdue work follows in action order.','The owner can assign tasks and record meetings within this sub-project.']],
  ['My work','Task owner','05-my-work',['Only owned tasks appear in the primary work list.','Returned work carries the reviewer reason.','Each row offers its next relevant action.']],
  ['Evidence and resubmission','Task detail','06-task-detail',['The task explains the expected deliverable and current review state.','The owner adds evidence and a result summary before submitting.','Submission history, discussion, and audit history remain available.']],
  ['Evidence review','Sub-project owner','07-review',['Submitted work is ready for a decision.','A return requires a reason and notifies the task owner.','Sign-off completes the task and updates progress.']],
  ['Meeting follow-up','Project manager','08-meeting',['The meeting date and minutes-recorded date are distinct.','Minutes capture attendees and decisions.','Action items become assigned tasks with notifications.']]
];
function addSlide([title,eyebrow,image,points],number){
  const slide=pptx.addSlide();slide.background={color:'FAFAFA'};
  slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.12,h:7.5,line:{color:C.accent},fill:{color:C.accent}});
  slide.addText(eyebrow.toUpperCase(),{x:.45,y:.3,w:10,h:.2,fontSize:8,bold:true,charSpacing:1.8,color:C.accent,margin:0});
  slide.addText(title,{x:.45,y:.58,w:12.1,h:.5,fontFace:'Aptos Display',fontSize:28,bold:true,color:C.ink,margin:0});
  slide.addShape(pptx.ShapeType.rect,{x:.4,y:1.32,w:8.55,h:5.5,line:{color:C.line,width:1},fill:{color:C.white}});
  const ratio=image==='03-tasks'?1600/900:1440/900,width=Math.min(8.47,5.42*ratio),height=width/ratio;
  slide.addImage({path:join(screens,`demo-${image}.png`),x:.44+(8.47-width)/2,y:1.36+(5.42-height)/2,w:width,h:height});
  slide.addShape(pptx.ShapeType.rect,{x:9.23,y:1.32,w:3.68,h:5.5,line:{color:C.line,width:1},fill:{color:C.white}});
  slide.addText('IN THIS VIEW',{x:9.5,y:1.69,w:3.1,h:.23,fontSize:9,bold:true,charSpacing:1.6,color:C.accent,margin:0});
  points.forEach((point,index)=>{const y=2.2+index*1.35;slide.addShape(pptx.ShapeType.rect,{x:9.51,y:y+.06,w:.08,h:.08,line:{color:C.accent},fill:{color:C.accent}});slide.addText(point,{x:9.75,y,w:2.85,h:.93,fontSize:12.5,color:C.ink,margin:0,fit:'shrink'})});
  slide.addText('FICTIONAL DEMO DATA  /  NOV 2026',{x:.45,y:7.13,w:5.3,h:.2,fontSize:8,bold:true,charSpacing:1,color:C.gray,margin:0});
  slide.addText(`${String(number).padStart(2,'0')} / 09`,{x:12.05,y:7.12,w:.75,h:.25,align:'right',fontSize:9,color:C.gray,margin:0});
}
slides.forEach((slide,index)=>addSlide(slide,index+1));
{
  const slide=pptx.addSlide();slide.background={color:'FAFAFA'};
  slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.12,h:7.5,line:{color:C.accent},fill:{color:C.accent}});
  slide.addText('ROADMAP',{x:.45,y:.3,w:10,h:.2,fontSize:8,bold:true,charSpacing:1.8,color:C.accent,margin:0});
  slide.addText('After the pilot',{x:.45,y:.58,w:12,h:.5,fontFace:'Aptos Display',fontSize:28,bold:true,color:C.ink,margin:0});
  ['Milestone planning and tracking','Minutes approval workflow','Technology readiness level (TRL) tracking','Multi-level review','On-premise deployment and object storage'].forEach((item,index)=>{const y=1.5+index*1.02;slide.addShape(pptx.ShapeType.rect,{x:.52,y:y+.16,w:.12,h:.12,line:{color:C.accent},fill:{color:C.accent}});slide.addText(item,{x:.86,y,w:11.5,h:.6,fontSize:20,color:C.ink,margin:0})});
  slide.addText('PLANNED  /  OUTSIDE CURRENT DEMO',{x:.45,y:7.13,w:7,h:.2,fontSize:8,bold:true,charSpacing:1,color:C.gray,margin:0});
  slide.addText('09 / 09',{x:12.05,y:7.12,w:.75,h:.25,align:'right',fontSize:9,color:C.gray,margin:0});
}
const output=join(root,'docs','CVRDE_Demo_Presentation.pptx');
await mkdir(join(root,'docs'),{recursive:true});
await pptx.writeFile({fileName:output});
console.log(output);

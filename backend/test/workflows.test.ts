import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { demoPassword } from '../src/demo.js';

describe('fictional demo workflows', () => {
  it('enforces visibility and completes approval and result flows', async () => {
    const password=demoPassword;
    if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL; run npm run migrate and npm run seed before this test');
    const pm=request.agent(app),s1=request.agent(app),s2=request.agent(app),reviewer=request.agent(app);
    const loginIds:Record<string,number>={};
    for(const [agent,username] of [[pm,'pm.demo'],[s1,'scientist1.demo'],[s2,'scientist2.demo'],[reviewer,'reviewer.demo']] as const){
      const response=await agent.post('/api/v1/auth/login').send({username,password});expect(response.status).toBe(200);loginIds[username]=response.body.id;
    }
    const projects=await pm.get('/api/v1/projects');expect(projects.status).toBe(200);
    const project=projects.body.find((p:{name:string})=>p.name==='Engine Component Development — Demo');expect(project).toBeTruthy();
    expect((await s1.patch(`/api/v1/projects/${project.id}`).send({name:'Unauthorized edit'})).status).toBe(404);
    const updatedProject=await pm.patch(`/api/v1/projects/${project.id}`).send({description:'Workflow verification project'});
    expect(updatedProject.status).toBe(200);expect(updatedProject.body.description).toBe('Workflow verification project');
    const tasks=await pm.get(`/api/v1/projects/${project.id}/tasks`);expect(tasks.status).toBe(200);
    const find=(title:string)=>tasks.body.find((t:{title:string})=>t.title===title);
    const thermal=find('Thermal analysis report'),material=find('Material sample testing'),fatigue=find('Fatigue test setup'),drawing=find('Component drawing review');
    expect(thermal && material && fatigue && drawing).toBeTruthy();
    const lastTaskDate=new Date(Date.parse(project.target_date)-86400000).toISOString().slice(0,10);
    expect((await pm.post(`/api/v1/projects/${project.id}/tasks`).send({title:'Invalid deadline',owner_id:loginIds['scientist1.demo'],due_date:project.target_date})).status).toBe(400);
    expect((await pm.patch(`/api/v1/tasks/${fatigue.id}`).send({due_date:project.target_date})).status).toBe(400);
    expect((await s1.post(`/api/v1/tasks/${fatigue.id}/extension-requests`).send({new_due_date:project.target_date,reason:'Past project deadline'})).status).toBe(400);
    expect((await s1.get(`/api/v1/tasks/${thermal.id}`)).status).toBe(200);
    expect((await s1.get(`/api/v1/tasks/${drawing.id}`)).status).toBe(404);
    expect((await s2.get(`/api/v1/tasks/${material.id}`)).status).toBe(200);
    expect((await s2.get(`/api/v1/tasks/${material.id}/results`)).status).toBe(200);
    expect((await s2.post(`/api/v1/tasks/${material.id}/status`).send({})).status).toBe(403);
    expect((await s2.post(`/api/v1/tasks/${material.id}/progress`).send({percent:50,justification:'Viewer edit'})).status).toBe(403);
    expect((await s2.patch(`/api/v1/tasks/${material.id}`).send({title:'Viewer edit'})).status).toBe(404);
    expect((await s1.post(`/api/v1/tasks/${material.id}/progress`).send({percent:50})).status).toBe(400);
    expect((await s1.post(`/api/v1/tasks/${material.id}/progress`).send({percent:50,justification:'Half the samples tested'})).status).toBe(200);
    expect((await reviewer.get(`/api/v1/tasks/${drawing.id}`)).status).toBe(404);
    const dashboard=await pm.get(`/api/v1/projects/${project.id}/dashboard`);
    expect(dashboard.body.total).toBe(17);expect(dashboard.body.overdue).toBe(2);

    const extension=await s1.post(`/api/v1/tasks/${material.id}/extension-requests`).send({new_due_date:lastTaskDate,reason:'Additional samples required'});
    expect(extension.status).toBe(201);
    expect((await s2.post(`/api/v1/extension-requests/${extension.body.id}/decision`).send({approve:true})).status).toBe(404);
    expect((await pm.post(`/api/v1/extension-requests/${extension.body.id}/decision`).send({approve:true})).body.status).toBe('APPROVED');
    expect((await pm.get(`/api/v1/projects/${project.id}/dashboard`)).body.overdue).toBe(1);

    const memberRequest=await s1.post(`/api/v1/tasks/${material.id}/reassignments`).send({new_owner_id:loginIds['scientist2.demo'],reason:'Need another scientist for the November work window',work_from:'2026-11-01',work_until:'2026-11-15'});
    expect(memberRequest.status).toBe(201);
    expect(memberRequest.body.reviewer_id).toBe(loginIds['pm.demo']);
    expect(memberRequest.body.work_from).toBe('2026-11-01');
    expect((await s2.post(`/api/v1/reassignments/${memberRequest.body.id}/decision`).send({approve:true})).status).toBe(403);
    expect((await pm.post(`/api/v1/reassignments/${memberRequest.body.id}/decision`).send({approve:false,comment:'Keep current owner'})).body.status).toBe('REJECTED');
    expect((await s1.get(`/api/v1/tasks/${material.id}`)).status).toBe(200);

    const reassignment=await pm.post(`/api/v1/tasks/${fatigue.id}/reassignments`).send({new_owner_id:loginIds['scientist2.demo'],reviewer_id:loginIds['reviewer.demo'],reason:'Scientist one unavailable'});
    expect(reassignment.status).toBe(201);
    expect((await reviewer.post(`/api/v1/reassignments/${reassignment.body.id}/decision`).send({approve:true})).body.status).toBe('APPROVED');
    expect((await s1.get(`/api/v1/tasks/${fatigue.id}`)).status).toBe(404);
    expect((await s2.get(`/api/v1/tasks/${fatigue.id}`)).status).toBe(200);

    const results=await pm.get(`/api/v1/tasks/${thermal.id}/results`);
    const pending=results.body.find((r:{review_status:string})=>r.review_status==='PENDING');expect(pending).toBeTruthy();
    expect((await pm.post(`/api/v1/results/${pending.id}/review`).send({accept:false,comment:'Please revise'})).body.status).toBe('RETURNED');
    const revised=await s2.post(`/api/v1/tasks/${thermal.id}/results`).send({work_completed:'Final thermal analysis',outcome:'Ready'});
    expect(revised.status).toBe(201);expect(revised.body.version_no).toBe(3);
    expect((await pm.post(`/api/v1/results/${revised.body.id}/review`).send({accept:true,comment:'Accepted'})).body.status).toBe('DONE');

    const files=await pm.get(`/api/v1/tasks/${thermal.id}/attachments`);expect(files.body.length).toBe(2);
    const downloaded=await s1.get(`/api/v1/attachments/${files.body[0].id}/download`).buffer(true).parse((response,callback)=>{const chunks:Buffer[]=[];response.on('data',(chunk:Buffer)=>chunks.push(chunk));response.on('end',()=>callback(null,Buffer.concat(chunks)));});
    expect(downloaded.status).toBe(200);
    expect((await s2.post(`/api/v1/tasks/${thermal.id}/attachments`).field('document_key','invalid').attach('file',Buffer.from('not a PDF'),'invalid.pdf')).status).toBe(400);
    expect((await s2.post(`/api/v1/tasks/${thermal.id}/attachments`).field('document_key','verified-copy').attach('file',downloaded.body,'copy.xlsx')).status).toBe(201);
    expect((await reviewer.get(`/api/v1/attachments/${files.body[0].id}/download`)).status).toBe(404);
    const report=await pm.get(`/api/v1/reports/progress.csv?project_id=${project.id}`);expect(report.status).toBe(200);expect(report.text).toContain('Thermal analysis report');
    expect((await s1.post(`/api/v1/tasks/${thermal.id}/status`).send({status:'COMPLETED'})).status).toBe(403);

    const pendencies=await s2.get('/api/v1/pendencies');
    const open=pendencies.body.find((p:{status:string;blocked_task_id:number})=>p.status==='OPEN'&&p.blocked_task_id!==undefined);
    expect(open).toBeTruthy();
    expect((await s2.post(`/api/v1/pendencies/${open.id}/resolve`).send({resolution:'Inputs confirmed'})).body.status).toBe('RESOLVED');
    const actions=await s2.get('/api/v1/me/pending-actions');
    expect(actions.body.some((a:{id:number;kind:string})=>a.id===open.id&&a.kind==='PENDENCY_RESOLVE')).toBe(false);

    const groups=await pm.get(`/api/v1/projects/${project.id}/groups`);
    const shared=groups.body.find((g:{name:string})=>g.name==='Test programme team');
    expect(shared).toBeTruthy();
    expect((await pm.delete(`/api/v1/groups/${shared.id}/members/${loginIds['scientist1.demo']}`)).status).toBe(200);
    expect((await s1.get(`/api/v1/tasks/${thermal.id}`)).status).toBe(404);
    expect((await s1.get(`/api/v1/attachments/${files.body[0].id}/download`)).status).toBe(404);
    const docs=await s1.get(`/api/v1/projects/${project.id}/documents`);expect(docs.status).toBe(200);expect(docs.body.length).toBe(2);
  },180000);
});

import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
const config=process.argv[2];assert.ok(config,'Secure configuration directory required');
const env=parseEnv(await readFile(resolve(config,'.env.staging.local'),'utf8'));
const accounts=parseEnv(await readFile(resolve(config,'.env.staging.accounts.local'),'utf8'));
const url='https://slghshcdaijbcjfoqerq.supabase.co';assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,url);assert.equal(env.SUPABASE_PROJECT_REF,'slghshcdaijbcjfoqerq');
const folder=resolve('.local-qa/als-manual-demo-v1');
const pack=JSON.parse(await readFile(resolve(folder,'fixture-manifest.json'),'utf8'));
const roster=JSON.parse(await readFile(resolve(folder,'additional-accounts.json'),'utf8'));
const results=[];const check=(name,value)=>{assert.ok(value,name);results.push(name);console.log('PASS',name);};
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
async function login(email,password){const db=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const signed=ok(await db.auth.signInWithPassword({email,password}));return {db,id:signed.user.id};}
const admin=(await login('als-staging-admin@example.test',accounts.ALS_STAGE_ADMIN_PASSWORD)).db;
const teacher=(await login('als-staging-teacher@example.test',accounts.ALS_STAGE_TEACHER_PASSWORD)).db;
const student1=await login('als-staging-student1@example.test',accounts.ALS_STAGE_STUDENT1_PASSWORD);
const student2=await login('als-staging-student2@example.test',accounts.ALS_STAGE_STUDENT2_PASSWORD);
for(const [label,s] of [['Student1',student1],['Student2',student2]]){
 const enrollments=ok(await s.db.from('enrollments').select('id,program_id,status,access_expires_at').eq('student_id',s.id));
 check(`${label} has independently eligible demo program rows`,pack.programs.every(p=>enrollments.some(e=>e.program_id===p && e.status==='active' && Date.parse(e.access_expires_at)>Date.now())));
 check(`${label} original enrollment ID preserved`,enrollments.some(e=>e.id===(label==='Student1'?'dcaa8c36-70ab-4efe-a215-cc0b619c4b1a':'0ae90cfb-4034-4e33-8a12-ba0750334f3d')));
 const items=ok(await s.db.from('learning_content').select('id,status').in('id',pack.materials));check(`${label} sees five published materials, no draft`,items.length===5 && items.every(x=>x.status==='active'));
 check(`${label} raw question rows hidden`,ok(await s.db.from('questions').select('id').in('id',pack.questions)).length===0);
 check(`${label} answer keys hidden`,ok(await s.db.from('question_answer_keys').select('*').in('question_id',pack.questions)).length===0);
}
const mappings=ok(await admin.from('program_subjects').select('program_id,subject_id').in('program_id',pack.programs));check('Three canonical demo subject mappings',mappings.length===3);
const questions=ok(await teacher.from('questions').select('id,status,prompt,created_by').in('id',pack.questions));
check('Teacher sees eighteen scoped questions including drafts',questions.length===18 && questions.filter(x=>x.status==='draft').length===3);
const materials=ok(await teacher.from('learning_content').select('id,status').in('id',pack.materials));check('Teacher sees six materials including one draft',materials.length===6 && materials.filter(x=>x.status==='draft').length===1);
check('Teacher sees five canonical assessments',ok(await teacher.from('tests').select('id').in('id',pack.tests)).length===5);
const history=ok(await student1.db.rpc('core_attempt_history',{target_test:pack.tests[2]}));
check('Synthetic demo result submitted and server graded',history.length===1 && history[0].status==='submitted' && Number(history[0].score)===6 && Number(history[0].total_marks)===6);
const catalog=ok(await student1.db.rpc('core_student_test_catalog'));
check('Student catalogue distinguishes available practice/upcoming/closed; submission is separate history', ['available','upcoming','closed'].every(state=>catalog.some(x=>pack.tests.includes(x.id)&&x.state===state)) && history[0].submitted_at);
for(const [label,email,password] of [
 ['Expired',roster.expired.email,roster.expired.password],
 ['Unenrolled','als-staging-ineligible@example.test',accounts.ALS_STAGE_INELIGIBLE_PASSWORD],
]){
 const {db}=await login(email,password);check(`${label} cannot join demo class`,ok(await db.rpc('can_join_live',{target_session:pack.classes[0]}))===false);
 check(`${label} cannot read demo materials`,ok(await db.from('learning_content').select('id').in('id',pack.materials)).length===0);
}
const unassigned=(await login(roster['unassigned-teacher'].email,roster['unassigned-teacher'].password)).db;
check('Unassigned Teacher sees no demo question rows',ok(await unassigned.from('questions').select('id').in('id',pack.questions)).length===0);
const q=ok(await admin.from('questions').select('*').eq('id',pack.questions[1]).single());
const invalidWrite=await unassigned.rpc('core_save_question',{value:{...q,id:crypto.randomUUID(),options:[{content:'One',correct:true},{content:'Two',correct:false}]}});
check('Unassigned Teacher canonical authoring denied',!!invalidWrite.error);
const watches=ok(await student1.db.from('playback_watch_events').select('elapsed_seconds,ended_at'));
const report={project:pack.project,checked_at:new Date().toISOString(),results,counts:{programs:2,subjects:3,materials:6,published_materials:5,questions:18,active_questions:15,draft_questions:3,tests:5,new_classes:3,watch_seconds:watches.reduce((n,e)=>n+Number(e.elapsed_seconds),0)},demo_result:{attempt_id:history[0].id,score:history[0].score,total_marks:history[0].total_marks},catalog:catalog.filter(t=>pack.tests.includes(t.id)).map(t=>({id:t.id,title:t.title,state:t.state}))};
await writeFile(resolve(folder,'backend-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.counts));

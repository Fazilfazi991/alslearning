// Explicit staging-only maintenance. Never imported by the application.
// node scripts/als-manual-fixtures.mjs snapshot|migrate|seed|renew-access CONFIG_DIR MANAGEMENT_ENV
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseEnv } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { png } from './core-fixtures.mjs';
const pdf = await readFile(new URL('./fixtures/als-demo-guide.pdf', import.meta.url));

const [mode, configDir, managementFile] = process.argv.slice(2);
assert.ok(['snapshot','migrate','seed','renew-access'].includes(mode) && configDir && managementFile, 'Explicit mode and secure configuration paths required');
const ref='slghshcdaijbcjfoqerq', url=`https://${ref}.supabase.co`, version='als-manual-demo-v1';
const env=parseEnv(await readFile(resolve(configDir,'.env.staging.local'),'utf8'));
const accounts=parseEnv(await readFile(resolve(configDir,'.env.staging.accounts.local'),'utf8'));
const management=parseEnv(await readFile(managementFile,'utf8'));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,url); assert.equal(env.SUPABASE_PROJECT_REF,ref);
const base=`https://api.supabase.com/v1/projects/${ref}`;
const headers={Authorization:`Bearer ${management.SUPABASE_ACCESS_TOKEN}`};
async function guard() {
 const response=await fetch(base,{headers}); assert.ok(response.ok,'Project verification failed'); const p=await response.json();
 assert.equal(p.ref,ref); assert.equal(p.name,'als-live-staging'); assert.equal(p.organization_id,'oenarbsvxrmnsvugjdrz'); assert.equal(p.status,'ACTIVE_HEALTHY');
}
async function sql(query) {
 await guard(); const response=await fetch(`${base}/database/query`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({query})});
 const value=await response.json(); if(!response.ok)throw Error(`Staging SQL failed (${response.status}): ${value.message ?? 'see protected diagnostics'}`); return value;
}
await guard();
const quiet=await sql("select (select count(*) from public.live_sessions where status='live')+(select count(*) from public.live_recording_segments where status in ('recording','uploading','interrupted'))+(select count(*) from public.live_media_connections where status in ('active','reconnecting','failed')) as busy");
assert.equal(Number(quiet[0].busy),0,'Owner/media activity present; refuse maintenance');
const evidenceDir=resolve('.local-qa',version); await mkdir(evidenceDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const audit={version,project:ref,mode,at:new Date().toISOString(),records:[]};
const log=(table,id,action,provenance='synthetic manual test pack')=>{audit.records.push({table,id,action,provenance});writeFileSync(resolve(evidenceDir,`${mode}-${stamp}.json`),JSON.stringify(audit,null,2),{mode:0o600});};
if(mode==='snapshot') {
 const tables=await sql("select tablename from pg_tables where schemaname='public' order by tablename");
 const snapshot={project:ref,at:audit.at,tables:{},migrations:await sql('select version,name from supabase_migrations.schema_migrations order by version')};
 for(const {tablename} of tables) { assert.match(tablename,/^[a-z_]+$/); snapshot.tables[tablename]=await sql(`select * from public."${tablename}"`); }
 const path=resolve(evidenceDir,`snapshot-${stamp}.json`); await writeFile(path,JSON.stringify(snapshot,null,2),{mode:0o600});
 console.log(JSON.stringify({project:ref,mode,tables:tables.length,path})); process.exit(0);
}
if(mode==='migrate') {
 const history=await sql('select version,name from supabase_migrations.schema_migrations');
 assert.ok(history.some(x=>x.version==='20260928075559'),'Accepted batch restriction migration missing; stop');
 for(const name of ['20261001060000_engaged_playback_watch_intervals','20261001063000_student_catalog_visible_scores','20261001070000_teacher_roster_effective_access']) {
 if(history.some(x=>x.name===name || x.version===name.slice(0,14)))console.log(`SKIP already recorded ${name}`);
 else {
  await guard(); const query=await readFile(resolve('supabase/migrations',`${name}.sql`),'utf8');
  const response=await fetch(`${base}/database/migrations`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name,query})});
  assert.ok(response.ok,`New migration failed (${response.status})`); console.log(`Applied ONLY locally tested ${name}`);
 }
 }
 process.exit(0);
}
const options={auth:{persistSession:false,autoRefreshToken:false}};
const service=createClient(url,env.SUPABASE_SERVICE_ROLE_KEY,options);
const ok=result=>{if(result.error)throw Error(result.error.message);return result.data;};
async function login(role) {
 const db=createClient(url,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,options);
 const signed=ok(await db.auth.signInWithPassword({email:`als-staging-${role}@example.test`,password:accounts[`ALS_STAGE_${role.toUpperCase()}_PASSWORD`]}));
 return {db,user:signed.user};
}
const {db:admin,user:adminUser}=await login('admin');
const {db:teacher,user:teacherUser}=await login('teacher');
assert.equal(teacherUser.id,'0e6466ff-3aeb-4db0-b792-b568ec3edc47');
const primary=ok(await admin.from('profiles').select('id,email,role,is_active').in('email',['als-staging-student1@example.test','als-staging-student2@example.test']));
assert.equal(primary.length,2); for(const p of primary){assert.equal(p.role,'student');assert.equal(p.is_active,true);}
if(mode==='renew-access') {
 const start=new Date(),expiry=new Date(start.getTime()+7*86400000);
 const before=ok(await admin.from('enrollments').select('id,student_id,program_id,batch_id,status,access_expires_at').in('student_id',primary.map(x=>x.id)).eq('status','active'));
 assert.ok(before.some(x=>x.id==='dcaa8c36-70ab-4efe-a215-cc0b619c4b1a') && before.some(x=>x.id==='0ae90cfb-4034-4e33-8a12-ba0750334f3d'));
 for(const row of before){ok(await admin.from('enrollments').update({access_starts_at:start.toISOString(),access_expires_at:expiry.toISOString()}).eq('id',row.id));log('enrollments',row.id,'updated','Explicit seven-day primary manual access renewal; original enrollment IDs preserved');}
 audit.access={starts_at:start.toISOString(),expires_at:expiry.toISOString(),timezone:'Asia/Dubai',before};
 await writeFile(resolve(evidenceDir,`access-${stamp}.json`),JSON.stringify(audit,null,2),{mode:0o600});
 await writeFile(resolve(evidenceDir,'primary-access-policy.json'),JSON.stringify({version,primary_ids:primary.map(x=>x.id),enrollment_ids:before.map(x=>x.id),...audit.access},null,2),{mode:0o600});
 console.log(JSON.stringify({mode,starts_at:start.toISOString(),expires_at:expiry.toISOString(),enrollments:before.length})); process.exit(0);
}
function id(key){const hex=createHash('sha256').update(`${version}:${key}`).digest('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;}
async function ensure(table,row,keys=['id']){
 let q=admin.from(table).select('*'); for(const key of keys)q=q.eq(key,row[key]);
 const existing=ok(await q.maybeSingle()); if(existing){log(table,keys.map(k=>row[k]).join('/'),'skipped','Existing row retained including owner edits');return existing;}
 const created=ok(await admin.from(table).insert(row).select().single());log(table,keys.map(k=>row[k]).join('/'),'created');return created;
}
async function rpcNew(table,value,call,args){
 const existing=ok(await admin.from(table).select('id').eq('id',value.id).maybeSingle());
 if(existing){log(table,value.id,'skipped','Existing canonical record and owner edits retained');return;}
 const writer=call==='core_save_content'?admin:teacher;
 ok(await writer.rpc(call,args));log(table,value.id,'created',`Authenticated ${call==='core_save_content'?'Admin':'Teacher'} ${call}`);
}
const exam=await ensure('entrance_exams',{id:id('exam'),slug:version,name:'ALS Demo Laboratory Entrance',status:'active'});
const programA=ok(await admin.from('programs').select('*').eq('id','66106212-52d7-4c4b-9e62-db3534bfe011').single());
assert.equal(programA.slug,'als-staging-classroom');
if(!programA.exam_id){ok(await admin.from('programs').update({exam_id:exam.id,has_tests:true}).eq('id',programA.id).is('exam_id',null));log('programs',programA.id,'updated','Existing designated synthetic program taxonomy configured once');}else assert.equal(programA.exam_id,exam.id);
const programB=await ensure('programs',{id:id('program-b'),slug:`${version}-diagnostics`,name:'ALS Demo Diagnostic Foundations',description:'Synthetic manual-test curriculum; not a real examination syllabus.',exam_id:exam.id,status:'active',has_tests:true,has_live_classes:true,has_recorded_content:true});
const batchA=ok(await admin.from('batches').select('*').eq('id','fe5b1e6c-0ade-4fdc-a914-5c8d3fa1e8e3').single());
const batchB=await ensure('batches',{id:id('batch-b'),slug:`${version}-batch-b`,name:'Synthetic Diagnostic Demo Batch',program_id:programB.id,status:'active',max_students:8});
await ensure('batch_faculty',{batch_id:batchB.id,faculty_id:teacherUser.id},['batch_id','faculty_id']);
const existingSubject=ok(await admin.from('subjects').select('*').eq('id','5579ddb6-6cba-4d95-bc15-e2be3d617f6d').single());
const scopes=[{program:programA,batch:batchA,subject:existingSubject},
 {program:programA,batch:batchA,subject:await ensure('subjects',{id:id('subject-safety'),slug:`${version}-safety`,name:'Demo Laboratory Safety',status:'active'})},
 {program:programB,batch:batchB,subject:await ensure('subjects',{id:id('subject-diagnostics'),slug:`${version}-diagnostics`,name:'Demo Diagnostic Reasoning',status:'active'})}];
for(let n=0;n<scopes.length;n++){
 const scope=scopes[n];await ensure('program_subjects',{program_id:scope.program.id,subject_id:scope.subject.id},['program_id','subject_id']);
 await ensure('faculty_assignments',{id:id(`assignment-${n}`),faculty_id:teacherUser.id,exam_id:exam.id,program_id:scope.program.id,subject_id:scope.subject.id,can_manage_content:true,can_manage_questions:true,can_manage_tests:true});
 scope.chapter=await ensure('chapters',{id:id(`chapter-${n}`),slug:`${version}-chapter-${n}`,name:['Demo Sample Handling','Demo Safe Practice','Demo Result Interpretation'][n],subject_id:scope.subject.id,program_id:scope.program.id,status:'active'});
 scope.topic=await ensure('topics',{id:id(`topic-${n}`),slug:`${version}-topic-${n}`,name:['Demo Identification','Demo Protective Equipment','Demo Reference Ranges'][n],subject_id:scope.subject.id,chapter_id:scope.chapter.id,program_id:scope.program.id,status:'active'});
 for(const student of primary)await ensure('enrollments',{id:id(`enrollment-${student.id}-${scope.program.id}`),student_id:student.id,program_id:scope.program.id,batch_id:scope.batch.id,status:'active',access_starts_at:new Date().toISOString(),access_expires_at:new Date(Date.now()+7*86400000).toISOString()},['student_id','program_id','batch_id']);
}
const secureRosterPath=resolve(evidenceDir,'additional-accounts.json');
let secureRoster={};try{secureRoster=JSON.parse(await readFile(secureRosterPath,'utf8'));}catch{}
const authRoster=ok(await service.auth.admin.listUsers({perPage:1000})).users;
for(const [label,role] of [['roster-a','student'],['roster-b','student'],['expired','student'],['unassigned-teacher','teacher']]){
 const email=`als-manual-demo-${label}@example.test`;let user=authRoster.find(x=>x.email===email);
 if(!user){const password=randomBytes(24).toString('base64url');user=ok(await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role},user_metadata:{full_name:`Synthetic Demo ${label}`}})).user;secureRoster[label]={email,password,id:user.id};await writeFile(secureRosterPath,JSON.stringify(secureRoster,null,2),{mode:0o600});log('auth.users',user.id,'created');}else log('auth.users',user.id,'skipped');
 assert.equal(ok(await admin.from('profiles').select('role').eq('id',user.id).single()).role,role);
 if(role==='student')await ensure('enrollments',{id:id(`negative-roster-${label}`),student_id:user.id,program_id:label==='expired'?programA.id:programB.id,batch_id:label==='expired'?batchA.id:batchB.id,status:'active',access_starts_at:new Date(Date.now()-86400000).toISOString(),access_expires_at:new Date(Date.now()+(label==='expired'?-3600000:7*86400000)).toISOString()});
}
async function upload(bucket,name,bytes,mime){
 const existing=ok(await admin.storage.from(bucket).list(dirname(name),{search:name.split('/').at(-1)}));
 if(existing.some(x=>x.name===name.split('/').at(-1))){log(`storage.${bucket}`,name,'skipped');return;}
 ok(await admin.storage.from(bucket).upload(name,bytes,{contentType:mime,upsert:false}));log(`storage.${bucket}`,name,'created');
}
const imagePath=`${adminUser.id}/${version}/lab-image.png`,pdfPath=`${adminUser.id}/${version}/lab-guide-v2.pdf`,videoPath=`${adminUser.id}/${version}/lab-video.mp4`;
await upload('learning-content',imagePath,png,'image/png');await upload('learning-content',pdfPath,pdf,'application/pdf');
const video=await readFile(resolve(evidenceDir,'lab-video.mp4'));assert.ok(video.length>1000 && video.length<5*1024*1024,'Small prepared synthetic video required');
await upload('learning-content',videoPath,video,'video/mp4');
const questionImage=`${adminUser.id}/${version}/question-image.png`;await upload('question-media',questionImage,png,'image/png');
for(let i=0;i<6;i++){
 const scope=scopes[i%3],kind=['pdf','image','video','note','note','document'][i];
 const path=kind==='pdf'||kind==='document'?pdfPath:kind==='image'?imagePath:kind==='video'?videoPath:null;
 const value={id:id(`material-${i}`),title:['Demo Sample Handling Guide','Demo Laboratory Colour Diagram','Demo Laboratory Video — 45 seconds','Demo Safety Checklist','Demo Reference Range Notes (draft)','Demo Diagnostic Reading'][i],kind,description:'Synthetic manual-test material. Identify the sample, confirm the label and follow the documented safety procedure.',exam_id:exam.id,program_id:scope.program.id,subject_id:scope.subject.id,chapter_id:scope.chapter.id,topic_id:scope.topic.id,faculty_id:teacherUser.id,storage_bucket:path?'learning-content':null,storage_path:path,mime_type:path?(kind==='image'?'image/png':kind==='video'?'video/mp4':'application/pdf'):null,byte_size:path?(kind==='image'?png.length:kind==='video'?video.length:pdf.length):null,status:i===4?'draft':'active',allow_download:false};
 await rpcNew('learning_content',value,'core_save_content',{value,batch_ids:[scope.batch.id]});
}
const questions=[];
for(let i=0;i<18;i++){
 const scope=scopes[Math.floor(i/6)],number=i+1;
 const value={id:id(`question-${i}`),exam_id:exam.id,program_id:scope.program.id,subject_id:scope.subject.id,chapter_id:scope.chapter.id,topic_id:scope.topic.id,type:i===0?'image_mcq':'single_mcq',prompt:`Synthetic demo ${number}: What should be checked before processing sample ${number}?`,explanation:'Confirm the sample identity and label before processing. This is synthetic teaching content.',difficulty:i%2?'medium':'easy',marks:2,negative_marks:0.5,status:i%6===5?'draft':'active',source_type:'standard',source_reference:version,source_label:'Synthetic ALS manual demo',stem_image_path:i===0?questionImage:null,options:[{content:'Sample identity and label',correct:true},{content:'The wall colour',correct:false},{content:'A random result',correct:false},{content:'Nothing',correct:false}]};
 // Canonical Teacher image authorization expects Teacher ownership or prior image scope.
 const writer=i===0?admin:teacher;
 const existing=ok(await admin.from('questions').select('id').eq('id',value.id).maybeSingle());
 if(existing)log('questions',value.id,'skipped','Owner edits retained');else{ok(await writer.rpc('core_save_question',{value}));log('questions',value.id,'created',i===0?'Authenticated Admin image fixture':'Authenticated Teacher canonical creation');}
 questions.push(value);
}
const testIds=[];
for(let i=0;i<5;i++){
 const scope=scopes[i===1?2:0],now=Date.now();
 const value={id:id(`test-${i}`),slug:`${version}-test-${i}`,exam_id:exam.id,program_id:scope.program.id,subject_id:scope.subject.id,title:['Synthetic Demo Practice','Synthetic Upcoming Assessment','Synthetic Demo Graded Result','Synthetic Closed Assessment','Synthetic Draft Assessment'][i],type:'subject',duration_minutes:10,question_count:3,default_negative_marks:0.5,max_attempts:3,show_results:true,show_answers:true,show_explanations:true,selection_mode:'manual',status:i===4?'draft':'active',instructions:'Synthetic demo assessment. Optional practice; not required course work.',internal_description:'Synthetic manual test fixture',available_from:i===1?new Date(now+86400000).toISOString():new Date(now-86400000).toISOString(),available_until:i===3?new Date(now-3600000).toISOString():new Date(now+7*86400000).toISOString()};
 await rpcNew('tests',value,'core_save_test',{value,question_ids:questions.slice(i===1?12:0,i===1?15:3).map(q=>q.id),batch_ids:[scope.batch.id]});testIds.push(value.id);
}
for(let i=0;i<3;i++){
 const scope=scopes[i===1?2:0],start=Date.now()+(i===2?-86400000:(i+1)*3600000);
 await ensure('live_sessions',{id:id(`class-${i}`),title:['Synthetic Manual Classroom','Synthetic Future Diagnostic Class','Synthetic Historical Academic Example'][i],faculty_id:teacherUser.id,program_id:scope.program.id,batch_id:scope.batch.id,subject_id:scope.subject.id,topic_id:scope.topic.id,provider:'cloudflare',status:i===2?'completed':'scheduled',starts_at:new Date(start).toISOString(),ends_at:new Date(start+30*60000).toISOString(),ended_at:i===2?new Date(start+30*60000).toISOString():null,max_receivers:2,recording_enabled:true,student_audio_enabled:false,student_video_enabled:false});
}
// Real canonical submission, labelled synthetic; never overwrite subsequent attempts.
const {db:student}=await login('student1');
const history=ok(await student.rpc('core_attempt_history',{target_test:testIds[2]}));
const pendingAttemptPath=resolve(evidenceDir,'pending-demo-attempt.json');
let pendingAttempt=null;try{pendingAttempt=JSON.parse(await readFile(pendingAttemptPath,'utf8'));}catch{}
const ownedPending=history.find(x=>x.id===pendingAttempt?.id && x.status==='in_progress');
if(!history.length || ownedPending){
 const attempt=ownedPending ?? ok(await student.rpc('start_test_attempt',{target_test:testIds[2]}));
 await writeFile(pendingAttemptPath,JSON.stringify({id:attempt.id,provenance:version,student_id:primary.find(x=>x.email==='als-staging-student1@example.test').id}),{mode:0o600});
 log('test_attempts',attempt.id,ownedPending?'resumed':'created','Runner-owned synthetic attempt; canonical submission pending');
 const payload=ok(await student.rpc('core_attempt_payload',{target_attempt:attempt.id}));
 for(const q of payload.questions){const option=q.options.find(x=>x.content==='Sample identity and label');assert.ok(option);ok(await student.rpc('save_attempt_answer',{target_attempt:attempt.id,target_question:q.id,option_ids:[option.id]}));}
 ok(await student.rpc('submit_test_attempt',{target_attempt:attempt.id}));log('test_attempts',attempt.id,'created','Synthetic Student1 canonical submission and server grading');
}else log('test_attempts',history[0].id,'skipped','Existing attempt history retained');
await writeFile(resolve(evidenceDir,`seed-${stamp}.json`),JSON.stringify(audit,null,2),{mode:0o600});
await writeFile(resolve(evidenceDir,'fixture-manifest.json'),JSON.stringify({version,project:ref,programs:[programA.id,programB.id],scopes:scopes.map(s=>({program:s.program.id,subject:s.subject.id,chapter:s.chapter.id,topic:s.topic.id,batch:s.batch.id})),questions:questions.map(q=>q.id),tests:testIds,classes:[0,1,2].map(i=>id(`class-${i}`)),materials:[0,1,2,3,4,5].map(i=>id(`material-${i}`))},null,2),{mode:0o600});
console.log(JSON.stringify({project:ref,version,records:audit.records.length,created:audit.records.filter(x=>x.action==='created').length,updated:audit.records.filter(x=>x.action==='updated').length,skipped:audit.records.filter(x=>x.action==='skipped').length,evidenceDir}));

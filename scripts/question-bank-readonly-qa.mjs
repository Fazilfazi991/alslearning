import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {login,anonymous} from './biochemistry-client.mjs';
import {productionImportClients} from './production-import-client.mjs';
const production=process.argv[2]==='production';
const db=production?(await productionImportClients()).admin:(await login()).db;
const report={target:production?'dvmahmkapgtjfqmoottt':'xstssknlgdraulebdsfd',measurements:[],checks:[],representatives:[]};
async function timed(name,q){const start=performance.now();const r=await q;if(r.error)throw r.error;report.measurements.push({name,ms:Math.round(performance.now()-start),rows:r.data?.length,bytes:Buffer.byteLength(JSON.stringify(r.data)),count:r.count});return r;}
const columns='id,prompt,subject_id,chapter_id,status,type,marks,source_label,source_reference,created_at';
const list=()=>db.from('questions').select(columns).order('created_at',{ascending:false}).order('id');
const first=await timed('first page',list().range(0,24));assert.equal(first.data.length,25);
const second=await timed('next page',list().range(25,49));assert.ok(!second.data.some(q=>first.data.some(p=>p.id===q.id)));
const total=await timed('exact total',db.from('questions').select('id',{head:true,count:'exact'}));assert.equal(total.count,production?2472:2533);
const subjects=(await timed('subjects',db.from('subjects').select('id,name'))).data;
const chapters=(await timed('chapters',db.from('chapters').select('id,name,subject_id'))).data;
for(const [name,active,draft] of [['Pathology',961,5],['Microbiology',791,2],['Biochemistry',708,5]]){
 const subject=subjects.find(s=>s.name===name);assert.ok(subject);
 for(const [status,expected] of [['active',active],['draft',draft]]){const r=await timed(`${name} ${status}`,db.from('questions').select(columns,{count:'exact'}).eq('subject_id',subject.id).eq('status',status).order('created_at',{ascending:false}).order('id').range(0,24));assert.equal(r.count,expected);assert.ok(r.data.every(q=>q.subject_id===subject.id&&q.status===status));}
 const chapter=chapters.find(c=>c.subject_id===subject.id);const scoped=await timed(`${name} section`,list().eq('subject_id',subject.id).eq('chapter_id',chapter.id).range(0,24));assert.ok(scoped.data.every(q=>q.chapter_id===chapter.id));
 const search=await timed(`${name} search`,list().eq('subject_id',subject.id).or('prompt.ilike."%glucose%",source_label.ilike."%glucose%",source_reference.ilike."%glucose%"').range(0,24));assert.ok(search.data.every(q=>[q.prompt,q.source_label,q.source_reference].some(v=>v?.toLowerCase().includes('glucose'))));
 report.checks.push(`${name}: active=${active}, draft=${draft}; subject/section/search correct`);
}
const empty=await timed('empty search',list().ilike('prompt','%__impossible_qa_text_6df04__%').range(0,24));assert.equal(empty.data.length,0);
const full='*,question_options!question_options_question_id_fkey(id,content,content_rich,display_order),question_answer_keys(option_id),question_media(*)';
for(const subject of subjects.filter(s=>['Pathology','Microbiology','Biochemistry'].includes(s.name))){
 const ordinary=(await list().eq('subject_id',subject.id).range(0,0)).data[0];
 const q=(await timed(`${subject.name} detail`,db.from('questions').select(full).eq('id',ordinary.id).single())).data;
 assert.equal(q.question_options.length,4);assert.ok(q.question_answer_keys.length);report.representatives.push({subject:subject.name,id:q.id,prompt:q.prompt.slice(0,100),options:q.question_options.length,answers:q.question_answer_keys.length});
}
if(!production){
 const student=(await login('student')).db;const anon=anonymous();
 for(const [name,client] of [['student',student],['anonymous',anon]])for(const [kind,q] of [['list',client.from('questions').select(columns).range(0,24)],['detail',client.from('questions').select(full).eq('id',first.data[0].id)]]){const r=await q;assert.ok(r.error||r.data.length===0,`${name} ${kind} denied`);report.checks.push(`${name} ${kind} denied`);}
 await student.auth.signOut({scope:'local'});
}
writeFileSync(`docs/question-bank-api-${production?'production':'qa'}-after.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await db.auth.signOut({scope:'local'});

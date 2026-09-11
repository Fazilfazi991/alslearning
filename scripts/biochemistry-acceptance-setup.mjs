import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {login,ok} from "./biochemistry-client.mjs";
import {identity,batch,sourceIdentity} from "./biochemistry-import-model.mjs";
const read=p=>JSON.parse(readFileSync(p,"utf8")),manifest=read("docs/biochemistry-import-manifest.json"),input=read(".local-qa/biochemistry-preflight-records.json");
const {db:admin}=await login(),{user:student}=await login("student");
async function row(table,id,value){return ok(await admin.from(table).select("*").eq("id",id).maybeSingle())||ok(await admin.from(table).insert({id,...value}).select().single());}
const program=await row("programs",identity(`${batch}:qa-program`),{exam_id:manifest.taxonomy.exam.id,name:"QA ONLY — Biochemistry import acceptance",slug:"qa-biochemistry-import-acceptance",status:"active",has_tests:true});
ok(await admin.rpc("core_program_subjects",{target_program:program.id,subject_ids:[manifest.taxonomy.subject.id]}));
const qaBatch=await row("batches",identity(`${batch}:qa-batch`),{program_id:program.id,exam_id:manifest.taxonomy.exam.id,name:"QA ONLY — Biochemistry acceptance",slug:"qa-biochemistry-import-acceptance",status:"active"});
await row("enrollments",identity(`${batch}:qa-enrollment`),{student_id:student.id,program_id:program.id,batch_id:qaBatch.id,status:"active",access_starts_at:new Date(Date.now()-60000).toISOString(),access_expires_at:new Date(Date.now()+86400000).toISOString()});
const picks=[[1,6],[1,28],[1,27],[2,25],[3,5],[4,5],[5,19],[5,28],[5,35],[5,34],[6,13],[7,46],[8,10],[8,24],[8,30]];
const selected=picks.map(([bio,n])=>input.find(q=>q.bio===bio&&q.source_sequence===n));
assert.ok(selected.every(q=>q.classification==="STRUCTURALLY READY"));
const questionIds=selected.map(q=>identity(sourceIdentity(q)));
const test={id:identity(`${batch}:qa-test`),title:"QA ONLY — Biochemistry import acceptance",type:"mock",exam_id:manifest.taxonomy.exam.id,program_id:program.id,subject_id:manifest.taxonomy.subject.id,chapter_id:null,topic_id:null,duration_minutes:90,question_count:questionIds.length,default_negative_marks:0,max_attempts:5,available_from:null,available_until:null,randomize_questions:false,randomize_options:false,show_results:true,show_answers:true,show_explanations:true,selection_mode:"manual",selection_rules:{},status:"active"};
ok(await admin.rpc("core_save_test",{value:test,question_ids:questionIds,batch_ids:[qaBatch.id]}));
writeFileSync(".local-qa/biochemistry-acceptance.json",JSON.stringify({test,program,qa_batch:qaBatch,student_id:student.id,question_ids:questionIds,selections:selected.map(q=>({bio:q.bio,source_sequence:q.source_sequence,question_id:identity(sourceIdentity(q)),native_tables:q.native_tables,explanation_length:q.explanation.length}))},null,2));
console.log(JSON.stringify({test_id:test.id,student_id:student.id,questions:questionIds.length,subjects:8}));

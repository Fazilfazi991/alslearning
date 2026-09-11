import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
const ref="xstssknlgdraulebdsfd";
if(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!==ref+".supabase.co")throw Error("QA target required");
const keys=await(await fetch("https://api.supabase.com/v1/projects/"+ref+"/api-keys",{headers:{Authorization:"Bearer "+process.env.SUPABASE_ACCESS_TOKEN}})).json();
const make=()=>createClient("https://"+ref+".supabase.co",keys.find(x=>x.name==="anon").api_key,{auth:{persistSession:false,autoRefreshToken:false}});
const db=make(),student=make(),ok=r=>{if(r.error)throw Error(r.error.message);return r.data;},checks=[];
function pass(label,value){assert.ok(value,label);checks.push(label);}
ok(await db.auth.signInWithPassword({email:"test-builder-20260911-admin@example.invalid",password:process.env.TEST_BUILDER_QA_PASSWORD}));
const auth=ok(await student.auth.signInWithPassword({email:"test-builder-20260911-student@example.invalid",password:process.env.TEST_BUILDER_QA_PASSWORD}));
const exams=ok(await db.from("entrance_exams").select("id,name"));const exam=exams.find(e=>e.name.includes("JSO")).id;
const subjects=ok(await db.from("subjects").select("id,name").in("name",["Pathology","Microbiology"]));
const questions=[];
for(const subject of subjects){
 const rows=ok(await db.from("questions").select("id,subject_id,chapter_id,status").eq("exam_id",exam).eq("subject_id",subject.id).eq("status","active").is("program_id",null).order("id").limit(8));
 questions.push(...rows);
}
async function record(table,slug,value){const existing=ok(await db.from(table).select("id").eq("slug",slug).maybeSingle());return existing?.id||ok(await db.from(table).insert({...value,slug}).select("id").single()).id;}
const program=await record("programs","scope-regression-20260911",{name:"QA ONLY — Test scope regression",exam_id:exam,status:"active",has_tests:true});
ok(await db.rpc("core_program_subjects",{target_program:program,subject_ids:subjects.map(s=>s.id)}));
const batch=await record("batches","scope-regression-20260911",{name:"QA ONLY — Scope regression batch",program_id:program,exam_id:exam,status:"active"});
if(!ok(await db.from("enrollments").select("id").eq("student_id",auth.user.id).eq("batch_id",batch).maybeSingle()))
 ok(await db.from("enrollments").insert({student_id:auth.user.id,program_id:program,batch_id:batch,status:"active",access_starts_at:new Date(Date.now()-60000).toISOString(),access_expires_at:new Date(Date.now()+86400000).toISOString()}));
const group=id=>questions.filter(q=>q.subject_id===id),first=subjects[0].id,second=subjects[1].id;
const scopes=subjects.map(s=>({subject_id:s.id,chapter_ids:[],count:2}));
const base={exam_id:exam,program_id:program,subject_id:null,chapter_id:null,topic_id:null,type:"mock",duration_minutes:30,default_negative_marks:0,max_attempts:5,show_results:true,show_answers:true,show_explanations:true,status:"draft",selection_mode:"manual",selection_rules:{},question_count:2};
async function save(value,ids){return ok(await db.rpc("core_save_test",{value,question_ids:ids,batch_ids:[batch]}));}
async function read(id){return ok(await db.from("tests").select("*,test_questions(question_id,display_order),test_batches(batch_id)").eq("id",id).single());}
const cases=[
 ["A existing single manual",{subject_id:first},group(first).slice(0,2).map(q=>q.id)],
 ["B existing mixed manual",{},[...group(first).slice(0,6),...group(second).slice(0,7)].map(q=>q.id)],
 ["C new single manual",{subject_id:second},group(second).slice(0,3).map(q=>q.id)],
 ["D new mixed manual",{selection_rules:{scopes}},[group(first)[0].id,group(second)[0].id]],
 ["E single random",{subject_id:first,selection_mode:"generated",question_count:2},[]],
 ["F multiple random",{selection_mode:"generated",selection_rules:{scopes},question_count:4,status:"active"},[]]
];
const saved=[];
for(const [label,extra,ids] of cases){
 const title="SCOPE QA — "+label;
 const old=ok(await db.from("tests").select("id").eq("title",title).maybeSingle());
 const id=await save({...base,...extra,title,...(old?{id:old.id}:{})},ids);
 let t=await read(id);
 const before=t.test_questions.sort((a,b)=>a.display_order-b.display_order).map(q=>q.question_id);
 if(label.startsWith("B")){
  t.selection_rules={scopes:subjects.map(s=>({subject_id:s.id,chapter_ids:[...new Set(questions.filter(q=>before.includes(q.id)&&q.subject_id===s.id).map(q=>q.chapter_id).filter(Boolean))]}))};
 }
 await save(t,before);t=await read(id);
 const after=t.test_questions.sort((a,b)=>a.display_order-b.display_order).map(q=>q.question_id);
 pass(label+" count preserved",after.length===before.length);
 pass(label+" no duplicate mappings",new Set(after).size===after.length);
 if(t.selection_mode==="manual")pass(label+" IDs and order unchanged",JSON.stringify(after)===JSON.stringify(before));
 if(label.startsWith("F")){
  assert.deepEqual(t.selection_rules.scopes,scopes);pass("multi random rules retained",true);
  const a=ok(await student.rpc("start_test_attempt",{target_test:id}));
  const chosen=ok(await db.from("questions").select("id,subject_id,status").in("id",a.question_order));
  for(const scope of scopes)pass("attempt quota "+scope.subject_id,chosen.filter(q=>q.subject_id===scope.subject_id).length===scope.count);
  pass("attempt only Active",chosen.every(q=>q.status==="active"));
  ok(await student.rpc("submit_test_attempt",{target_attempt:a.id}));
 }
 saved.push({label,id,title,count:t.question_count,ids:after});
}
const bad=await db.rpc("core_save_test",{value:{...base,title:"SCOPE QA — invalid",selection_mode:"generated",selection_rules:{scopes:[{...scopes[0],count:999999}]}},question_ids:[],batch_ids:[batch]});
pass("oversized quota rejected",!!bad.error);
const denied=await student.rpc("core_save_test",{value:{...base,title:"Denied"},question_ids:[],batch_ids:[batch]});pass("Student authoring denied",!!denied.error);
const draft=ok(await db.from("questions").select("id").eq("status","draft").eq("exam_id",exam).limit(1));
if(draft.length)pass("Draft question rejected",!!(await db.rpc("core_save_test",{value:{...base,title:"Denied draft"},question_ids:[draft[0].id],batch_ids:[batch]})).error);
await fs.writeFile(".local-qa/test-builder-db-qa.json",JSON.stringify({checks,saved,program,batch,subjects},null,2));
console.log(JSON.stringify({passed:checks.length,checks,saved:saved.map(s=>({label:s.label,id:s.id,title:s.title,count:s.count}))}));
await db.auth.signOut({scope:"local"});await student.auth.signOut({scope:"local"});

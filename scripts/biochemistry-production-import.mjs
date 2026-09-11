import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { productionImportClients } from "./production-import-client.mjs";
import { PRODUCTION } from "./helper-grants-lib.mjs";
import { verifySources } from "./biochemistry-production-baseline.mjs";
const ok=r=>{if(r.error)throw r.error;return r.data;};
assert.equal(process.env.ALS_PRODUCTION_IMPORT_REF,PRODUCTION);
assert.ok(existsSync(".local-qa/biochemistry-production-before.json"),"Capture baseline before any production write");
verifySources();
import { identity, batch, chapterNames, classify, sourceIdentity, questionPayload, projectQuestion, questionSelect } from "./biochemistry-import-model.mjs";
const read=p=>JSON.parse(readFileSync(p,"utf8"));
const hash=b=>createHash("sha256").update(b).digest("hex");
assert.equal(hash(readFileSync("docs/biochemistry-preflight.json")),"f7a9d8784748e08205b4a392d272f8e07ee3665614f213bad9d84b2dffcf5058","Approved preflight changed");
assert.equal(hash(readFileSync(".local-qa/biochemistry-preflight-records.json")),"61e4d592a5797a3738f851a7aaf63bb10fe59f257e60e76aac724ab9c2915656","Approved complete source payload changed");
const approved=read("docs/biochemistry-preflight.json"),input=read(".local-qa/biochemistry-preflight-records.json");
assert.deepEqual(["source","ready","review","quarantine","technical_blockers","images","native_tables"].map(k=>approved.totals[k]),[714,708,5,1,0,0,8]);
for(const f of approved.files)assert.equal(hash(readFileSync(`MOQ/${f.source_document}`)),f.sha256,"Source changed");
assert.equal(input.length,714);
assert.equal(new Set(input.map(sourceIdentity)).size,714);
for(const q of input){assert.equal(q.media.length,0);assert.equal(sourceIdentity(q),q.scoped_source_identity);}
assert.deepEqual(["active","draft","quarantine"].map(s=>input.filter(q=>classify(q)===s).length),[708,5,1]);
const {admin,fixture}=await productionImportClients();
const user=fixture.users.admin;
const file="docs/production-biochemistry-import-manifest.json",prior=existsSync(file)?read(file):null;
const run={new_subjects:0,new_chapters:0,new_questions:0,new_options:0,new_answer_keys:0,new_tables:0,new_import_identities:0,unchanged_questions:0,uploads:0,new_quarantine_duplicates:0};
const subjects=ok(await admin.from("subjects").select("*").or("slug.eq.biochemistry,name.ilike.Biochemistry"));
assert.ok(subjects.length<=1,"Duplicate canonical subject");
const subject=subjects[0]||ok(await admin.from("subjects").insert({id:identity("biochemistry:subject"),slug:"biochemistry",name:"Biochemistry",status:"active"}).select().single());
if(!subjects.length)run.new_subjects++;
assert.equal(subject.status,"active");
const exam=ok(await admin.from("entrance_exams").select("*").eq("slug","jso").single()),chapters=[];
const existingChapters=ok(await admin.from("chapters").select("*").eq("subject_id",subject.id));
for(const [i,name]of chapterNames.entries()){
  const found=existingChapters.filter(c=>c.slug===`bio-${i+1}`||c.name===name);
  assert.ok(found.length<=1,"Conflicting BIO chapter");
  if(found[0]){assert.equal(found[0].name,name);assert.equal(found[0].status,"active");}
  chapters.push(found[0]||ok(await admin.from("chapters").insert({id:identity(`biochemistry:chapter:${i+1}`),subject_id:subject.id,program_id:null,slug:`bio-${i+1}`,name,status:"active",display_order:i+1}).select().single()));
  if(!found.length)run.new_chapters++;
}
const taxonomy={subject,exam,chapters};
const expected=input.filter(q=>classify(q)!=="quarantine").map(q=>({q,value:questionPayload(q,taxonomy)}));
const existing=new Map();
for(let i=0;i<expected.length;i+=50)for(const row of ok(await admin.from("questions").select(questionSelect).in("id",expected.slice(i,i+50).map(x=>x.value.id))))existing.set(row.id,row);
for(const {value}of expected)if(existing.has(value.id))assert.deepEqual(projectQuestion(existing.get(value.id)),value,"Existing source changed: refusing overwrite");
const quarantined=input.filter(q=>classify(q)==="quarantine").map(q=>({...q,disposition:"Recoverable source manifest; never inserted as usable question"}));
writeFileSync("docs/production-biochemistry-quarantine.json",JSON.stringify(quarantined,null,2)+"\n");
const manifest={batch,production_project:PRODUCTION,authenticated_admin:user.id,approved_starting_sha:"e1e9fcc079b044fdf17dd9251a817d9fcd66dc57",preflight_sha256:hash(readFileSync("docs/biochemistry-preflight.json")),taxonomy,records:[],runs:prior?.runs||[]};
const progress=".local-qa/biochemistry-production-import-progress.json";
const checkpoint=()=>writeFileSync(progress,JSON.stringify({...manifest,runs:[...manifest.runs,run]},null,2)+"\n");
for(const [index,{q,value}]of expected.entries()){
  if(existing.has(value.id))run.unchanged_questions++;
  else{
    try{ok(await admin.rpc("core_save_question",{value}));}
    catch(error){manifest.failure={bio:q.bio,source_sequence:q.source_sequence,reason:error.message};checkpoint();throw error;}
    run.new_questions++;run.new_options+=value.options.length;run.new_answer_keys+=value.options.filter(o=>o.correct).length;run.new_tables+=q.native_tables;run.new_import_identities++;
  }
  manifest.records.push({question_id:value.id,source_identity:sourceIdentity(q),source_key:q.source_key,source_document:q.source_document,source_sha256:q.source_sha256,bio:q.bio,source_sequence:q.source_sequence,displayed_number:q.displayed_number,status:value.status,classification:q.classification,review_reasons:q.review_reasons,previous_paper_evidence:q.previous_paper_evidence,native_tables:q.native_tables});
  checkpoint();if(index%60===0)console.log(`Processed ${index+1}/713; new=${run.new_questions}; unchanged=${run.unchanged_questions}`);
}
for(const q of quarantined)manifest.records.push({question_id:null,source_identity:sourceIdentity(q),source_key:q.source_key,source_document:q.source_document,source_sha256:q.source_sha256,bio:q.bio,source_sequence:q.source_sequence,status:"quarantine",manifest:"docs/production-biochemistry-quarantine.json",reasons:q.quarantine_reasons});
manifest.records.sort((a,b)=>a.bio-b.bio||a.source_sequence-b.source_sequence);
assert.equal(manifest.records.length,714);assert.equal(run.new_questions+run.unchanged_questions,713);
checkpoint();renameSync(progress,file);console.log(JSON.stringify(run));

await admin.auth.signOut({scope:"local"});

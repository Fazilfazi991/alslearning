import assert from "node:assert/strict";
import { readFileSync,writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { productionImportClients } from "./production-import-client.mjs";
import { query,PRODUCTION,QA } from "./helper-grants-lib.mjs";
const {admin}=await productionImportClients();
const subject=process.argv[2];assert.ok(["pathology","microbiology"].includes(subject));
const model=await import(`./${subject}-import-model.mjs`);
const manifest=JSON.parse(readFileSync(`docs/production-${subject}-import-manifest.json`));
assert.equal(manifest.production_project,PRODUCTION);
const input=JSON.parse(readFileSync(subject==='pathology'?'.local-qa/pathology-import-input.json':'.local-qa/microbiology-preflight-records.json'));
const expected=input.filter(q=>model.classify(q)!=='quarantine');
const ok=r=>{if(r.error)throw r.error;return r.data;};
const rows=[];
for(let i=0;i<expected.length;i+=60)rows.push(...ok(await admin.from('questions').select(model.questionSelect).in('id',expected.slice(i,i+60).map(q=>model.identity(q.source_key)))));
assert.equal(rows.length,expected.length);
const byId=new Map(rows.map(r=>[r.id,r]));const groups={};const assets=[];let tables=0,emfs=0;
for(const q of input){const key=subject==='pathology'?`PATHO ${q.subhead}`:`MICRO ${q.micro}`;const g=groups[key]??={source:0,active:0,draft:0,quarantine:0};g.source++;const status=model.classify(q);g[status]++;
 if(status==='quarantine'){assert.equal(ok(await admin.from('questions').select('id').eq('id',model.identity(q.source_key))).length,0);continue;}
 const value=model.questionPayload(q,manifest.taxonomy,manifest.upload_owner);const row=byId.get(value.id);assert.deepEqual(model.projectQuestion(row),value,`${key} Q${q.source_sequence} complete payload`);
 for(const k of row.question_answer_keys)assert.ok(row.question_options.some(o=>o.id===k.option_id));
 tables+=q.native_tables||0;
 for(const m of value.media){assets.push({path:m.storage_path,hash:m.source.conversion?.display_sha256||m.source.sha256});if(m.source.original){emfs++;assets.push({path:m.source.original.storage_path,hash:m.source.original.sha256});}}
}
for(let i=0;i<assets.length;i+=4)await Promise.all(assets.slice(i,i+4).map(async a=>{const blob=ok(await admin.storage.from('question-media').download(a.path));assert.equal(createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex'),a.hash); }));
const media=rows.reduce((n,r)=>n+r.question_media.length,0);
assert.equal(media,subject==='pathology'?8:116);assert.equal(emfs,subject==='pathology'?0:11);
if(subject==='microbiology'){assert.equal(tables,24);const q=expected.find(q=>q.micro===4&&q.source_sequence===71);const r=byId.get(model.identity(q.source_key));assert.equal(r.prompt,'');assert.equal(r.question_media.filter(m=>m.kind==='stem').length,1);}
else{const q=expected.find(q=>q.subhead===1&&q.source_sequence===190);const r=byId.get(model.identity(q.source_key));assert.equal(r.status,'draft');assert.equal(r.question_media.length,4);assert.ok(r.question_media.some(m=>m.mime_type==='image/gif'));}
const report={project:PRODUCTION,subject,groups,completePayloadsVerified:rows.length,options:rows.reduce((n,r)=>n+r.question_options.length,0),answerKeys:rows.reduce((n,r)=>n+r.question_answer_keys.length,0),media,assetsHashed:assets.length,tables,emfs,derivatives:emfs,runs:manifest.runs};
const qa=await query(QA,"select (select count(*) from auth.users) users,(select count(*) from public.questions) questions,(select count(*) from public.question_options) options,(select count(*) from public.question_answer_keys) keys,(select count(*) from public.question_media) media,(select count(*) from storage.objects) objects,(select count(*) from public.tests) tests,(select count(*) from public.test_attempts) attempts");
assert.deepEqual(qa,JSON.parse(readFileSync('.local-qa/production-import-qa-before.json')),'QA counts unchanged');report.qaUnchanged=true;
writeFileSync(`docs/production-${subject}-verification.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
await admin.auth.signOut({scope:"local"});

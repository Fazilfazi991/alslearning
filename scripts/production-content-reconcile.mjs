import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {query,PRODUCTION,QA,catalogSql} from "./helper-grants-lib.mjs";
assert.equal(process.env.ALS_PRODUCTION_IMPORT_REF,PRODUCTION);
const [r]=await query(PRODUCTION,`select jsonb_build_object(
'questions',(select count(*) from public.questions),'active',(select count(*) from public.questions where status='active'),'draft',(select count(*) from public.questions where status='draft'),
'users',(select count(*) from auth.users),'admins',(select count(*) from public.profiles where role='admin' and is_active),'tests',(select count(*) from public.tests),'attempts',(select count(*) from public.test_attempts),
'options',(select count(*) from public.question_options),'keys',(select count(*) from public.question_answer_keys),'media',(select count(*) from public.question_media),'objects',(select count(*) from storage.objects),'chapters',(select count(*) from public.chapters),
'native_tables',(select sum(jsonb_array_length(jsonb_path_query_array(coalesce(prompt_rich,'{}'::jsonb),'strict $.** ? (@.type == "table")'))+jsonb_array_length(jsonb_path_query_array(coalesce(explanation_rich,'{}'::jsonb),'strict $.** ? (@.type == "table")'))) from public.questions),
'emf_originals',(select count(*) from public.question_media where source#>>'{original,mime_type}'='image/x-emf'),
'png_derivatives',(select count(*) from public.question_media where source ? 'conversion' and mime_type='image/png'),
'orphan_options',(select count(*) from public.question_options o left join public.questions q on q.id=o.question_id where q.id is null),
'orphan_keys',(select count(*) from public.question_answer_keys k left join public.question_options o on o.id=k.option_id and o.question_id=k.question_id where o.id is null),
'orphan_media',(select count(*) from public.question_media m left join public.questions q on q.id=m.question_id where q.id is null),
'missing_objects',(select count(*) from public.question_media m where not exists(select 1 from storage.objects o where o.bucket_id='question-media' and o.name=m.storage_path) or (m.source#>>'{original,storage_path}' is not null and not exists(select 1 from storage.objects o where o.bucket_id='question-media' and o.name=m.source#>>'{original,storage_path}'))),
'unreferenced_objects',(select count(*) from storage.objects o where o.bucket_id='question-media' and not exists(select 1 from public.question_media m where o.name=m.storage_path or o.name=m.source#>>'{original,storage_path}')),
'duplicate_identities',(select count(*) from (select substring(source_label from 'source=(.*)$') from public.questions group by 1 having count(*)>1) x),
'duplicate_taxonomy',(select count(*) from (select subject_id,slug from public.chapters group by 1,2 having count(*)>1) x),
'public_buckets',(select count(*) from storage.buckets where public),
'groups',(select jsonb_agg(to_jsonb(x)) from (select c.slug,count(q.id) as questions,count(q.id) filter(where q.status='active') as active,count(q.id) filter(where q.status='draft') as draft from public.chapters c left join public.questions q on q.chapter_id=c.id group by c.slug order by c.slug) x)
) as result`);
const c=r.result;
for(const [k,v] of Object.entries({questions:1759,active:1752,draft:7,users:1,admins:1,tests:0,attempts:0,options:7036,keys:1759,media:124,objects:135,chapters:13,native_tables:24,emf_originals:11,png_derivatives:11,orphan_options:0,orphan_keys:0,orphan_media:0,missing_objects:0,unreferenced_objects:0,duplicate_identities:0,duplicate_taxonomy:0,public_buckets:0}))assert.equal(c[k],v,k);
const manifests=['pathology','microbiology'].map(s=>JSON.parse(readFileSync(`docs/production-${s}-import-manifest.json`)));
const quarantined=manifests.flatMap(m=>m.records.filter(r=>r.status==='quarantine'));
assert.equal(quarantined.length,6);assert.equal(manifests.reduce((n,m)=>n+m.records.length,0),1765);
for(const m of manifests){assert.ok(m.runs.length>=2);const run=m.runs.at(-1);assert.equal(run.created,0);assert.equal(run.uploaded,0);assert.equal(run.failed,0);}
// No fake accounts or tests: an unrelated authenticated UID must have no access.
const uid=randomUUID();
await query(PRODUCTION,`begin;
select set_config('request.jwt.claim.sub','${uid}',true),set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true);
set local role authenticated;
do $probe$ begin
 if exists(select 1 from public.questions) or exists(select 1 from public.question_answer_keys) then raise exception 'Unauthorized bank/key visibility'; end if;
 if public.core_test_bank()<>'[]'::jsonb then raise exception 'Unauthorized test bank'; end if;
end $probe$;
reset role;
do $probe$ begin
 if exists(select 1 from public.question_media where private.image_access(storage_path) or private.image_access(source#>>'{original,storage_path}')) then raise exception 'Cross-user media authorization'; end if;
end $probe$;
rollback;`);
const inventory=(await query(PRODUCTION,catalogSql))[0].inventory;
const baseline=JSON.parse(readFileSync('.local-qa/production-import-security-baseline.json'));
assert.deepEqual(inventory.policies,baseline.policies);
for(const f of baseline.functions){const now=inventory.functions.find(n=>n.schema===f.schema&&n.name===f.name&&n.arguments===f.arguments);assert.deepEqual(now,f,`${f.name} unchanged`);}
const bank=inventory.functions.find(f=>f.name==='core_test_bank');assert.ok(bank.definition.includes("q.status='active'"));
const authoring=inventory.functions.find(f=>f.name==='core_save_test');assert.ok(authoring.definition.includes("q.status='active'"));
const qa=await query(QA,"select (select count(*) from auth.users) users,(select count(*) from public.questions) questions,(select count(*) from public.question_options) options,(select count(*) from public.question_answer_keys) keys,(select count(*) from public.question_media) media,(select count(*) from storage.objects) objects,(select count(*) from public.tests) tests,(select count(*) from public.test_attempts) attempts");assert.deepEqual(qa,JSON.parse(readFileSync('.local-qa/production-import-qa-before.json')));
writeFileSync('docs/production-content-reconciliation.json',JSON.stringify({project:PRODUCTION,counts:c,quarantine:quarantined,runs:manifests.map(m=>({batch:m.batch,runs:m.runs})),security:{unchanged:true,crossUserDenied:true,activeSelectionPredicateVerified:true,noStudentTeacherFixtures:true,studentReviewRuntimeProbe:'Not run: no production tests or Student accounts created; approved function definition unchanged'},qaUnchanged:true},null,2)+'\n');
console.log(JSON.stringify(c));

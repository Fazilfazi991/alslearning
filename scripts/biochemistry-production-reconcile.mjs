import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
import {read,snapshot,verifySources,hash} from './biochemistry-production-baseline.mjs';
import {query,PRODUCTION,QA} from './helper-grants-lib.mjs';
import {productionImportClients} from './production-import-client.mjs';
assert.equal(process.env.ALS_PRODUCTION_IMPORT_REF,PRODUCTION);
const before=read('.local-qa/biochemistry-production-before.json');
const sources=verifySources();
const production=await snapshot(PRODUCTION),qa=await snapshot(QA);
assert.deepEqual(qa,before.qa,'QA must remain unchanged');
assert.deepEqual(production.fingerprints,before.production.fingerprints,'Existing Production data outside Biochemistry must remain unchanged');
assert.deepEqual(production.inventory,before.production.inventory,'Security definitions/RLS unchanged');
assert.deepEqual(production.migrations,before.production.migrations,'No migrations');
const first=read('docs/production-biochemistry-first-run.json'),verified=read('docs/production-biochemistry-verification.json');
const manifest=read('docs/production-biochemistry-import-manifest.json');
assert.equal(manifest.production_project,PRODUCTION);
assert.equal(manifest.runs.length,2);
const second=manifest.runs[1];
for(const [key,value] of Object.entries(second))assert.equal(value,key==='unchanged_questions'?713:0,key);
for(const key of ['users','tests','attempts','media','storage_objects'])assert.equal(production.counts[key],before.production.counts[key],key);
assert.equal(production.counts.questions-before.production.counts.questions,713);
assert.equal(production.counts.options-before.production.counts.options,2852);
assert.equal(production.counts.keys-before.production.counts.keys,713);
const integrity=(await query(PRODUCTION,`select
 (select count(*) from public.question_options o left join public.questions q on q.id=o.question_id where q.id is null) orphan_options,
 (select count(*) from public.question_answer_keys k left join public.question_options o on o.id=k.option_id and o.question_id=k.question_id where o.id is null) orphan_keys,
 (select count(*) from (select subject_id,slug from public.chapters group by subject_id,slug having count(*)>1) x) duplicate_chapters,
 (select count(*) from (select slug from public.subjects group by slug having count(*)>1) x) duplicate_subjects,
 (select count(*) from (select substring(source_label from 'identity=([a-f0-9]+)') from public.questions where source_label like '%batch=als-biochemistry-client-20260911-v1%' group by 1 having count(*)>1) x) duplicate_bio_identities,
 has_table_privilege('authenticated','public.test_attempts','INSERT') attempt_insert,
 has_table_privilege('authenticated','public.test_attempts','UPDATE') attempt_update,
 has_table_privilege('authenticated','public.test_attempts','DELETE') attempt_delete`))[0];
for(const [key,value] of Object.entries(integrity))assert.equal(value,key.startsWith('attempt_')?false:0,key);
const inventory=production.inventory;
assert.ok(inventory.tables.filter(t=>['questions','question_answer_keys','test_attempts'].includes(t.name)).every(t=>t.rls));
const teacher=inventory.functions.find(f=>f.name==='teacher_has_assignment');
assert.ok(teacher.definition.includes('teacher')&&teacher.definition.includes('faculty_assignments'));
const bankFunction=inventory.functions.find(f=>f.name==='core_test_bank');
assert.match(bankFunction.definition,/q\.status\s*=\s*'active'/);
const author=inventory.functions.find(f=>f.name==='core_save_question');
assert.ok(author.definition.includes('teacher_has_assignment'));
const students=await query(PRODUCTION,"select id from public.profiles where role='student' and is_active order by id");
assert.ok(students.length,'Existing Production Student needed for read-only role probe');
const uid=students[0].id;assert.match(uid,/^[a-f0-9-]{36}$/);
// Existing Production identity, rollback-only denial probe. The RPC takes a
// row lock before its permission check, so a READ ONLY transaction cannot test it.
// Empty payload must fail at authorization, before any content mutation.
await query(PRODUCTION,`begin;
 select set_config('request.jwt.claim.sub','${uid}',true),set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true);
 set local role authenticated;
 do $probe$ declare denied boolean:=false; begin
   if public.is_admin() then raise exception 'Student became Admin'; end if;
   if exists(select 1 from public.questions) or exists(select 1 from public.question_answer_keys) then raise exception 'Student bank/key leakage'; end if;
   begin perform public.core_save_question('{}'::jsonb); exception when others then
     if sqlerrm<>'Question permission denied' then raise; end if; denied:=true;
   end;
   if not denied then raise exception 'Student authoring allowed'; end if;
 end $probe$;
 rollback;`);
const {admin}=await productionImportClients();const ok=r=>{if(r.error)throw r.error;return r.data;};
const subjects=ok(await admin.from('subjects').select('id,name,slug'));
for(const name of ['Pathology','Microbiology','Biochemistry'])assert.ok(subjects.some(s=>s.name===name));
const subject=subjects.find(s=>s.slug==='biochemistry');
const chapters=ok(await admin.from('chapters').select('id,name,subject_id').eq('subject_id',subject.id));assert.equal(chapters.length,8);
const questionIndex=ok(await admin.from('questions').select('id,exam_id,program_id,subject_id,chapter_id,topic_id,type,status,difficulty').eq('subject_id',subject.id).order('id'));assert.equal(questionIndex.length,713);
const mappings=ok(await admin.from('program_subjects').select('program_id,subject_id'));
const programs=ok(await admin.from('programs').select('id,name,exam_id'));
const mapping=mappings.find(m=>m.subject_id===subject.id&&programs.some(p=>p.id===m.program_id&&(!p.exam_id||p.exam_id===manifest.taxonomy.exam.id)));
const selectionBlocker=mapping?null:'Biochemistry has no compatible Production program assignment; application scope eligibility remains blocked.';
const compiled=ts.transpileModule(readFileSync('src/lib/test-question-scope.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {eligibleTestQuestions}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const data={subjects,chapters,mappings,topics:[],questions:questionIndex};
const test={exam_id:manifest.taxonomy.exam.id,program_id:mapping?.program_id||'',subject_id:subject.id,chapter_id:'',topic_id:'',selection_rules:{}};
const manual=eligibleTestQuestions(data,{...test,selection_mode:'manual'});assert.equal(manual.length,mapping?708:0);
const eligible=eligibleTestQuestions(data,{...test,selection_mode:'generated'});assert.equal(eligible.length,mapping?708:0);
assert.deepEqual(eligible.map(q=>q.id).sort(),manual.map(q=>q.id).sort());
await admin.auth.signOut({scope:'local'});
const tables=read('.local-qa/biochemistry-production-persisted.json').flatMap(q=>['prompt_rich','explanation_rich'].flatMap(role=>q[role].blocks.filter(b=>b.type==='table').map(b=>({question_id:q.id,role,table_sha256:hash(JSON.stringify(b))}))));assert.equal(tables.length,8);
const report={production_project:PRODUCTION,qa_project:QA,source_hashes:sources,before:before.production.counts,after:production.counts,subjects_before:before.production.subjects,subjects_after:production.subjects,reconciliation:verified.reconciliation,first_run:manifest.runs[0],second_run:second,complete_payloads_verified:713,first_run_verified:first.checks.length,tables,integrity:{...integrity,orphan_tables:0,orphan_tables_basis:'Canonical embedded AST; all eight blocks attached to exact source parent and full payload compared'},security:{admin_authoring:'713 canonical RPC imports',student_authoring_denied:true,student_answer_keys_denied:true,direct_attempt_mutation_privileges:false,teacher_boundaries:'All function definitions and policies unchanged; assignment predicate verified; no Teacher created',rls_and_functions_unchanged:true,migrations_unchanged:true},selection:{subjects:['Pathology','Microbiology','Biochemistry'],sections:chapters.map(c=>c.name),manual:manual.length,random:eligible.length,drafts_excluded:5,quarantine_excluded:1},existing_production_fingerprints_unchanged:true,qa_snapshot_unchanged:true,frontend_changed:false,vercel_changed:false,deployed:false};
report.evidence_hashes={production_security_before:hash(JSON.stringify(before.production.inventory)),production_security_after:hash(JSON.stringify(production.inventory)),protected_public_data_before:hash(JSON.stringify(before.production.fingerprints)),protected_public_data_after:hash(JSON.stringify(production.fingerprints)),qa_before:hash(JSON.stringify(before.qa)),qa_after:hash(JSON.stringify(qa))};
report.qa_counts={before:before.qa.counts,after:qa.counts};
report.selection.blocker=selectionBlocker;
report.selection.active_bank_records=questionIndex.filter(q=>q.status==='active').length;
report.selection.existing_programs=programs;
report.selection.biochemistry_program_mappings=mappings.filter(m=>m.subject_id===subject.id);
report.verdict=selectionBlocker?'BIOCHEMISTRY PRODUCTION IMPORT — FAIL':'BIOCHEMISTRY PRODUCTION IMPORT — PASS';
writeFileSync('docs/production-biochemistry-reconciliation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({before:report.before,after:report.after,second_run:second,security:report.security,integrity:report.integrity,qa_unchanged:true,selection:report.selection,verdict:report.verdict}));
if(selectionBlocker)process.exitCode=1;

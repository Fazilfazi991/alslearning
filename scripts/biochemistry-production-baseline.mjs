import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {query,PRODUCTION,QA,catalogSql} from './helper-grants-lib.mjs';
export const read=p=>JSON.parse(readFileSync(p,'utf8'));
export const hash=x=>createHash('sha256').update(x).digest('hex');
export function verifySources(){
  const manifest=read('docs/biochemistry-import-manifest.json');
  assert.equal(manifest.qa_project,QA);
  assert.equal(manifest.records.length,714);
  const files=new Map(manifest.records.map(r=>[r.source_document,r.source_sha256]));
  assert.equal(files.size,8);
  for(const [name,sha] of files)assert.equal(hash(readFileSync(`MOQ/${name}`)),sha,`SOURCE HASH MISMATCH: ${name}`);
  return [...files].map(([file,sha256])=>({file,sha256}));
}
export async function snapshot(ref){
  const [counts]=await query(ref,`select
    (select count(*) from auth.users) users,
    (select count(*) from public.tests) tests,
    (select count(*) from public.test_attempts) attempts,
    (select count(*) from public.questions) questions,
    (select count(*) from public.question_options) options,
    (select count(*) from public.question_answer_keys) keys,
    (select count(*) from public.question_media) media,
    (select count(*) from storage.objects) storage_objects,
    (select count(*) from public.subjects) subjects,
    (select count(*) from public.chapters) chapters`);
  const subjects=await query(ref,`select s.slug,count(q.id) questions,count(q.id) filter(where q.status='active') active,count(q.id) filter(where q.status='draft') draft from public.subjects s left join public.questions q on q.subject_id=s.id group by s.slug order by s.slug`);
  const tables=await query(ref,`select tablename from pg_tables where schemaname='public' order by tablename`);
  const fingerprints={}, fingerprintQueries=[];
  for(const {tablename:t} of tables){
    assert.match(t,/^[a-z_]+$/);
    // Production content outside the authorized Biochemistry subject is protected.
    let filter='';
    if(ref===PRODUCTION){
      if(t==='subjects')filter="where slug<>'biochemistry'";
      else if(t==='chapters'||t==='questions')filter="where subject_id not in (select id from public.subjects where slug='biochemistry') or subject_id is null";
      else if(['question_options','question_answer_keys','question_media'].includes(t))filter="where question_id not in (select q.id from public.questions q join public.subjects s on s.id=q.subject_id where s.slug='biochemistry')";
    }
    fingerprintQueries.push(`select '${t}' tablename,count(*) count,md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) hash from (select * from public.${t} ${filter}) r`);
  }
  for(const {tablename,count,hash} of await query(ref,fingerprintQueries.join(' union all ')))fingerprints[tablename]={count,hash};
  const inventory=(await query(ref,catalogSql))[0].inventory;
  // pg_class ordering is unspecified; normalize before comparing catalogs.
  inventory.tables.sort((a,b)=>(a.schema+'.'+a.name).localeCompare(b.schema+'.'+b.name));
  const migrations=await query(ref,'select version from supabase_migrations.schema_migrations order by version');
  return {counts,subjects,fingerprints,inventory,migrations};
}
if(process.argv[2]==='capture'){
  assert.equal(process.env.ALS_PRODUCTION_IMPORT_REF,PRODUCTION);
  const file='.local-qa/biochemistry-production-before.json';
  assert.ok(!existsSync(file),'Never overwrite the pre-import baseline');
  const sources=verifySources();
  const production=await snapshot(PRODUCTION),qa=await snapshot(QA);
  writeFileSync(file,JSON.stringify({production_project:PRODUCTION,qa_project:QA,sources,production,qa},null,2));
  console.log(JSON.stringify({sources:sources.length,production:production.counts,subjects:production.subjects,qa:qa.counts}));
}

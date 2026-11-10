// Run only against a disposable localhost Postgres instance. No staging
// credentials, production connections or destructive cleanup are used.
// ALS_DRIFT_MIGRATIONS_DIR is the reviewed local checkout containing the six
// hosted staging migrations; do not copy those unrelated migrations into PR #6.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const exe=process.env.ALS_TEST_PSQL,port=process.env.ALS_TEST_PGPORT,extraDir=process.env.ALS_DRIFT_MIGRATIONS_DIR;
assert.ok(exe,'Set ALS_TEST_PSQL to a local psql executable');
assert.match(port||'',/^\d{4,5}$/,'Set ALS_TEST_PGPORT for a disposable localhost database');
assert.ok(extraDir,'Set ALS_DRIFT_MIGRATIONS_DIR to the reviewed local migrations directory');
const expected=[
 '20261017062115_batch_live_eligibility_and_capacity.sql',
 '20261017065945_live_owner_returning_and_effective_membership.sql',
 '20261017070622_lms_legacy_capacity_guard_consistency.sql',
 '20261017071325_scheduled_student_transfers.sql',
 '20261017071924_transfer_live_access_revocation.sql',
 '20261017072114_batch_capacity_current_roster_guard.sql',
];
const database=`als_registration_drift_${Date.now()}`, marker=randomUUID();
function sql(input,db=database){
 const r=spawnSync(exe,['-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',maxBuffer:20_000_000});
 assert.equal(r.status,0,r.stderr||String(r.error));return r.stdout.trim();
}
sql(`create database ${database}`,'postgres');
sql(`comment on database ${database} is 'als-registration-staging-drift:${marker}'`);
sql(readFileSync('scripts/fixtures/helper-grants-provider.sql','utf8'));
sql(`alter table auth.users add column banned_until timestamptz,add column email_confirmed_at timestamptz;
create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)]$$;
create publication supabase_realtime;create schema realtime;create table realtime.messages(id bigint generated always as identity,extension text);
alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;grant execute on function realtime.topic() to authenticated;`);
const absent='20261004104013_production_live_cleanup_access.sql';
const local=readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql'));
assert.ok(local.includes(absent),'Expected missing-hosted migration was not present locally; reassess drift');
const entries=local.filter(x=>x!==absent).map(file=>({file,path:join('supabase/migrations',file)}));
for(const file of expected){assert.ok(!local.includes(file),`Extra migration now present locally: ${file}`);entries.push({file,path:join(extraDir,file)});}
entries.sort((a,b)=>a.file.localeCompare(b.file));
for(const migration of entries){
 try{
  let content=readFileSync(migration.path,'utf8');
  if(migration.file==='20261017071325_scheduled_student_transfers.sql'){
   const marker='-- This is an academic transfer job.';
   assert.ok(content.includes(marker),'Scheduled transfer cron boundary changed; reassess shim');
   // Stock local Postgres lacks Supabase's pg_cron extension. The transfer
   // tables, functions and triggers execute; only this final scheduler is omitted.
   content=content.slice(0,content.indexOf(marker));
  }
  sql(`begin;\n${content}\ncommit;`);
 }catch(error){throw Error(`${migration.file}: ${error.message}`);}
}
for(const test of ['docs/registration-prototype-test.sql','supabase/tests/registration_submission_conflicts.sql','supabase/tests/registration_identity_proof.sql','supabase/tests/registration_existing_approval.sql']){
 try{sql(readFileSync(test,'utf8'));}catch(error){throw Error(`${test}: ${error.message}`);}
}
console.log(`PASS: ${entries.length} local migrations replayed including six staging extras; ${absent} and hosted cron scheduling omitted; four registration SQL suites passed. Database ${database}. This does not establish hosted schema or data parity.`);

// Run ONLY against a marked disposable localhost database BEFORE installing the
// capacity migration. The script applies the migration after its lock test.
import {spawn,spawnSync} from 'node:child_process'; import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
const exe=process.env.ALS_TEST_PSQL,port=process.env.ALS_TEST_PGPORT,db=process.env.ALS_CAPACITY_TEST_DB;
assert.ok(exe,'Set ALS_TEST_PSQL');assert.match(port||'',/^\d{4,5}$/,'Set ALS_TEST_PGPORT');assert.match(db||'',/^[a-z0-9_]+$/,'Set ALS_CAPACITY_TEST_DB');
const args=['-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
function sql(input){const r=spawnSync(exe,args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.match(sql("select coalesce(shobj_description(oid,'pg_database'),'') from pg_database where datname=current_database()"),/^(als-registration-staging-drift:|als-batch-guard:|ALS registration QA disposable)/);
assert.equal(sql("select to_regprocedure('private.lms_capacity_legacy_row_mode()') is null"),'t','Capacity migration already applied');
const migration='supabase/migrations/20261110080919_student_registration_capacity_guard.sql';
const outside=spawnSync(exe,[...args,'-f',migration],{encoding:'utf8'});
assert.notEqual(outside.status,0,'Migration unexpectedly ran without an explicit transaction');assert.match(outside.stderr,/LOCK TABLE can only be used in transaction blocks/i);
assert.equal(sql("select to_regprocedure('private.lms_capacity_legacy_row_mode()') is null"),'t','Nontransactional migration left partial functions');
// Fixture deliberately exceeds capacity inside a transaction on this marked
// disposable database. The failed migration and fixture both roll back.
const overfull=spawnSync(exe,args,{encoding:'utf8',input:`begin;
insert into public.programs(id,slug,name,status) values('f9000000-0000-4000-8000-000000000001','qa-overfull','QA overfull','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values('f9000000-0000-4000-8000-000000000002','f9000000-0000-4000-8000-000000000001','qa-overfull','QA overfull','OVERFULL','active',1);
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('f9000000-0000-4000-8000-000000000011','overfull1@example.invalid','{"role":"student"}','{"full_name":"One"}'),('f9000000-0000-4000-8000-000000000012','overfull2@example.invalid','{"role":"student"}','{"full_name":"Two"}');
alter table public.enrollments disable trigger user;
insert into public.enrollments(student_id,program_id,batch_id,status) values('f9000000-0000-4000-8000-000000000011','f9000000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000002','active'),('f9000000-0000-4000-8000-000000000012','f9000000-0000-4000-8000-000000000001','f9000000-0000-4000-8000-000000000002','active');
alter table public.enrollments enable trigger user;
${readFileSync(migration,'utf8')}
commit;`});
assert.notEqual(overfull.status,0,'Over-capacity preflight unexpectedly passed');assert.match(overfull.stderr,/Resolve over-capacity reservations/i);
assert.equal(sql("select to_regprocedure('private.lms_capacity_legacy_row_mode()') is null"),'t','Failed preflight left partial functions');
assert.equal(sql("select count(*) from public.programs where id='f9000000-0000-4000-8000-000000000001'"),'0','Failed preflight left fixtures');
const unknown=spawnSync(exe,args,{encoding:'utf8',input:`begin;
create or replace function private.lms_enrollment_capacity_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end $$;
${readFileSync(migration,'utf8')}
commit;`});
assert.notEqual(unknown.status,0,'Unknown guard unexpectedly accepted');assert.match(unknown.stderr,/Unrecognized enrollment capacity guard/i);
assert.equal(sql("select to_regprocedure('private.lms_capacity_legacy_row_mode()') is null"),'t','Unknown-guard failure left partial functions');
function run(input){return new Promise((resolve,reject)=>{const c=spawn(exe,args,{stdio:['pipe','pipe','pipe']});let out='',err='';c.stdout.on('data',x=>out+=x);c.stderr.on('data',x=>err+=x);c.on('error',reject);c.on('close',code=>resolve({code,out,err}));c.stdin.end(input);});}
(async()=>{
 const writer=run("begin; lock table public.profiles in row exclusive mode; select pg_sleep(7); commit;");
 await new Promise(r=>setTimeout(r,500));
 const candidate=spawnSync(exe,[...args,'-1','-f',migration],{encoding:'utf8'});
 assert.notEqual(candidate.status,0,'Migration did not time out while writers held the lock');assert.match(candidate.stderr,/lock timeout/i);
 assert.equal(sql("select to_regprocedure('private.lms_capacity_legacy_row_mode()') is null"),'t','Timed-out migration left partial functions');
 const done=await writer;assert.equal(done.code,0,done.err);
 const installed=spawnSync(exe,[...args,'-1','-f',migration],{encoding:'utf8'});assert.equal(installed.status,0,installed.stderr);
 assert.equal(sql("select to_regprocedure('public.registration_batch_occupancy()') is not null"),'t');
 console.log('PASS transaction required; over-capacity, unknown guard and bounded lock timeout roll back; install succeeds after writer commits');
})().catch(e=>{console.error(e);process.exitCode=1});

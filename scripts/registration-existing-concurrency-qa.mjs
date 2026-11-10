// Only use a disposable loopback database produced by registration-teacher-order-qa.
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const exe=process.env.ALS_TEST_PSQL,port=process.env.ALS_TEST_PGPORT,db='registration_teacher_compat';
assert.ok(exe,'Set ALS_TEST_PSQL'); assert.match(port||'',/^\d{4,5}$/,'Set ALS_TEST_PGPORT');
const args=['-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
function sql(input){const r=spawnSync(exe,args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr||String(r.error));return r.stdout.trim();}
assert.equal(sql("select coalesce(shobj_description(oid,'pg_database'),'') from pg_database where datname=current_database()"),'ALS registration QA disposable','Refusing to run against an unmarked database');
sql(`insert into public.programs(id,slug,name,status) values
('e0000000-0000-4000-8000-000000000001','race-seat','Seat race','active'),('e0000000-0000-4000-8000-000000000002','race-app','Application race','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values
('e0000000-0000-4000-8000-000000000011','e0000000-0000-4000-8000-000000000001','race-seat','Seat batch','RACESEAT','active',1),('e0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000002','race-app','Application batch','RACEAPP','active',3);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('e0000000-0000-4000-8000-000000000021','race1@example.invalid',now(),'{"role":"student"}','{"full_name":"Race One"}'),
('e0000000-0000-4000-8000-000000000022','race2@example.invalid',now(),'{"role":"student"}','{"full_name":"Race Two"}'),
('e0000000-0000-4000-8000-000000000023','race3@example.invalid',now(),'{"role":"student"}','{"full_name":"Race Three"}');
select public.submit_student_registration('Race One','race1@example.invalid','+919876543251','BSc','QA institution','e0000000-0000-4000-8000-000000000001',null,null,true,'e0000000-0000-4000-8000-000000000031',repeat('a',64),repeat('1',64),repeat('1',64),null);
select public.submit_student_registration('Race Two','race2@example.invalid','+919876543252','BSc','QA institution','e0000000-0000-4000-8000-000000000001',null,null,true,'e0000000-0000-4000-8000-000000000032',repeat('a',64),repeat('2',64),repeat('2',64),null);
select public.submit_student_registration('Race Three','race3@example.invalid','+919876543253','BSc','QA institution','e0000000-0000-4000-8000-000000000002',null,null,true,'e0000000-0000-4000-8000-000000000033',repeat('a',64),repeat('3',64),repeat('3',64),null);
select public.record_registration_identity_proof('e0000000-0000-4000-8000-000000000031','e0000000-0000-4000-8000-000000000021','race1@example.invalid');
select public.record_registration_identity_proof('e0000000-0000-4000-8000-000000000032','e0000000-0000-4000-8000-000000000022','race2@example.invalid');
select public.record_registration_identity_proof('e0000000-0000-4000-8000-000000000033','e0000000-0000-4000-8000-000000000023','race3@example.invalid');`);
const app=(email)=>sql(`select id from public.student_registrations where email='${email}' and status='pending'`);
assert.equal(sql("select count(*) from public.enrollments where student_id in ('e0000000-0000-4000-8000-000000000021','e0000000-0000-4000-8000-000000000022','e0000000-0000-4000-8000-000000000023')"),'0','Ownership proof granted access before approval');
function run(application,batch){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{stdio:['pipe','pipe','pipe']});let err='';child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>resolve({code,err}));child.stdin.end(`begin; set local role authenticated; select set_config('request.jwt.claims','{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000010","session_id":"b0000000-0000-4000-8000-000000000011"}',true); select public.approve_existing_registration('${application}','${batch}'); select pg_sleep(1); commit;`);});}
const [a,b]=await Promise.all([run(app('race1@example.invalid'),'e0000000-0000-4000-8000-000000000011'),run(app('race2@example.invalid'),'e0000000-0000-4000-8000-000000000011')]);
assert.equal([a.code,b.code].filter(code=>code===0).length,1,'Exactly one last-seat approval must succeed');assert.match(a.err+b.err,/capacity/);
assert.equal(sql("select count(*) from public.enrollments where batch_id='e0000000-0000-4000-8000-000000000011' and status='active'"),'1');
const same=app('race3@example.invalid');const [c,d]=await Promise.all([run(same,'e0000000-0000-4000-8000-000000000012'),run(same,'e0000000-0000-4000-8000-000000000012')]);
assert.equal([c.code,d.code].filter(code=>code===0).length,1,'Exactly one approval of the same application must succeed');assert.match(c.err+d.err,/Application unavailable/);
assert.equal(sql(`select count(*) from public.enrollments where student_id='e0000000-0000-4000-8000-000000000023' and status='active'`),'1');
console.log('PASS concurrent last-seat and duplicate-application approvals');

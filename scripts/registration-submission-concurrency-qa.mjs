// Run only on a disposable loopback DB created by admissions-local-qa.mjs.
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const exe=process.env.ALS_TEST_PSQL,port=process.env.ALS_TEST_PGPORT,db=process.env.ALS_TEST_REGISTRATION_DB;
assert.ok(exe,'Set ALS_TEST_PSQL');assert.match(port||'',/^\d{4,5}$/);assert.match(db||'',/^als_batch_guard_\d+$/);
const args=['-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
function sql(input){const r=spawnSync(exe,args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr||String(r.error));return r.stdout.trim();}
assert.match(sql("select coalesce(shobj_description(oid,'pg_database'),'') from pg_database where datname=current_database()"),/^als-batch-guard:/,'Refusing unmarked database');
sql("insert into public.programs(id,slug,name,status) values('f1000000-0000-4000-8000-000000000001','conflict-race-one','QA one','active'),('f1000000-0000-4000-8000-000000000002','conflict-race-two','QA two','active')");
function run({name,email,phone,program,key,hash}){return new Promise((resolve,reject)=>{const p=spawn(exe,args,{stdio:['pipe','pipe','pipe']});let err='',out='';p.stderr.on('data',v=>err+=v);p.stdout.on('data',v=>out+=v);p.on('error',reject);p.on('close',code=>resolve({code,err,out}));const phoneHash=phone.endsWith('210')?'b':'f';p.stdin.end(`begin; select public.submit_student_registration('${name}','${email}','${phone}','BSc','College','${program}',null,null,true,'${key}',repeat('a',64),repeat('${phoneHash}',64),repeat('${hash}',64),null); select pg_sleep(1); commit;`);});}
const p1='f1000000-0000-4000-8000-000000000001',p2='f1000000-0000-4000-8000-000000000002';
const [a,b]=await Promise.all([
 run({name:'Same Person',email:'race@example.invalid',phone:'+919876543210',program:p1,key:'f1000000-0000-4000-8000-000000000003',hash:'c'}),
 run({name:'Same Person',email:'race@example.invalid',phone:'+919876543210',program:p2,key:'f1000000-0000-4000-8000-000000000004',hash:'c'})]);
assert.equal(a.code,0,a.err);assert.equal(b.code,0,b.err);assert.equal([a.out,b.out].filter(x=>x.includes('"accepted": true')).length,1,'Only one changed application may succeed');assert.match(a.out+b.out,/application_conflict/);
assert.equal(sql("select count(*) from public.student_registrations where email='race@example.invalid'"),'1');
const [c,d]=await Promise.all([
 run({name:'Family One',email:'family1@example.invalid',phone:'+919876543211',program:p1,key:'f1000000-0000-4000-8000-000000000005',hash:'d'}),
 run({name:'Family Two',email:'family2@example.invalid',phone:'+919876543211',program:p2,key:'f1000000-0000-4000-8000-000000000006',hash:'e'})]);
assert.equal(c.code,0,c.err);assert.equal(d.code,0,d.err);
assert.equal(sql("select count(*) from public.student_registrations where phone='+919876543211'"),'2');
console.log('PASS changed-submission conflicts and shared family-phone concurrency');

import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
function sql(input){const r=spawnSync('docker',['exec','-i','als-registration-auth-qa-db-1','psql','-U','postgres','-d','gotrue','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',maxBuffer:20e6});assert.equal(r.status,0,r.stderr||String(r.error));return r.stdout.trim();}
let provider=readFileSync('scripts/fixtures/helper-grants-provider.sql','utf8').replace('create schema auth;','').replace(/create table auth\.users\([^\n]+\);\r?\n/,'').replace(/create function auth\.(?:jwt|uid)\(\)[^\n]+\r?\n/g,'');
sql(provider);
sql(`create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)]$$;
create publication supabase_realtime; create schema realtime; create table realtime.messages(id bigint generated always as identity,extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;grant execute on function realtime.topic() to authenticated;`);
const migrationPaths=new Map(readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).map(file=>[file,`supabase/migrations/${file}`]));
if(process.env.ALS_COMBINED_AUTH_QA==='1'){
 sql('create role authenticator noinherit login; grant anon,authenticated,service_role to authenticator; create role supabase_auth_admin nologin; grant usage on schema public to supabase_auth_admin;');
 const security='../als-media-urgent-integration';
 const head=spawnSync('git',['-C',security,'rev-parse','HEAD'],{encoding:'utf8'});
 assert.equal(head.stdout.trim(),'239478fc64e258d7cc2baa8d5313b883f5065163','Unexpected security candidate');
 for(const file of readdirSync(`${security}/supabase/migrations`).filter(x=>x.endsWith('.sql'))){
  const path=`${security}/supabase/migrations/${file}`;
  if(migrationPaths.has(file)) assert.equal(readFileSync(migrationPaths.get(file),'utf8'),readFileSync(path,'utf8'),`Shared migration differs: ${file}`);
  else migrationPaths.set(file,path);
 }
}
const migrations=[...migrationPaths.keys()].sort();
for(const file of migrations){try{sql(`begin;\n${readFileSync(migrationPaths.get(file),'utf8')}\ncommit;`);}catch(e){throw Error(`Migration ${file}: ${e.message}`)}}
if(!migrations.some(file=>file.endsWith('_student_registration.sql'))) sql(readFileSync('docs/registration-schema-prototype.sql','utf8'));
console.log('Registration schema loaded into real GoTrue database');
if(process.env.ALS_LOCAL_BROWSER_QA==='1'){
 await import('./registration-browser-fixture.mjs');
 process.exit(0);
}
if(process.env.ALS_WEAK_PASSWORD_QA==='1'){
 assert.equal(process.env.ALS_LOCAL_PASSWORD_MIN_LENGTH,'32','Weak-password case requires isolated stricter policy');
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const prefix=`${enc({alg:'HS256',typ:'JWT'})}.${enc({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600})}`;
 const token=`${prefix}.${createHmac('sha256',process.env.ALS_LOCAL_JWT_SECRET).update(prefix).digest('base64url')}`;
 const base='http://127.0.0.1:19421', email='weak-test@example.test';
 const original=`A!9${randomBytes(24).toString('hex')}z`;
 const rejected=`A!9${randomBytes(8).toString('hex')}z`;
 async function call(path,body,bearer,method='POST'){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01',...(bearer?{Authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
 }
 const created=await call('/admin/users',{email,password:original,email_confirm:true,user_metadata:{full_name:'Synthetic Weak Password Test'}},token);
 assert.equal(created.status,200,'Synthetic identity creation failed');
 const before=await call('/token?grant_type=password',{email,password:original});
 assert.equal(before.status,200,'Synthetic prior login failed');
 const update=await call('/user',{password:rejected},before.data.access_token,'PUT');
 assert.equal(update.status,422,'Unexpected provider rejection status');
 assert.equal(update.data.code,'weak_password','Unexpected provider error code');
 const after=await call('/token?grant_type=password',{email,password:original});
 assert.equal(after.status,200,'Prior synthetic password no longer authenticates');
 const wrong=await call('/token?grant_type=password',{email,password:rejected});
 assert.notEqual(wrong.status,200,'Rejected password unexpectedly authenticated');
 console.log('Pinned local provider returned weak_password before observable password change');
 process.exit(0);
}
sql(`insert into public.programs(id,slug,name,status) values('b0000000-0000-4000-8000-000000000001','gotrue-qa','QA program','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','gotrue-qa','QA batch','GOTRUEQA','active',1);
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('b0000000-0000-4000-8000-000000000010','admin@example.test','{"role":"admin"}','{"full_name":"QA Admin"}');
select public.submit_student_registration('Test Student','student@example.test','+919876543210','BSc','Test institution','b0000000-0000-4000-8000-000000000001',null,null,true,'b0000000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64),repeat('c',64),null);`);
const application=sql("select id from public.student_registrations where email='student@example.test'");assert.ok(application);
assert.equal(sql("select count(*) from auth.users where email='student@example.test'"),'0');
const base='http://127.0.0.1:19421', enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const prefix=`${enc({alg:'HS256',typ:'JWT'})}.${enc({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600})}`;
const adminToken=`${prefix}.${createHmac('sha256',process.env.ALS_LOCAL_JWT_SECRET).update(prefix).digest('base64url')}`;
async function api(path,body,bearer=adminToken){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${bearer}`},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const admission={actor_id:'b0000000-0000-4000-8000-000000000010',registration_id:application,full_name:'Test Student',phone:'+919876543210',admission_on:'2026-11-10',program_id:'b0000000-0000-4000-8000-000000000001',batch_id:'b0000000-0000-4000-8000-000000000002',access_starts_at:'2026-11-10T00:00:00Z',unassigned:false,is_active:true};
const created=await api('/admin/users',{email:'student@example.test',email_confirm:false,app_metadata:{role:'student',lms_admission:admission},user_metadata:{full_name:'Test Student'}});
assert.equal(created.status,200,JSON.stringify(created.data)); const student=created.data.id;assert.ok(student);assert.equal(created.data.email_confirmed_at,undefined);
const state=sql(`select status||':'||student_id::text||':'||(select student_code from public.profiles where id=student_id)||':'||(select count(*) from public.enrollments where student_id='${student}' and batch_id='b0000000-0000-4000-8000-000000000002' and status='active') from public.student_registrations where id='${application}'`);
assert.match(state,new RegExp(`^approved:${student}:ALS-GOTRUEQA-.*:1$`));
const duplicate=await api('/admin/users',{email:'student@example.test',email_confirm:false,app_metadata:{role:'student',lms_admission:admission},user_metadata:{full_name:'Test Student'}});assert.notEqual(duplicate.status,200);
const invite=await api('/invite?redirect_to=http%3A%2F%2F127.0.0.1%3A19422%2Fauth%2Fcallback',{email:'student@example.test'});assert.equal(invite.status,200,JSON.stringify(invite.data));assert.equal(invite.data.id,student);
let firstMessage;for(let i=0;i<20;i++){firstMessage=(await (await fetch('http://127.0.0.1:19425/api/v1/messages')).json()).messages?.[0];if(firstMessage)break;await new Promise(r=>setTimeout(r,500));}assert.ok(firstMessage);
const firstDetail=await (await fetch(`http://127.0.0.1:19425/api/v1/message/${firstMessage.ID}`)).json();const firstLink=(firstDetail.Text||firstDetail.HTML||'').match(/https?:\/\/[^\s"<>]+\/verify\?[^\s"<>]+/);assert.ok(firstLink);
const firstToken=new URL(firstLink[0].replaceAll('&amp;','&')).searchParams.get('token');assert.ok(firstToken);
// Local-only cooldown manipulation avoids sleeping; resend must reuse the unconfirmed Auth identity.
sql(`update auth.users set confirmation_sent_at=clock_timestamp()-interval '2 minutes' where id='${student}'`);
const retry=await api('/invite?redirect_to=http%3A%2F%2F127.0.0.1%3A19422%2Fauth%2Fcallback',{email:'student@example.test'});
assert.equal(retry.status,200,JSON.stringify(retry.data));assert.equal(retry.data.id,student);
assert.equal(sql("select count(*) from auth.users where email='student@example.test'"),'1');
const older=await api('/verify',{token_hash:firstToken,type:'invite'});
assert.notEqual(older.status,200,'An older invitation remained redeemable after resend');
let msg;for(let i=0;i<20;i++){msg=(await (await fetch('http://127.0.0.1:19425/api/v1/messages')).json()).messages?.[0];if(msg)break;await new Promise(r=>setTimeout(r,500));}assert.ok(msg);
const detail=await (await fetch(`http://127.0.0.1:19425/api/v1/message/${msg.ID}`)).json();const link=(detail.Text||detail.HTML||'').match(/https?:\/\/[^\s"<>]+\/verify\?[^\s"<>]+/);assert.ok(link);
const token=new URL(link[0].replaceAll('&amp;','&')).searchParams.get('token');assert.ok(token);
const password=`Aa1!${randomBytes(24).toString('hex')}`;
if(process.env.ALS_COMBINED_AUTH_QA==='1'){
 const rest=spawnSync('docker',['compose','-p','als-registration-auth-qa','-f','scripts/fixtures/registration-auth/compose.yml','up','-d','rest'],{stdio:'inherit'});
 assert.equal(rest.status,0,'Local PostgREST did not start');
 let ready=false; for(let i=0;i<30;i++){try{await fetch('http://127.0.0.1:19423/');ready=true;break;}catch{}await new Promise(r=>setTimeout(r,500));} assert.ok(ready,'Local PostgREST not ready');
 const route=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','src/app/auth/callback/real-auth-route.lab.test.ts','--reporter=dot'],{stdio:'inherit',env:{...process.env,ALS_REAL_AUTH_ROUTE_QA:'1',ALS_TEST_INVITE_HASH:token,ALS_TEST_PASSWORD:password,REGISTRATION_SETUP_SECRET:randomBytes(32).toString('hex'),REGISTRATION_SITE_URL:'http://127.0.0.1:19422',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:19421',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-publishable-key',SUPABASE_SERVICE_ROLE_KEY:adminToken}});
 assert.equal(route.status,0,'Actual route + local Auth integration failed');
}else{
 const verified=await api('/verify',{token_hash:token,type:'invite'});assert.equal(verified.status,200,JSON.stringify(verified.data));assert.equal(verified.data.user.id,student);assert.ok(verified.data.user.email_confirmed_at);
 const set=await fetch(base+'/user',{method:'PUT',headers:{Authorization:`Bearer ${verified.data.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(set.status,200,await set.text());
}
const login=await api('/token?grant_type=password',{email:'student@example.test',password},'');assert.equal(login.status,200,JSON.stringify(login.data));assert.equal(login.data.user.id,student);
if(process.env.ALS_COMBINED_AUTH_QA==='1'){
 // The hook uses a nonblocking shared account lock. Holding the exclusive
 // lock makes a genuine Auth token issuance fail only when the hook runs.
 const holder=spawn('docker',['exec','als-registration-auth-qa-db-1','psql','-X','-U','postgres','-d','gotrue','-v','ON_ERROR_STOP=1','-q','-c',`select pg_advisory_lock(hashtextextended('als.account:${student}',0)); select pg_sleep(12);`],{stdio:'ignore'});
 const exited=new Promise((resolve,reject)=>{holder.once('error',reject);holder.once('exit',code=>code===0?resolve():reject(new Error('Synthetic lock holder failed')));});
 let held=false;
 for(let i=0;i<50;i++){
  if(sql(`select pg_try_advisory_lock_shared(hashtextextended('als.account:${student}',0))`)==='f'){held=true;break;}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(held,'Synthetic account lock was not acquired');
 const denied=await api('/token?grant_type=password',{email:'student@example.test',password},'');
 assert.notEqual(denied.status,200,'Auth issued a token while its configured hook should reject the lock');
 assert.ok(JSON.stringify(denied.data).includes('Account status is changing'),'Auth did not return the hook-specific rejection');
 assert.equal(sql(`select pg_try_advisory_lock_shared(hashtextextended('als.account:${student}',0))`),'f','Synthetic lock expired before the denial was observed');
 await exited;
 const permitted=await api('/token?grant_type=password',{email:'student@example.test',password},'');
 assert.equal(permitted.status,200,'Auth login did not recover after the lock was released');
 const issuedClaims=JSON.parse(Buffer.from(permitted.data.access_token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(issuedClaims.sub,student); assert.equal(issuedClaims.role,'authenticated');
 assert.equal(issuedClaims.app_metadata?.role,'student');
 assert.match(issuedClaims.session_id,/^[0-9a-f-]{36}$/i);
 console.log(JSON.stringify({hookNegativeDuringAccountTransition:true,hookPositiveAfterRelease:true}));
}
if(migrations.some(file=>file.endsWith('_student_registration_identity_proof.sql'))){
 const previousCode=sql(`select student_code from public.profiles where id='${student}'`);
 sql(`insert into public.programs(id,slug,name,status) values('b0000000-0000-4000-8000-000000000041','gotrue-qa-existing','Second program','active');
 insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values('b0000000-0000-4000-8000-000000000042','b0000000-0000-4000-8000-000000000041','gotrue-qa-existing','Second batch','GOTRUEQB','active',1);
 select public.submit_student_registration('Test Student','student@example.test','+919876543210','BSc','Test institution','b0000000-0000-4000-8000-000000000041',null,null,true,'b0000000-0000-4000-8000-000000000043',repeat('a',64),repeat('b',64),repeat('c',64),null);`);
 assert.equal(sql(`select public.record_registration_identity_proof('b0000000-0000-4000-8000-000000000043','${student}','student@example.test')`),'t');
 const existing=sql("select id from public.student_registrations where email='student@example.test' and status='pending'");
 assert.ok(existing);assert.equal(sql(`select count(*) from public.enrollments where student_id='${student}' and program_id='b0000000-0000-4000-8000-000000000041'`),'0');
 if(process.env.ALS_COMBINED_AUTH_QA==='1') sql("insert into auth.sessions(id,user_id,created_at,updated_at) values('b0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-000000000010',clock_timestamp(),clock_timestamp())");
 sql(`begin; set local role authenticated; select set_config('request.jwt.claims','{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000010","session_id":"b0000000-0000-4000-8000-000000000011"}',true); select public.approve_existing_registration('${existing}','b0000000-0000-4000-8000-000000000042'); commit;`);
 assert.equal(sql(`select count(*) from public.enrollments where student_id='${student}' and program_id='b0000000-0000-4000-8000-000000000041' and status='active'`),'1');
 assert.equal(sql(`select student_code from public.profiles where id='${student}'`),previousCode);
 assert.equal(sql(`select invitation_status from public.student_registrations where id='${existing}'`),'not_required');
 assert.equal(sql("select count(*) from auth.users where lower(email)='student@example.test'"),'1');
}
if(process.env.ALS_COMBINED_AUTH_QA==='1'){
 // Direct Auth remains a separate interface from the application capability.
 // Synthetic user only: observe the provider's behavior, do not assume a ban
 // cancels an already issued access token or changes a remote password call.
 sql(`set role als_account_status_writer; update public.profiles set is_active=false where id='${student}'; reset role;`);
 const nextPassword=`Bb2!${randomBytes(24).toString('hex')}`;
 const direct=await fetch(base+'/user',{method:'PUT',headers:{Authorization:`Bearer ${login.data.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({password:nextPassword})});
 const freshLogin=await api('/token?grant_type=password',{email:'student@example.test',password:nextPassword},'');
 const claims=JSON.parse(Buffer.from(login.data.access_token.split('.')[1],'base64url').toString('utf8'));
 const allowed=sql(`begin; set local role authenticated; select set_config('request.jwt.claims','${JSON.stringify({role:'authenticated',sub:student,session_id:claims.session_id})}',true); select private.account_session_allowed(); commit;`).split('\n').at(-1);
 assert.equal(allowed,'f','inactive account retained database authorization');
 console.log(JSON.stringify({directAuthAfterDeactivationStatus:direct.status,freshLoginAfterDeactivationStatus:freshLogin.status,inactiveDatabaseAccessDenied:true}));
}
console.log(JSON.stringify({pendingWithoutIdentity:true,approvalTransaction:true,studentCode:true,batchEnrollment:true,duplicateIdentityRejected:true,unconfirmedBeforeInvite:true,inviteReusedIdentity:true,retryReusedIdentity:true,tokenVerified:true,passwordLogin:true,existingStudentLinked:migrations.some(file=>file.endsWith('_student_registration_identity_proof.sql'))}));

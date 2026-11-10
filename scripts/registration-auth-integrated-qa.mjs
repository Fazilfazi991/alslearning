import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
function sql(input){const r=spawnSync('docker',['exec','-i','als-registration-auth-qa-db-1','psql','-U','postgres','-d','gotrue','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8',maxBuffer:20e6});assert.equal(r.status,0,r.stderr||String(r.error));return r.stdout.trim();}
let provider=readFileSync('scripts/fixtures/helper-grants-provider.sql','utf8').replace('create schema auth;','').replace(/create table auth\.users\([^\n]+\);\r?\n/,'').replace(/create function auth\.(?:jwt|uid)\(\)[^\n]+\r?\n/g,'');
sql(provider);
sql(`create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)]$$;
create publication supabase_realtime; create schema realtime; create table realtime.messages(id bigint generated always as identity,extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;grant execute on function realtime.topic() to authenticated;`);
const migrations=readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
for(const file of migrations){try{sql(`begin;\n${readFileSync(`supabase/migrations/${file}`,'utf8')}\ncommit;`);}catch(e){throw Error(`Migration ${file}: ${e.message}`)}}
if(!migrations.some(file=>file.endsWith('_student_registration.sql'))) sql(readFileSync('docs/registration-schema-prototype.sql','utf8'));
console.log('Registration schema loaded into real GoTrue database');
sql(`insert into public.programs(id,slug,name,status) values('b0000000-0000-4000-8000-000000000001','gotrue-qa','QA program','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','gotrue-qa','QA batch','GOTRUEQA','active',1);
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('b0000000-0000-4000-8000-000000000010','admin@example.test','{"role":"admin"}','{"full_name":"QA Admin"}');
select public.submit_student_registration('Test Student','student@example.test','+919876543210','BSc','Test institution','b0000000-0000-4000-8000-000000000001',null,null,true,'b0000000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64),repeat('c',64),null);`);
const application=sql("select id from public.student_registrations where email='student@example.test'");assert.ok(application);
assert.equal(sql("select count(*) from auth.users where email='student@example.test'"),'0');
const base='http://127.0.0.1:19421', enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const prefix=`${enc({alg:'HS256',typ:'JWT'})}.${enc({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600})}`;
const adminToken=`${prefix}.${createHmac('sha256','this-is-a-disposable-local-only-registration-secret-123456').update(prefix).digest('base64url')}`;
async function api(path,body,bearer=adminToken){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${bearer}`},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const admission={actor_id:'b0000000-0000-4000-8000-000000000010',registration_id:application,full_name:'Test Student',phone:'+919876543210',admission_on:'2026-11-10',program_id:'b0000000-0000-4000-8000-000000000001',batch_id:'b0000000-0000-4000-8000-000000000002',access_starts_at:'2026-11-10T00:00:00Z',unassigned:false,is_active:true};
const created=await api('/admin/users',{email:'student@example.test',email_confirm:false,app_metadata:{role:'student',lms_admission:admission},user_metadata:{full_name:'Test Student'}});
assert.equal(created.status,200,JSON.stringify(created.data)); const student=created.data.id;assert.ok(student);assert.equal(created.data.email_confirmed_at,undefined);
const state=sql(`select status||':'||student_id::text||':'||(select student_code from public.profiles where id=student_id)||':'||(select count(*) from public.enrollments where student_id='${student}' and batch_id='b0000000-0000-4000-8000-000000000002' and status='active') from public.student_registrations where id='${application}'`);
assert.match(state,new RegExp(`^approved:${student}:ALS-GOTRUEQA-.*:1$`));
const duplicate=await api('/admin/users',{email:'student@example.test',email_confirm:false,app_metadata:{role:'student',lms_admission:admission},user_metadata:{full_name:'Test Student'}});assert.notEqual(duplicate.status,200);
const invite=await api('/invite?redirect_to=http%3A%2F%2F127.0.0.1%3A19422%2Fauth%2Fcallback',{email:'student@example.test'});assert.equal(invite.status,200,JSON.stringify(invite.data));assert.equal(invite.data.id,student);
let msg;for(let i=0;i<20;i++){msg=(await (await fetch('http://127.0.0.1:19425/api/v1/messages')).json()).messages?.[0];if(msg)break;await new Promise(r=>setTimeout(r,500));}assert.ok(msg);
const detail=await (await fetch(`http://127.0.0.1:19425/api/v1/message/${msg.ID}`)).json();const link=(detail.Text||detail.HTML||'').match(/https?:\/\/[^\s"<>]+\/verify\?[^\s"<>]+/);assert.ok(link);
const token=new URL(link[0].replaceAll('&amp;','&')).searchParams.get('token');assert.ok(token);
const verified=await api('/verify',{token_hash:token,type:'invite'});assert.equal(verified.status,200,JSON.stringify(verified.data));assert.equal(verified.data.user.id,student);assert.ok(verified.data.user.email_confirmed_at);
const password='Local-Password-123!';const set=await fetch(base+'/user',{method:'PUT',headers:{Authorization:`Bearer ${verified.data.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(set.status,200,await set.text());
const login=await api('/token?grant_type=password',{email:'student@example.test',password},'');assert.equal(login.status,200,JSON.stringify(login.data));assert.equal(login.data.user.id,student);
console.log(JSON.stringify({pendingWithoutIdentity:true,approvalTransaction:true,studentCode:true,batchEnrollment:true,duplicateIdentityRejected:true,unconfirmedBeforeInvite:true,inviteReusedIdentity:true,tokenVerified:true,passwordLogin:true}));

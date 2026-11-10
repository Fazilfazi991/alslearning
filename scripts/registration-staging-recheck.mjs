// Existing synthetic fixtures only. Run solely after the capacity migration,
// staging target and approved window are independently confirmed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

const need = key => { const value=process.env[key]; assert.ok(value, `Missing ${key}`); return value; };
assert.equal(need('ALS_REGISTRATION_QA_STAGING_CONFIRMED'),'approved-window');
assert.equal(need('ALS_REGISTRATION_QA_TARGET_VERIFIED'),'slghshcdaijbcjfoqerq');
assert.equal(need('ALS_REGISTRATION_QA_CAPACITY_MIGRATION_CONFIRMED'),'true');
const base=new URL(need('ALS_REGISTRATION_QA_BASE'));
assert.equal(base.protocol,'https:'); assert.ok(base.hostname.endsWith('.vercel.app') && base.hostname!=='alslearning.vercel.app');
assert.equal(base.pathname,'/'); assert.equal(base.search,''); assert.equal(base.hash,'');
const staging=parseEnv(readFileSync(need('ALS_REGISTRATION_QA_STAGING_ENV'),'utf8'));
assert.equal(new URL(staging.NEXT_PUBLIC_SUPABASE_URL).hostname,'slghshcdaijbcjfoqerq.supabase.co');
const credentials=parseEnv(readFileSync(need('ALS_REGISTRATION_QA_ACCOUNTS_ENV'),'utf8'));
assert.ok(credentials.ALS_STAGE_ADMIN_EMAIL && credentials.ALS_STAGE_ADMIN_PASSWORD);
const reportPath=need('ALS_REGISTRATION_QA_EXISTING_REPORT');
const existing=JSON.parse(readFileSync(reportPath,'utf8'));
assert.equal(existing.target,'als-live-staging'); assert.equal(existing.base,base.origin);
assert.match(existing.fixture?.name||'',/^STAGING QA [0-9a-f]{12}$/);
assert.match(existing.secondFixture?.name||'',/^STAGING QA FULL [0-9a-f]{12}$/);
assert.equal(existing.fixture.tag, existing.secondFixture.name.split(' ').at(-1));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
for(const id of [existing.registrationId,existing.studentId,existing.secondFixture.registrationId,existing.fixture.programId,existing.fixture.batchId]) assert.match(id,uuid);
assert.equal(existing.fixture.batchId,existing.secondFixture.batchId);
assert.equal(existing.fixture.programId,existing.secondFixture.programId);
let share=credentials.ALS_STAGE_VERCEL_SHARE_URL;
if(process.env.ALS_REGISTRATION_QA_SHARE_STDIN==='true') { if(process.stdin.isTTY)process.stdin.setRawMode(true);const rl=createInterface({input:process.stdin,terminal:false});share=await new Promise(resolve=>rl.once('line',resolve));rl.close(); }
if(share)assert.equal(new URL(share).origin,base.origin);
const {chromium}=await import(pathToFileURL(need('ALS_REGISTRATION_QA_PLAYWRIGHT')).href);
const result={target:'als-live-staging',checks:[],screenshots:[],fixtureTag:existing.fixture.tag,noEmail:true,notes:'Reuses the two marked synthetic applications. Exact retry adds a private idempotency mapping but no new application or account. No automatic cleanup.'};
const check=message=>{result.checks.push(message);console.log('PASS '+message)};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}); const page=await context.newPage();page.setDefaultTimeout(30000);
const folder=reportPath.replace(/[\\/]report\.json$/,'');
const shot=async name=>{await page.screenshot({path:`${folder}/${name}.png`,fullPage:true});result.screenshots.push(`${name}.png`)};
try{
 if(share){try{await page.goto(share,{waitUntil:'domcontentloaded'});}catch{throw Error('Could not open protected staging preview');}}
 await page.goto(base.origin+'/register',{waitUntil:'domcontentloaded'});
 if(await page.getByLabel('Access phrase',{exact:true}).count()){assert.ok(staging.ALS_STAGING_ACCESS_PHRASE);await page.getByLabel('Access phrase',{exact:true}).fill(staging.ALS_STAGING_ACCESS_PHRASE);await page.getByRole('button',{name:'Continue to ALS'}).click();await page.goto(base.origin+'/register',{waitUntil:'domcontentloaded'});}
 await page.getByRole('heading',{name:'Your details'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Continue'}).click();
 assert.ok(await page.getByText('Please check the highlighted fields.').isVisible());
 await shot('recheck-mobile-validation'); check('Mobile form and required-field validation');
 const unauthorized=await context.request.get(base.origin+'/api/admin/registrations');assert.equal(unauthorized.status(),401);check('Unauthenticated admin access denied');
 const second=existing.secondFixture;
 const payload={fullName:second.name,email:second.email,phone:second.phone,qualification:'STAGING QA qualification',institution:'STAGING QA institution',programId:existing.fixture.programId,preferredBatchId:null,notes:null,consent:true,requestId:randomUUID(),website:''};
 const send=data=>context.request.post(base.origin+'/api/registrations',{headers:{Origin:base.origin},data});
 const first=await send(payload);assert.equal(first.status(),200,'Existing exact application could not be replayed');
 const repeat=await send(payload);assert.equal(repeat.status(),200,'Exact retry failed');
 const changed=await send({...payload,institution:'Changed QA institution'});assert.equal(changed.status(),409,'Changed retry was not rejected');
 check('Existing application replay is idempotent and changed retry is rejected');
 const login=await context.request.post(base.origin+'/api/auth/password',{headers:{Origin:base.origin},data:{email:credentials.ALS_STAGE_ADMIN_EMAIL,password:credentials.ALS_STAGE_ADMIN_PASSWORD}});assert.equal(login.status(),200,'Synthetic admin login failed');
 const list=await context.request.get(base.origin+'/api/admin/registrations?'+new URLSearchParams({q:second.email}));assert.equal(list.status(),200);const matches=(await list.json()).registrations;assert.equal(matches.length,1);assert.equal(matches[0].id,second.registrationId);check('Replay did not create a duplicate application');
 const [firstDetail,secondDetail,studentDetail]=await Promise.all([context.request.get(base.origin+'/api/admin/registrations/'+existing.registrationId),context.request.get(base.origin+'/api/admin/registrations/'+second.registrationId),context.request.get(base.origin+'/api/admin/students/'+existing.studentId)]);
 assert.equal(firstDetail.status(),200);assert.equal(secondDetail.status(),200);assert.equal(studentDetail.status(),200);
 const prior=await firstDetail.json(),pending=await secondDetail.json(),student=await studentDetail.json();
 assert.equal(prior.application.status,'approved');assert.equal(prior.application.student_id,existing.studentId);assert.equal(prior.application.invitation_status,'not_sent');
 assert.ok(student.profile.student_code);assert.ok(student.enrollments.some(x=>x.program_id===existing.fixture.programId && x.batch_id===existing.fixture.batchId && x.status==='active'));
 assert.equal(pending.application.status,'pending');assert.equal(pending.application.student_id,null);
 const full=pending.batches.find(x=>x.id===existing.fixture.batchId);assert.ok(full && /^REGISTRATION QA\b/i.test(full.name));assert.equal(full.max_students,1);assert.equal(full.reserved_seats,1);
 check('Approved student retains code and batch with setup link unsent; pending fixture remains unlinked');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base.origin+'/admin/registrations/'+second.registrationId,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:second.name,exact:true}).waitFor();
 const option=page.getByLabel('Assign batch').locator(`option[value="${existing.fixture.batchId}"]`);
 await page.waitForFunction(id=>{const el=document.querySelector(`option[value="${id}"]`);return el instanceof HTMLOptionElement && el.disabled},existing.fixture.batchId);
 assert.match(await option.textContent(),/1\/1 seats reserved.*full/i);await shot('recheck-admin-full');check('Admin displays one reserved seat and disables the full batch');
 const blocked=await context.request.post(base.origin+'/api/admin/registrations/'+second.registrationId+'/approve',{headers:{Origin:base.origin},data:{batch_id:existing.fixture.batchId}});assert.ok([409,422].includes(blocked.status()));
 const after=await context.request.get(base.origin+'/api/admin/registrations/'+second.registrationId);const final=await after.json();assert.equal(final.application.status,'pending');assert.equal(final.application.student_id,null);
 const students=await context.request.get(base.origin+'/api/admin/students');assert.equal(students.status(),200);assert.ok(!(await students.json()).students.some(x=>x.email?.toLowerCase()===second.email.toLowerCase()));
 check('Full-batch approval rejected and creates no student profile');
}catch(error){let message=error instanceof Error?error.message:'Unknown staging QA error';for(const secret of [staging.ALS_STAGING_ACCESS_PHRASE,credentials.ALS_STAGE_ADMIN_PASSWORD,share])if(secret)message=message.replaceAll(secret,'[redacted]');result.failure=message.replace(/https?:\/\/[^\s"']+/g,'[url]').slice(0,1200);console.error('QA_FAILURE '+result.failure);process.exitCode=1;}
finally{writeFileSync(`${folder}/recheck-report.json`,JSON.stringify(result,null,2));await browser.close();}

// Disposable browser acceptance. Invoked by the dedicated Compose runner only.
// No real accounts, hosted URLs, passwords or tokens are printed or persisted.
import { spawn, spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

assert.equal(process.env.ALS_LOCAL_BROWSER_QA, '1');
assert.equal(process.env.ALS_COMBINED_AUTH_QA, '1');
assert.equal(process.env.VERCEL, undefined);
const db = 'als-registration-auth-qa-db-1';
function sql(statement) {
  const result = spawnSync('docker', ['exec', '-i', db, 'psql', '-X', '-U', 'postgres', '-d', 'gotrue', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A'], { input: statement, encoding: 'utf8' });
  assert.equal(result.status, 0, 'Synthetic browser database setup failed');
  return result.stdout.trim();
}
sql(`insert into public.programs(id,slug,name,status) values
 ('b1000000-0000-4000-8000-000000000001','browser-assigned','Browser QA Assigned','active'),
 ('b1000000-0000-4000-8000-000000000002','browser-unrelated','Browser QA Unrelated','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students,registration_default) values
 ('b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001','browser-batch','Browser QA Batch','BROWSERQA','active',10,true);
insert into public.subjects(id,slug,name,status) values
 ('b1000000-0000-4000-8000-000000000004','browser-subject','Browser QA Subject','active'),
 ('b1000000-0000-4000-8000-000000000005','browser-other-subject','Browser QA Other Subject','active');
insert into public.program_subjects(program_id,subject_id) values
 ('b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004'),
 ('b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000005');
insert into public.learning_content(id,kind,slug,title,description,program_id,subject_id,status) values
 ('b1000000-0000-4000-8000-000000000006','note','browser-assigned-note','Browser QA Permitted Note','Synthetic permitted lesson text.','b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000004','active'),
 ('b1000000-0000-4000-8000-000000000007','note','browser-unrelated-note','Browser QA Unrelated Note','Synthetic unrelated private lesson text.','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000005','active');`);

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(role) {
  const payload = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 })}`;
  return `${payload}.${createHmac('sha256', process.env.ALS_LOCAL_JWT_SECRET).update(payload).digest('base64url')}`;
}
const service = token('service_role'), anon = token('anon');
const adminPassword = `A!9${randomBytes(24).toString('hex')}z`;
const admin = await fetch('http://127.0.0.1:19421/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${service}` }, body: JSON.stringify({ email: 'browser-admin@example.test', password: adminPassword, email_confirm: true, app_metadata: { role: 'admin' }, user_metadata: { full_name: 'Browser QA Admin' } }) });
assert.equal(admin.status, 200, 'Synthetic browser admin setup failed');
const adminId = (await admin.json()).id;
const compose = spawnSync('docker', ['compose','-p','als-registration-auth-qa','-f','scripts/fixtures/registration-auth/compose.yml','-f','scripts/fixtures/registration-auth/compose.browser.yml','up','-d','rest'], { stdio: 'ignore' });
assert.equal(compose.status, 0, 'Synthetic PostgREST startup failed');

const env = { ...process.env, NODE_ENV: 'development', ALS_LOCAL_REGISTRATION_QA: '1', ALS_LOCAL_GOTRUE_VERSION: '2.197.0', ALS_LOCAL_PROXY_SINGLE_DISPATCH: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:19424', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, REGISTRATION_SITE_URL: 'http://127.0.0.1:19422', REGISTRATION_INVITATION_ENABLED: 'true', REGISTRATION_RECOVERY_ENABLED: 'true', REGISTRATION_SETUP_SECRET: randomBytes(32).toString('hex'), REGISTRATION_RATE_LIMIT_SECRET: randomBytes(32).toString('hex'), ALS_BROWSER_ADMIN_PASSWORD: adminPassword, ALS_BROWSER_BOOTSTRAP_CAPABILITY: randomBytes(32).toString('hex') };
const proxy = spawn(process.execPath, ['scripts/fixtures/registration-auth/browser-proxy.mjs'], { env, stdio: 'ignore' });
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-H', '127.0.0.1', '-p', '19422'], { env, stdio: 'ignore' });
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (proxy.exitCode !== null || next.exitCode !== null) throw new Error('Synthetic local browser server exited');
    try { if ((await fetch('http://127.0.0.1:19422/register')).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Synthetic local browser server did not become ready');
  console.log('Disposable browser fixture ready on loopback; synthetic Mailpit is on port 19425.');
  if (process.env.ALS_LOCAL_BROWSER_JOURNEY_QA === '1') {
    const { runBrowserJourney } = await import('./registration-browser-journey-qa.mjs');
    await runBrowserJourney({ sql, adminPassword });
  } else if (process.env.ALS_LOCAL_RECOVERY_QA === '1') {
    const { runLocalRecoveryQA } = await import('./registration-local-recovery-qa.mjs');
    await runLocalRecoveryQA({ sql, service, anon, adminPassword, adminId });
  } else {
    await new Promise(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
  }
} finally { proxy.kill(); next.kill(); }

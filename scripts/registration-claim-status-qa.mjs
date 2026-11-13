// Disposable synthetic PostgreSQL lab only. No hosted credentials or browser
// state. Retain generated records as evidence; never touch existing identities.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const container = process.env.ALS_CLAIM_STATUS_CONTAINER;
assert.equal(process.env.ALS_CLAIM_STATUS_QA, '1', 'Explicit local test opt-in required');
assert.match(container || '', /^als-registration-race-review-[a-z0-9-]+-pg$/, 'Only the disposable review lab is allowed');
const args = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A'];
function sql(statement) {
  const result = spawnSync('docker', args, { input: statement, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function asyncSql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', value => { output += value; });
    child.stderr.on('data', value => { errors += value; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors)));
    child.stdin.end(statement);
  });
}
const student = randomUUID(), session = randomUUID(), registration = randomUUID();
const digest = () => createHash('sha256').update(randomBytes(32)).digest('hex');
const prepare = (hash, state = 'issued', expired = false) => `insert into private.registration_setup_operations(registration_id,student_id,session_id,grant_digest,state,issued_at,expires_at)
 values('${registration}','${student}','${session}','${hash}','${state}',clock_timestamp()-interval '20 minutes',clock_timestamp()+interval '${expired ? '-1' : '10'} minutes');`;
const claim = hash => `public.claim_registration_setup_with_status('${student}','${session}','${hash}')`;
sql(`begin;
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values('${student}','${student}@example.invalid','{"role":"student"}','{}',clock_timestamp(),clock_timestamp());
 insert into auth.sessions(id,user_id,created_at,updated_at) values('${session}','${student}',clock_timestamp(),clock_timestamp());
 insert into public.student_registrations(id,full_name,email,phone,qualification,institution,program_id,status,student_id)
 values('${registration}','Synthetic claim review','${student}@example.invalid','+919999999999','Degree','Test College','30000000-0000-4000-8000-000000000001','approved','${student}');
 commit;`);
let cases = 0;
function check(statement, expected) { assert.deepEqual(JSON.parse(sql(statement)), expected); cases++; }
for (const [state, expired, status] of [
  ['issued', false, 'claimed'], ['issued', true, 'expired'],
  ['claimed', true, 'unresolved'], ['unknown', true, 'unresolved'],
  ['provider_confirmed', true, 'used'], ['authorization_denied', true, 'used'],
  ['provider_rejected', true, 'used'], ['superseded', true, 'used'],
]) {
  const hash = digest();
  const result = JSON.parse(sql(`begin; ${prepare(hash, state, expired)} select ${claim(hash)}; rollback;`));
  assert.equal(result.status, status);
  if (status === 'claimed') assert.match(result.operation_id, /^[0-9a-f-]{36}$/);
  else assert.deepEqual(result, { status });
  cases++;
}
check(`select public.claim_registration_setup_with_status(null,'${session}','${digest()}');`, { status: 'invalid' });
check(`select public.claim_registration_setup_with_status('${student}','${session}','bad');`, { status: 'invalid' });
for (const mismatch of ['student', 'session', 'digest']) {
  const hash = digest();
  check(`begin; ${prepare(hash)} select public.claim_registration_setup_with_status('${mismatch === 'student' ? randomUUID() : student}','${mismatch === 'session' ? randomUUID() : session}','${mismatch === 'digest' ? digest() : hash}'); rollback;`, { status: 'invalid' });
}
for (const change of [
  `set local role als_account_status_writer; update public.profiles set is_active=false where id='${student}'; reset role;`,
  `update auth.users set banned_until=clock_timestamp()+interval '1 year' where id='${student}';`,
  `delete from auth.sessions where id='${session}';`,
  `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${session}';`,
]) {
  const hash = digest();
  check(`begin; ${prepare(hash, 'issued', true)} ${change} select ${claim(hash)}; rollback;`, { status: 'unavailable' });
}
for (const role of ['anon', 'authenticated']) {
  assert.equal(sql(`select has_function_privilege('${role}','public.claim_registration_setup_with_status(uuid,uuid,text)','execute');`), 'f');
  cases++;
}
assert.equal(sql(`select has_function_privilege('service_role','public.claim_registration_setup_with_status(uuid,uuid,text)','execute');`), 't'); cases++;
const serviceHash = digest();
assert.equal(JSON.parse(sql(`begin; ${prepare(serviceHash)} set local role service_role; select ${claim(serviceHash)}; rollback;`)).status, 'claimed'); cases++;
const legacyHash = digest();
assert.equal(sql(`begin; ${prepare(legacyHash)} select public.claim_registration_setup('${student}','${session}','${legacyHash}') is not null; select ${claim(legacyHash)}->>'status'; rollback;`), 't\nunresolved'); cases++;
// Both clients call real PostgreSQL concurrently. Hold the winner's transaction
// briefly; the other must wait and then see the committed claimed state.
const concurrentHash = digest(); sql(prepare(concurrentHash));
const results = await Promise.all([
  asyncSql(`begin; select ${claim(concurrentHash)}; do $$ begin perform pg_sleep(0.3); end $$; commit;`),
  asyncSql(`begin; select ${claim(concurrentHash)}; commit;`),
]);
assert.deepEqual(results.map(value => JSON.parse(value).status).sort(), ['claimed', 'unresolved']); cases++;
assert.equal(sql(`select state from private.registration_setup_operations where grant_digest='${concurrentHash}';`), 'claimed'); cases++;
// Force claim to wait behind an actual committed deactivation, rather than
// testing a stale pre-lock snapshot. Never change an existing fixture account.
const revokedHash = digest(); sql(prepare(revokedHash));
const deactivation = asyncSql(`begin;
 select pg_advisory_xact_lock(hashtextextended('als.account:${student}',0));
 set local role als_account_status_writer;
 update public.profiles set is_active=false where id='${student}';
 reset role;
 do $$ begin perform pg_sleep(1); end $$; commit;`);
try {
  let lockHeld = false;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !lockHeld) {
    lockHeld = sql(`select not pg_try_advisory_xact_lock_shared(hashtextextended('als.account:${student}',0));`) === 't';
    if (!lockHeld) await delay(10);
  }
  assert.ok(lockHeld, 'Deactivation lock barrier was not observed');
  assert.deepEqual(JSON.parse(await asyncSql(`select ${claim(revokedHash)};`)), { status: 'unavailable' }); cases++;
} finally { await deactivation; }
assert.equal(sql(`select state from private.registration_setup_operations where grant_digest='${revokedHash}';`), 'issued'); cases++;
// Restore only our own synthetic account so final integrity checks remain
// meaningful. Its old session stays revoked by the epoch after reactivation.
sql(`begin; set local role als_account_status_writer; update public.profiles set is_active=true where id='${student}'; reset role; commit;`);
assert.deepEqual(JSON.parse(sql(`select ${claim(revokedHash)};`)), { status: 'unavailable' }); cases++;
// Scope/integrity checks: no role/ban/status/enrollment write is authorized by
// classification. Only this script's new synthetic identity was provisioned.
assert.equal(sql(`select role::text||':'||is_active::text||':'||(u.banned_until is null)::text from public.profiles p join auth.users u on u.id=p.id where p.id='${student}';`), 'student:true:true'); cases++;
console.log(`PASS: ${cases} atomic claim/status checks; synthetic records retained in disposable lab. Auth is simulated.`);

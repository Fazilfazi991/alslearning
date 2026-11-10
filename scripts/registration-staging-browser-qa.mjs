// Run ONLY in an approved staging window, against a deployment independently
// verified to use als-live-staging. Creates clearly labelled synthetic records.
// Do not run against production. No email is sent; new accounts remain unconfirmed.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

const required = key => { const value = process.env[key]; assert.ok(value, `Missing ${key}`); return value; };
assert.equal(required('ALS_REGISTRATION_QA_STAGING_CONFIRMED'), 'approved-window', 'Staging window must be explicitly confirmed');
assert.equal(required('ALS_REGISTRATION_QA_TARGET_VERIFIED'), 'slghshcdaijbcjfoqerq', 'Deployment target must be independently verified');
const base = new URL(required('ALS_REGISTRATION_QA_BASE'));
assert.equal(base.protocol, 'https:');
assert.ok(base.hostname.endsWith('.vercel.app') && base.hostname !== 'alslearning.vercel.app', 'Refusing non-preview or production endpoint');
assert.equal(base.pathname, '/'); assert.equal(base.search, ''); assert.equal(base.hash, '');
const config = parseEnv(readFileSync(required('ALS_REGISTRATION_QA_STAGING_ENV'), 'utf8'));
assert.equal(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname, 'slghshcdaijbcjfoqerq.supabase.co', 'Wrong staging env');
const credentials = parseEnv(readFileSync(required('ALS_REGISTRATION_QA_ACCOUNTS_ENV'), 'utf8'));
assert.ok(credentials.ALS_STAGE_ADMIN_EMAIL && credentials.ALS_STAGE_ADMIN_PASSWORD, 'Dedicated staging admin credentials required');
const program = required('ALS_REGISTRATION_QA_PROGRAM_ID'), batch = required('ALS_REGISTRATION_QA_BATCH_ID');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
assert.match(program, uuid); assert.match(batch, uuid);
const { chromium } = await import(pathToFileURL(required('ALS_REGISTRATION_QA_PLAYWRIGHT')).href);
const tag = randomBytes(6).toString('hex');
const name = `STAGING QA ${tag}`, email = `als-registration-qa-${tag}@example.invalid`;
const phone = `+1202${String(Number.parseInt(tag.slice(0, 8), 16) % 10000000).padStart(7, '0')}`;
const folder = `.local-qa/registration/staging-${tag}`; mkdirSync(folder, { recursive: true });
const report = { target: 'als-live-staging', base: base.origin, checks: [], screenshots: [], noEmail: true, fixture: { tag, name, email, phone, programId: program, batchId: batch } };
const check = message => { report.checks.push(message); console.log(`PASS ${message}`); };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage(); page.setDefaultTimeout(30000);
const screenshot = async name => { await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true }); report.screenshots.push(`${name}.png`); };
try {
  // A Vercel share URL and optional ALS staging gate are provided only in an
  // ignored env file; do not persist either token or browser storage state.
  if (credentials.ALS_STAGE_VERCEL_SHARE_URL) {
    try { await page.goto(credentials.ALS_STAGE_VERCEL_SHARE_URL, { waitUntil: 'domcontentloaded' }); }
    catch { throw new Error('Could not open the protected staging preview'); }
  }
  await page.goto(`${base.origin}/register`, { waitUntil: 'domcontentloaded' });
  if (await page.getByLabel('Access phrase', { exact: true }).count()) {
    assert.ok(config.ALS_STAGING_ACCESS_PHRASE, 'Staging gate phrase missing');
    await page.getByLabel('Access phrase', { exact: true }).fill(config.ALS_STAGING_ACCESS_PHRASE);
    await page.getByRole('button', { name: 'Continue to ALS' }).click();
    await page.goto(`${base.origin}/register`, { waitUntil: 'domcontentloaded' });
  }
  await page.getByRole('heading', { name: 'Your details' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Continue' }).click();
  assert.ok(await page.getByText('Please check the highlighted fields.').isVisible());
  check('Mobile registration renders and required fields block advancement');
  await page.getByLabel('Full name', { exact: true }).fill(name);
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Phone / WhatsApp', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Qualification', { exact: true }).fill('STAGING QA qualification');
  await page.getByLabel('Institution', { exact: true }).fill('STAGING QA institution');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Program', { exact: true }).selectOption(program);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox').check();
  await screenshot('mobile-review');
  const submitted = page.waitForRequest(request => request.method() === 'POST' && new URL(request.url()).pathname === '/api/registrations');
  await page.getByRole('button', { name: 'Submit application' }).click();
  const original = await submitted; const body = original.postDataJSON();
  await page.getByRole('heading', { name: 'Your application has been received.' }).waitFor();
  await screenshot('mobile-success');
  assert.equal(body.email, email); check('Synthetic application submitted once and received a confirmation');
  const replay = await context.request.post(`${base.origin}/api/registrations`, { headers: { Origin: base.origin }, data: body });
  assert.equal(replay.status(), 200, 'Exact retry did not succeed');
  const changed = await context.request.post(`${base.origin}/api/registrations`, { headers: { Origin: base.origin }, data: { ...body, institution: 'Changed QA institution' } });
  assert.equal(changed.status(), 409, 'Changed payload with same request ID must fail');
  check('Exact retry is idempotent and changed retry is rejected');
  const denied = await context.request.get(`${base.origin}/api/admin/registrations`);
  assert.equal(denied.status(), 401, 'Unauthenticated admin API must be denied');
  check('Unauthenticated admin API access denied');
  const login = await context.request.post(`${base.origin}/api/auth/password`, { headers: { Origin: base.origin }, data: { email: credentials.ALS_STAGE_ADMIN_EMAIL, password: credentials.ALS_STAGE_ADMIN_PASSWORD } });
  assert.equal(login.status(), 200, 'Staging admin login failed');
  const studentsBefore = await context.request.get(`${base.origin}/api/admin/students`); assert.equal(studentsBefore.status(), 200);
  const prior = await studentsBefore.json(); assert.ok(!prior.students.some(student => student.email?.toLowerCase() === email), 'A profile was created before approval');
  check('No synthetic student profile exists before approval');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base.origin}/admin/registrations`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Student registrations' }).waitFor();
  await page.getByRole('searchbox').fill(email);
  const applicationLink = page.getByRole('link').filter({ hasText: name });
  await applicationLink.waitFor(); await screenshot('admin-list');
  const href = await applicationLink.getAttribute('href'); assert.match(href ?? '', /^\/admin\/registrations\/[0-9a-f-]+$/i);
  const id = href.split('/').at(-1); assert.match(id, uuid);
  // Record IDs as soon as they are known, even if a later assertion fails.
  report.registrationId = id;
  await applicationLink.click(); await page.getByRole('heading', { name, exact: true }).waitFor();
  const beforeDetail = await context.request.get(`${base.origin}/api/admin/registrations/${id}`); assert.equal(beforeDetail.status(), 200);
  const beforeState = await beforeDetail.json(), fixtureBatch = beforeState.batches.find(item => item.id === batch);
  assert.ok(fixtureBatch && /^REGISTRATION QA\b/i.test(fixtureBatch.name), 'Refusing to use a batch without the dedicated REGISTRATION QA label');
  assert.equal(fixtureBatch.active_students, 0, 'Dedicated test batch must start empty');
  assert.equal(fixtureBatch.max_students, 1, 'Dedicated test batch must have exactly one seat');
  await page.getByLabel('Assign batch').selectOption(batch);
  await screenshot('admin-review');
  const approval = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/api/admin/registrations/${id}/approve`);
  await page.getByRole('button', { name: 'Approve application' }).click();
  const approved = await approval; assert.equal(approved.status(), 200, 'Approval failed');
  const result = await approved.json(); assert.equal(result.success, true); assert.equal(result.invitation, 'deferred', 'Invitation must remain disabled');
  await page.getByText('No setup link was sent.', { exact: false }).waitFor();
  const detail = await context.request.get(`${base.origin}/api/admin/registrations/${id}`); assert.equal(detail.status(), 200);
  const stored = await detail.json();
  assert.equal(stored.application.status, 'approved'); assert.equal(stored.application.invitation_status, 'not_sent'); assert.ok(stored.application.student_id);
  report.studentId = stored.application.student_id;
  const student = await context.request.get(`${base.origin}/api/admin/students/${stored.application.student_id}`); assert.equal(student.status(), 200);
  const admission = await student.json();
  assert.ok(admission.profile.student_code, 'Permanent Student Code missing');
  assert.equal(admission.profile.email.toLowerCase(), email);
  assert.ok(admission.enrollments.some(item => item.program_id === program && item.batch_id === batch && item.status === 'active'), 'Expected active program and batch enrollment missing');
  check('Student Code and assigned program/batch persisted');
  const afterBatch = stored.batches.find(item => item.id === batch);
  assert.equal(afterBatch?.active_students, 1, 'QA batch UI count did not increase from 0 to 1');
  assert.equal(afterBatch?.max_students, 1);
  check('Dedicated batch displays full after its last seat is assigned');
  const repeated = await context.request.post(`${base.origin}/api/admin/registrations/${id}/approve`, { headers: { Origin: base.origin }, data: { batch_id: batch } });
  assert.equal(repeated.status(), 409, 'Repeated approval must be rejected');
  await screenshot('admin-approved');
  check('Admin approval persists once and leaves setup link unsent');
  report.notes = 'Synthetic registration, account, profile, enrollment and audit records remain in staging for authorized verification. They are marked STAGING QA and listed above. Do not delete or alter them automatically; approved identity guards and enrollment history require an agreed administrator cleanup procedure.';
} finally {
  writeFileSync(`${folder}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}

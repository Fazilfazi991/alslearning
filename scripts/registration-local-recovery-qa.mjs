// Programmatic local provider/route integration; this is not browser evidence.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';

export async function runLocalRecoveryQA({ sql, service, anon, adminPassword, adminId }) {
  assert.equal(process.env.ALS_LOCAL_PASSWORD_MIN_LENGTH, '32');
  assert.equal(process.env.ALS_LOCAL_PROVIDER_REJECTION_QA, '1');
  const site = 'http://127.0.0.1:19422', proxy = 'http://127.0.0.1:19424';
  const requestId = 'b1000000-0000-4000-8000-000000000011', program = 'b1000000-0000-4000-8000-000000000001', batch = 'b1000000-0000-4000-8000-000000000003';
  const email = 'recovery-student@example.test';
  const original = `A!9${randomBytes(24).toString('hex')}z`, weak = `A!9${randomBytes(8).toString('hex')}z`, replacement = `B!8${randomBytes(24).toString('hex')}z`;
  sql(`select public.submit_student_registration('Recovery QA Student','${email}','+919777777777','BSc','Synthetic College','${program}',null,null,true,'${requestId}',repeat('a',64),repeat('b',64),repeat('c',64),null);`);
  const registration = sql(`select id from public.student_registrations where email='${email}'`);
  assert.ok(registration, 'Synthetic application missing');
  const admission = { actor_id: adminId, registration_id: registration, full_name: 'Recovery QA Student', phone: '+919777777777', admission_on: '2026-11-10', program_id: program, batch_id: batch, access_starts_at: '2026-11-10T00:00:00Z', unassigned: false, is_active: true };
  async function auth(path, body, bearer = '', method = 'POST') {
    const response = await fetch(`http://127.0.0.1:19421${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  const created = await auth('/admin/users', { email, password: original, email_confirm: false, app_metadata: { role: 'student', lms_admission: admission }, user_metadata: { full_name: 'Recovery QA Student' } }, service);
  assert.equal(created.status, 200, 'Synthetic admission failed');
  const student = created.data.id;
  const studentCode = sql(`select student_code from public.profiles where id='${student}'`);
  assert.ok(studentCode, 'Synthetic student code missing');
  const initial = await auth(`/invite?redirect_to=${encodeURIComponent(`${site}/auth/callback`)}`, { email }, service);
  assert.equal(initial.status, 200, 'Synthetic invitation failed');
  assert.equal(initial.data.id, student);

  async function latestLink(type, excludeHash = null) {
    for (let i = 0; i < 40; i++) {
      const list = await (await fetch('http://127.0.0.1:19425/api/v1/messages')).json();
      const messages = list.messages?.filter(item => item.To?.some(recipient => recipient.Address === email)) || [];
      for (const message of messages) {
        const detail = await (await fetch(`http://127.0.0.1:19425/api/v1/message/${message.ID}`)).json();
        const link = (detail.HTML || '').match(/href="([^"]+)"/);
        if (link) { const parsed = new URL(link[1].replaceAll('&amp;', '&')); if (parsed.searchParams.get('type') === type && parsed.searchParams.get('token_hash') !== excludeHash) return parsed; }
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Synthetic invitation not received');
  }
  const cookies = new Map();
  function collect(response, target) {
    for (const value of response.headers.getSetCookie()) {
      const first = value.split(';', 1)[0], index = first.indexOf('=');
      if (index > 0) { const name = first.slice(0, index), val = first.slice(index + 1); if (val) target.set(name, val); else target.delete(name); }
    }
  }
  const cookieHeader = target => [...target].map(([name, value]) => `${name}=${value}`).join('; ');
  async function redeem(link, target) {
    assert.ok(link.origin === site && link.pathname === '/auth/callback' && link.searchParams.get('token_hash'), 'Synthetic invitation template is malformed');
    const form = new URLSearchParams({ token_hash: link.searchParams.get('token_hash'), type: link.searchParams.get('type'), registration_recovery: link.searchParams.get('registration_recovery') || '' });
    const response = await fetch(`${site}/auth/callback`, { method: 'POST', redirect: 'manual', headers: { Origin: site, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(target) }, body: form });
    assert.equal(response.status, 303, 'Synthetic callback failed');
    if (new URL(response.headers.get('location')).pathname !== '/auth/setup') {
      const diagnostic = sql(`select coalesce(email_confirmed_at is not null,false)::text||':'||(select count(*) from auth.sessions where user_id='${student}')::text||':'||(select count(*) from private.registration_setup_operations where student_id='${student}')::text from auth.users where id='${student}'`);
      const direct = await auth('/verify', { token_hash: link.searchParams.get('token_hash'), type: link.searchParams.get('type') });
      throw new Error(`Synthetic proof was not accepted (email confirmed:sessions:operations = ${diagnostic}; direct verification status = ${direct.status})`);
    }
    collect(response, target);
  }
  async function setup(password, target) {
    return fetch(`${site}/api/auth/setup`, { method: 'POST', headers: { Origin: site, 'Content-Type': 'application/json', Cookie: cookieHeader(target) }, body: JSON.stringify({ password }) });
  }
  await redeem(await latestLink('invite'), cookies);
  const oldCookies = new Map(cookies);
  assert.equal((await setup(weak, cookies)).status, 422, 'Real provider rejection was not classified');
  const operation = sql(`select id from private.registration_setup_operations where student_id='${student}'`);
  assert.ok(operation, 'Original operation missing');
  assert.equal(sql(`select state||':'||provider_outcome from private.registration_setup_operations where id='${operation}'`), 'provider_rejected:confirmed_rejection');
  assert.equal((await auth('/token?grant_type=password', { email, password: original })).status, 200, 'Prior synthetic credential stopped working');
  assert.notEqual((await auth('/token?grant_type=password', { email, password: weak })).status, 200, 'Rejected synthetic credential worked');

  const adminCookies = new Map();
  const admin = createServerClient(proxy, anon, { cookies: { getAll: () => [...adminCookies].map(([name,value]) => ({ name, value })), setAll: values => { for (const {name,value} of values) adminCookies.set(name,value); } } });
  assert.equal((await admin.auth.signInWithPassword({ email: 'browser-admin@example.test', password: adminPassword })).error, null, 'Synthetic Admin login failed');
  const post = async (path, body) => fetch(`${site}${path}`, { method: 'POST', headers: { Origin: site, 'Content-Type': 'application/json', Cookie: cookieHeader(adminCookies) }, body: JSON.stringify(body) });
  assert.equal((await post(`/api/admin/registrations/${registration}/setup-recovery`, { operationId: operation, reason: 'operator_assisted_setup' })).status, 200, 'Operator authorization failed');
  assert.equal((await post(`/api/admin/registrations/${registration}/setup-recovery`, { operationId: operation, reason: 'operator_assisted_setup' })).status, 409, 'Duplicate authorization was accepted');
  const firstInvitation = await post(`/api/admin/registrations/${registration}/invite`, {});
  assert.equal(firstInvitation.status, 200, 'Recovery invitation request failed');
  assert.equal((await firstInvitation.json()).invitation, 'sent', 'Recovery invitation was not dispatched');
  const olderRecovery = await latestLink('recovery');
  // Exercise a later resend without waiting: only synthetic local clock fields
  // are advanced; this does not assert a different production cooldown.
  sql(`update auth.users set recovery_sent_at=clock_timestamp()-interval '2 minutes' where id='${student}'; update public.student_registrations set invitation_attempted_at=clock_timestamp()-interval '2 hours' where id='${registration}';`);
  const retried = await post(`/api/admin/registrations/${registration}/invite`, {});
  assert.equal(retried.status, 200, 'Recovery invitation retry failed');
  assert.equal((await retried.json()).invitation, 'sent', 'Recovery invitation retry was not dispatched');
  const newestRecovery = await latestLink('recovery', olderRecovery.searchParams.get('token_hash'));
  assert.notEqual((await auth('/verify', { token_hash: olderRecovery.searchParams.get('token_hash'), type: 'recovery' })).status, 200, 'Older recovery token remained valid after resend');
  const recoveryCookies = new Map();
  await redeem(newestRecovery, recoveryCookies);
  assert.equal((await setup(replacement, recoveryCookies)).status, 200, 'Replacement setup failed');
  assert.notEqual((await setup(weak, oldCookies)).status, 200, 'Original grant was reused');
  const login = await auth('/token?grant_type=password', { email, password: replacement });
  assert.equal(login.status, 200, 'Replacement password login failed');
  const access = async slug => {
    const response = await fetch(`${proxy}/rest/v1/learning_content?slug=eq.${slug}&select=id`, { headers: { apikey: anon, Authorization: `Bearer ${login.data.access_token}` } });
    assert.equal(response.status, 200, 'Student content check failed');
    return (await response.json()).length;
  };
  assert.equal(await access('browser-assigned-note'), 1);
  assert.equal(await access('browser-unrelated-note'), 0);
  assert.equal(sql(`select count(*) from auth.users where lower(email)='${email}'`), '1');
  assert.equal(sql(`select count(*) from public.enrollments where student_id='${student}' and batch_id='${batch}' and status='active'`), '1');
  assert.ok(sql(`select student_code from public.profiles where id='${student}'`) === studentCode, 'Student code changed during recovery');
  assert.equal(sql(`select count(*) from private.registration_setup_operations where student_id='${student}' and replaces_operation_id='${operation}'`), '1');
  console.log('Local recovery: confirmed rejection, single Admin authorization, fresh proof, real login and student-scoped content checks passed.');
}

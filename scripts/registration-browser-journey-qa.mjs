// Real local-browser acceptance. This script never prints links or credentials.
// The human completes all new-password entry and submission in the browser.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const require = createRequire(join(tmpdir(), 'als-playwright-test-tooling', 'package.json'));
const { chromium } = require('playwright-core');
const site = 'http://127.0.0.1:19422';
const email = 'fresh-browser-student@example.test';
const evidence = await mkdtemp(join(tmpdir(), 'als-browser-acceptance-'));
async function refreshThroughLocalFixture(page) {
  await page.goto('http://127.0.0.1:19424/__local_refresh');
  const refreshed = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token' && response.request().method() === 'POST';
  });
  await page.getByRole('button', { name: 'Refresh session' }).click();
  assert.equal((await refreshed).status(), 200, 'Local Auth session refresh failed');
  await page.getByText('Session refreshed').waitFor();
}

export async function runBrowserJourney({ sql, adminPassword }) {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: false, args: ['--no-first-run', '--disable-extensions'] });
  let stage = 'initialization', student, studentId, handoffStarted = false, setupStatus = 0, callbackPost = false, callbackSameOrigin = false, callbackNullOrigin = false, callbackOriginOnlyReferrer = false, callbackStatus = 0;
  try {
    const adminContext = await browser.newContext(), studentContext = await browser.newContext();
    assert.equal((await studentContext.cookies()).length, 0, 'Student context started with cookies');
    const admin = await adminContext.newPage(); student = await studentContext.newPage();
    await student.goto(`${site}/login`);
    assert.deepEqual(await student.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    assert.equal((await studentContext.cookies()).length, 0, 'Student context had cookies before sign-in');
    await student.screenshot({ path: join(evidence, 'student-clean-login.png') });
    console.log('BROWSER_QA clean student context verified');

    stage = 'registration personal details';
    await admin.goto(`${site}/register`);
    await admin.getByLabel('Full name').fill('Fresh Browser Student');
    await admin.getByLabel('Email address').fill(email);
    await admin.getByLabel('Phone / WhatsApp').fill('+919666666666');
    await admin.getByRole('button', { name: 'Continue' }).click();
    stage = 'registration education details';
    await admin.getByLabel('Qualification').fill('BSc MLT');
    await admin.getByLabel('Institution').fill('Synthetic College');
    await admin.getByRole('button', { name: 'Continue' }).click();
    stage = 'registration program selection';
    await admin.locator('#registration-programId').selectOption('b1000000-0000-4000-8000-000000000001');
    stage = 'registration program continue';
    await admin.getByRole('button', { name: 'Continue' }).click();
    stage = 'registration review and submit';
    await admin.getByRole('checkbox').check();
    await admin.getByRole('button', { name: 'Submit application' }).click();
    await admin.getByRole('heading', { name: 'Your application has been received.' }).waitFor();

    stage = 'actual Admin login and approval';
    await admin.goto(`${site}/login`);
    await admin.getByLabel('Email address').fill('browser-admin@example.test');
    await admin.getByLabel('Password', { exact: true }).fill(adminPassword);
    await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
    await admin.waitForURL('**/admin');
    stage = 'fixture refresh readiness';
    await refreshThroughLocalFixture(admin);
    stage = 'actual Admin login and approval';
    await admin.goto(`${site}/admin/registrations`);
    await admin.getByRole('link', { name: /Fresh Browser Student/ }).click();
    await admin.getByLabel('Assign batch').selectOption('b1000000-0000-4000-8000-000000000003');
    await admin.getByRole('button', { name: 'Approve application' }).click();
    await admin.getByText('This application has been approved.').waitFor();
    await admin.getByText(/setup email requested; delivery not confirmed/i).first().waitFor();
    const registrationId = new URL(admin.url()).pathname.split('/').at(-1);
    const studentLink = await admin.getByRole('link', { name: 'Open student' }).getAttribute('href');
    assert.ok(studentLink?.startsWith('/admin/students/'));
    studentId = studentLink.split('/').at(-1);
    assert.equal(sql(`select count(*) from auth.users where lower(email)='${email}'`), '1');
    assert.equal(sql(`select count(*) from public.profiles p join public.enrollments e on e.student_id=p.id where p.id='${studentId}' and p.student_code is not null and p.role='student' and p.is_active and e.batch_id='b1000000-0000-4000-8000-000000000003' and e.status='active'`), '1');
    const studentCode = sql(`select student_code from public.profiles where id='${studentId}'`);
    await admin.screenshot({ path: join(evidence, 'admin-approval.png') });
    console.log('BROWSER_QA Admin approval and identity verified');

    stage = 'invitation delivery';
    let invitation;
    for (let i = 0; i < 40 && !invitation; i++) {
      const list = await (await fetch('http://127.0.0.1:19425/api/v1/messages')).json();
      const message = list.messages?.find(item => item.To?.some(recipient => recipient.Address === email));
      if (message) {
        const detail = await (await fetch(`http://127.0.0.1:19425/api/v1/message/${message.ID}`)).json();
        const link = (detail.HTML || '').match(/href="([^"]+)"/);
        if (link) invitation = link[1].replaceAll('&amp;', '&');
      }
      if (!invitation) await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(invitation, 'Synthetic invitation missing');
    console.log('BROWSER_QA invitation received');
    student.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/auth/callback') { callbackPost = true; callbackSameOrigin = request.headers().origin === site; callbackNullOrigin = request.headers().origin === 'null'; callbackOriginOnlyReferrer = request.headers().referer === `${site}/`; }
    });
    student.on('response', response => {
      if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/auth/callback') callbackStatus = response.status();
      if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/setup') setupStatus = response.status();
    });
    stage = 'invitation navigation';
    await student.goto(invitation);
    stage = 'invitation continuation';
    await student.getByRole('button', { name: 'Continue to account setup' }).click();
    stage = 'callback redemption';
    await student.waitForURL('**/auth/setup');
    assert.ok(callbackPost && callbackSameOrigin && !callbackNullOrigin && callbackOriginOnlyReferrer, 'Callback request did not use the expected origin-only policy');
    await student.getByRole('heading', { name: 'Set up your student account' }).waitFor();
    await student.screenshot({ path: join(evidence, 'student-setup-empty.png') });
    await student.bringToFront();
    stage = 'user password handoff';
    handoffStarted = true;
    console.log('BROWSER_QA_USER_HANDOFF_READY');
    await Promise.any([
      student.getByText('Your password is set.').waitFor({ timeout: 900000 }),
      student.waitForURL(/\/login(?:\?|$)/, { timeout: 900000 }),
      student.waitForURL('**/student', { timeout: 900000 }),
    ]);
    if (new URL(student.url()).pathname === '/auth/setup') await student.getByRole('link', { name: 'Sign in to start learning' }).click();
    if (new URL(student.url()).pathname !== '/student') {
      await student.waitForURL('**/login');
      await student.getByLabel('Email address').fill(email);
      await student.bringToFront();
      console.log('BROWSER_QA_USER_LOGIN_READY');
      await student.waitForURL('**/student', { timeout: 900000 });
    }
    assert.equal(setupStatus, 200, 'Successful setup request was not observed');
    stage = 'student access';
    await student.getByRole('button', { name: 'Logout', exact: true }).first().waitFor();
    await student.screenshot({ path: join(evidence, 'student-dashboard.png') });
    console.log('BROWSER_QA real student login verified');
    await student.getByRole('button', { name: 'Logout', exact: true }).first().click();
    await student.waitForURL('**/login');
    await student.getByLabel('Email address').fill(email);
    await student.bringToFront();
    console.log('BROWSER_QA_USER_RELOGIN_READY');
    await student.waitForURL('**/student', { timeout: 900000 });
    console.log('BROWSER_QA explicit logout and fresh login verified');
    stage = 'real session refresh';
    await refreshThroughLocalFixture(student);
    await student.goto(`${site}/student`);
    await student.waitForURL('**/student');
    console.log('BROWSER_QA actual Auth session refresh verified');
    await student.goto(`${site}/student/courses/browser-assigned`);
    await student.getByText('Browser QA Assigned').first().waitFor();
    await student.getByText('Browser QA Permitted Note').first().waitFor();
    await student.reload();
    await student.getByText('Browser QA Assigned').first().waitFor();
    await student.getByText('Browser QA Permitted Note').first().waitFor();
    await student.screenshot({ path: join(evidence, 'assigned-course.png') });
    await student.goto(`${site}/student/learn/browser-assigned-note`);
    await student.getByText('Browser QA Permitted Note').first().waitFor();
    await student.getByText('Synthetic permitted lesson text.').waitFor();
    await student.screenshot({ path: join(evidence, 'assigned-note.png') });
    stage = 'unrelated course denial';
    const otherCourse = await student.goto(`${site}/student/courses/browser-unrelated`);
    await student.getByText(/\b404\b|page could not be found|not found|access denied/i).first().waitFor({ timeout: 30000 });
    const courseText = await student.locator('body').innerText();
    const coursePayload = await otherCourse.text();
    const courseBoundary = /\b404\b|page could not be found|not found|access denied/i.test(courseText);
    const courseLeaked = courseText.includes('Browser QA Unrelated') || coursePayload.includes('Browser QA Unrelated') || coursePayload.includes('Synthetic unrelated private lesson text.');
    console.log(JSON.stringify({ unrelatedCourseStatus: otherCourse?.status(), visibleDenial: courseBoundary, unrelatedPayloadPresent: courseLeaked }));
    await student.screenshot({ path: join(evidence, 'unrelated-course-denied.png') });
    assert.ok(courseBoundary && !courseLeaked, 'Unrelated course denial was not visibly established');
    stage = 'unrelated material denial';
    const otherNote = await student.goto(`${site}/student/learn/browser-unrelated-note`);
    await student.getByText(/\b404\b|page could not be found|not found|access denied/i).first().waitFor({ timeout: 30000 });
    const noteText = await student.locator('body').innerText();
    const notePayload = await otherNote.text();
    const noteBoundary = /\b404\b|page could not be found|not found|access denied/i.test(noteText);
    const noteLeaked = noteText.includes('Browser QA Unrelated Note') || noteText.includes('Synthetic unrelated private lesson text.') || notePayload.includes('Browser QA Unrelated Note') || notePayload.includes('Synthetic unrelated private lesson text.');
    console.log(JSON.stringify({ unrelatedMaterialStatus: otherNote?.status(), visibleDenial: noteBoundary, unrelatedPayloadPresent: noteLeaked }));
    await student.screenshot({ path: join(evidence, 'unrelated-note-denied.png') });
    assert.ok(noteBoundary && !noteLeaked, 'Unrelated material denial was not visibly established');
    console.log('BROWSER_QA assigned pages and unrelated denial verified');

    stage = 'second real Student session';
    const oldContext = await browser.newContext(), oldSession = await oldContext.newPage();
    assert.equal((await oldContext.cookies()).length, 0);
    await oldSession.goto(`${site}/login`);
    await oldSession.getByLabel('Email address').fill(email);
    await oldSession.bringToFront();
    console.log('BROWSER_QA_USER_SECOND_SESSION_READY');
    await oldSession.waitForURL('**/student', { timeout: 900000 });
    const oldAuthCookies = () => oldContext.cookies(site).then(items => items.filter(item => item.name.startsWith('sb-') && item.name.includes('auth-token')).length);
    assert.ok(await oldAuthCookies() > 0, 'Second session did not establish an Auth cookie');

    stage = 'Admin deactivation';
    await admin.goto(`${site}${studentLink}`);
    await admin.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await admin.getByRole('button', { name: 'Deactivate student', exact: true }).click();
    await admin.getByRole('button', { name: 'Reactivate', exact: true }).waitFor({ timeout: 15000 });
    await student.goto(`${site}/student/courses/browser-assigned`);
    await student.waitForURL(/\/login(?:\?|$)/);
    await student.screenshot({ path: join(evidence, 'deactivated-session-denied.png') });
    console.log('BROWSER_QA deactivation denial verified');
    stage = 'Admin reactivation';
    await admin.getByRole('button', { name: 'Reactivate', exact: true }).click();
    await admin.getByRole('button', { name: 'Reactivate student', exact: true }).click();
    await admin.getByRole('button', { name: 'Deactivate', exact: true }).waitFor({ timeout: 15000 });
    assert.ok(await oldAuthCookies() > 0, 'Untouched old session cookie disappeared before the post-reactivation check');
    await oldSession.goto(`${site}/student/courses/browser-assigned`);
    await oldSession.waitForURL(/\/login(?:\?|$)/);
    await oldSession.screenshot({ path: join(evidence, 'reactivated-old-session-denied.png') });
    await student.goto(`${site}/login`);
    await student.getByLabel('Email address').fill(email);
    await student.bringToFront();
    console.log('BROWSER_QA_USER_REACTIVATED_LOGIN_READY');
    await student.waitForURL('**/student', { timeout: 900000 });
    console.log('BROWSER_QA old session denied and fresh login after reactivation verified');
    stage = 'clean recovery context';
    const recoveryContext = await browser.newContext();
    assert.equal((await recoveryContext.cookies()).length, 0, 'Recovery context started with cookies');
    const recovery = await recoveryContext.newPage();
    await recovery.goto(`${site}/login`);
    assert.deepEqual(await recovery.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    assert.equal((await recoveryContext.cookies()).length, 0, 'Recovery context had cookies');
    await recovery.goto(invitation);
    await recovery.getByRole('button', { name: 'Continue to account setup' }).click();
    await recovery.waitForURL(/\/login\?error=invalid-link/);
    await recovery.screenshot({ path: join(evidence, 'old-invitation-denied.png') });
    console.log('BROWSER_QA consumed invitation denied in clean context');

    stage = 'audited recovery authorization';
    const status = await admin.request.get(`${site}/api/admin/registrations/${registrationId}/setup-recovery`);
    assert.equal(status.status(), 200, 'Admin recovery status unavailable');
    const statusBody = await status.json();
    const operation = statusBody.operations?.find(item => item.state === 'provider_confirmed');
    assert.ok(operation?.id, 'Confirmed source operation unavailable');
    const authorization = await admin.request.post(`${site}/api/admin/registrations/${registrationId}/setup-recovery`, { headers: { Origin: site }, data: { operationId: operation.id, reason: 'operator_assisted_setup' } });
    assert.equal(authorization.status(), 200, 'Admin recovery authorization failed');
    // Simulate the existing one-hour resend cooldown in this disposable DB.
    // This does not change the application's or provider's configured policy.
    sql(`update public.student_registrations set invitation_attempted_at=clock_timestamp()-interval '2 hours' where id='${registrationId}';`);
    await admin.goto(`${site}/admin/registrations/${registrationId}`);
    await admin.getByRole('button', { name: 'Send setup link' }).click();
    await admin.getByText(/Setup email requested/).first().waitFor();
    let recoveryInvitation;
    for (let i = 0; i < 40 && !recoveryInvitation; i++) {
      const list = await (await fetch('http://127.0.0.1:19425/api/v1/messages')).json();
      const messages = list.messages?.filter(item => item.To?.some(recipient => recipient.Address === email)) || [];
      for (const message of messages) {
        const detail = await (await fetch(`http://127.0.0.1:19425/api/v1/message/${message.ID}`)).json();
        const match = (detail.HTML || '').match(/href="([^"]+)"/);
        if (match) { const link = match[1].replaceAll('&amp;', '&'); if (new URL(link).searchParams.get('type') === 'recovery') { recoveryInvitation = link; break; } }
      }
      if (!recoveryInvitation) await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(recoveryInvitation, 'Synthetic recovery invitation missing');
    let recoverySetupStatus = 0;
    recovery.on('response', response => {
      if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/setup') recoverySetupStatus = response.status();
    });
    await recovery.goto(recoveryInvitation);
    await recovery.getByRole('button', { name: 'Continue to account setup' }).click();
    await recovery.waitForURL('**/auth/setup');
    await recovery.screenshot({ path: join(evidence, 'recovery-setup-empty.png') });
    await recovery.bringToFront();
    stage = 'user recovery password handoff';
    console.log('BROWSER_QA_USER_RECOVERY_READY');
    await Promise.any([
      recovery.getByText('Your password is set.').waitFor({ timeout: 900000 }),
      recovery.waitForURL(/\/login(?:\?|$)/, { timeout: 900000 }),
      recovery.waitForURL('**/student', { timeout: 900000 }),
    ]);
    if (new URL(recovery.url()).pathname === '/auth/setup') await recovery.getByRole('link', { name: 'Sign in to start learning' }).click();
    if (new URL(recovery.url()).pathname !== '/student') {
      await recovery.waitForURL('**/login');
      await recovery.getByLabel('Email address').fill(email);
      await recovery.bringToFront();
      console.log('BROWSER_QA_USER_RECOVERY_LOGIN_READY');
      await recovery.waitForURL('**/student', { timeout: 900000 });
    }
    assert.equal(recoverySetupStatus, 200, 'Successful recovery setup request was not observed');
    const session = await recovery.request.get(`${site}/api/auth/session`);
    assert.equal(session.status(), 200);
    const studentSession = await session.json();
    assert.ok(studentSession.id === studentId && studentSession.role === 'student', 'Recovery changed Student identity or role');
    assert.equal(sql(`select count(*) from auth.users where lower(email)='${email}'`), '1');
    assert.ok(sql(`select student_code from public.profiles where id='${studentId}'`) === studentCode, 'Student Code changed');
    assert.equal(sql(`select count(*) from public.enrollments where student_id='${studentId}' and batch_id='b1000000-0000-4000-8000-000000000003' and status='active'`), '1');
    console.log('BROWSER_QA fresh recovery login and identity preservation verified');
    console.log(`BROWSER_QA evidence directory: ${evidence}`);
  } catch {
    // Never print raw browser errors: they may contain a one-time invitation URL.
    console.error(`BROWSER_QA blocked at ${stage}`);
    if (student && ['invitation navigation','invitation continuation','callback redemption'].includes(stage)) {
      const path = new URL(student.url()).pathname;
      const counts = studentId ? sql(`select coalesce(email_confirmed_at is not null,false)::text||':'||(select count(*) from auth.sessions where user_id='${studentId}')::text||':'||(select count(*) from private.registration_setup_operations where student_id='${studentId}')::text from auth.users where id='${studentId}'`) : 'unavailable';
      console.error(JSON.stringify({ onCallback: path === '/auth/callback', onLogin: path === '/login', onSetup: path === '/auth/setup', continueButton: await student.getByRole('button', { name: 'Continue to account setup' }).isVisible().catch(() => false), callbackPost, callbackSameOrigin, callbackNullOrigin, callbackStatus, confirmedSessionOperationCounts: counts }));
    }
    if (handoffStarted) {
      console.error(JSON.stringify({ studentPageClosed: student?.isClosed() ?? null, studentContextPages: student ? student.context().pages().length : null, browserConnected: browser.isConnected(), observedSetupStatus: setupStatus }));
      if (student && !student.isClosed()) {
        const path = new URL(student.url()).pathname;
        console.error(JSON.stringify({ onSetup: path === '/auth/setup', onLogin: path === '/login', onStudent: path === '/student', observedSetupStatus: setupStatus, visibleAlert: await student.getByRole('alert').isVisible().catch(() => false) }));
      }
      console.error(`BROWSER_QA fixture preserved for review; evidence directory: ${evidence}`);
      await new Promise(resolve => { process.once('SIGTERM', resolve); process.once('SIGINT', resolve); });
    }
    throw new Error(`Local browser acceptance stopped at ${stage}`);
  } finally { await browser.close(); }
}

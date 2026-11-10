# Shared Auth handoff: registration setup and deactivation

## Boundary and ownership

Registration owns `src/app/api/auth/setup/route.ts` and registration tests. The security workstream owns deactivation, session guards and Auth hook migrations. The registration route uses existing authenticated profile RLS for a second, fresh authorization read after the external password update. A denied or uncertain read produces no success, clears the setup grant, attempts local sign-out and tells the student the password may have changed. A later deactivation must still deny access through the shared database guards. The registration invitation/setup hard guard remains false.

## Before and after

On 10 November 2026 a synthetic actual-route test against local PostgreSQL/PostgREST paused the simulated Auth update after the profile authorization read. Deactivation committed while the call was held. Before the route change, the explicit regression failed: HTTP 200 instead of 403. After the route change it passed with 403. The simulated credential write completed; this test does not claim it was cancelled. Returned and thrown simulated Auth errors after dispatch also produce an uncertain result, clear the browser grant, attempt local sign-out and avoid retry advice. Protected enrollment reads returned no rows after deactivation, an old session remained denied after reactivation, and the Student role and enrollment count were unchanged. Active Student setup, deactivation first, revocation while the write was held, deactivation after success, an independent Auth ban, and Student/Teacher/Admin active-role checks also passed locally.

A separate expired-session regression exposed the security candidate's missing `auth.sessions.not_after` check: an expired session produced HTTP 200 before the shared fix. The security owner drafted changes to `20261109131213_inactive_session_rls_guard.sql` and `20261109144426_active_account_auth_hook.sql`. Only those two function definitions were replaced in the isolated registration lab, preserving owner and ACL. Their null/future/past expiration SQL test and the previously failing registration regression then passed. This is not evidence that inactivity timeouts or hosted Auth session semantics are fully covered.

## Reproduction and evidence limits

The initial isolated union replay used registration baseline `18b7ae273714c1463a5d18a949116868a0e609f8` and initial security baseline `745467462c719e07a4d73faf1950833f86c5f582`, replaying the migrations from both trees in timestamp order. Shared migration prerequisites: `20261109131213`, `20261109144426`, `20261109181310`, `20261110005655`; registration migrations `20261110062353`, `20261110063116`, `20261110080919`; security media migrations `20261110104404`, `20261110110000`. This describes a local synthetic replay, not a deployment order approval. The expiry correction was then applied as two CREATE OR REPLACE function definitions to the disposable lab; the shared expiry correction was committed by the security owner at `98ca62ea55b7666f59c74707d8dec0313c4366c1`. A fresh timestamp-ordered union replay against the committed security tree passed all nine registration race tests. The registration candidate must be committed and independently verified before recording the final pair. These security files are revised draft migrations; a hosted target that has already recorded earlier versions would need a separately reviewed forward migration, not migration-history rewriting.

The lab uses the actual setup route and real PostgREST/PostgreSQL RLS and account-session functions, but simulates Supabase Auth `getUser`, `getClaims`, `updateUser` and `signOut`; the hard guard is overridden only in tests. The lab does not establish a real credential write, managed Auth hook behavior, email delivery or hosted compatibility. No hosted settings were changed.

The initial candidate lab and exact committed-security replay are distinct. The retained committed-security lab test command is:

```powershell
$env:ALS_REGISTRATION_RACE_LAB='1'
$env:ALS_REGISTRATION_RACE_CONTAINER='als-registration-race-committed-pg'
$env:ALS_REGISTRATION_RACE_API='http://127.0.0.1:38129'
pnpm exec vitest run src/app/api/auth/setup/registration-race.lab.test.ts --testTimeout=30000
```

Separate GoTrue v2.197.0, Mailpit and PostgreSQL admission testing used registration migrations only: a local resend reused the same unconfirmed identity, identity count stayed one, latest invitation was verified, password login succeeded, and an existing student retained the Student Code. To simulate resend cooldown, the disposable fixture moved `confirmation_sent_at` back two minutes. This was local provider evidence, not a combined security-candidate or hosted acceptance.

## Release blockers

The post-write recheck is not an atomic cancellation mechanism. A late Auth password change can complete; security review accepts the locally observed behavior only if access remains denied. Hosted independent bans, hook installation, actual Auth response/revocation and fresh-device setup remain untested. On an uncertain password update, the route clears the browser grant and attempts sign-out, but copied grants are not durably quarantined or made one-use. Uncertain update and revocation logs are best effort, not a durable, session-specific reconciliation queue. Staging window, approved inbox and canonical production domain remain unverified. No merge, production change or invitation enablement is authorized by this handoff.

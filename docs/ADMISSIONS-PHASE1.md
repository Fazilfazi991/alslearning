# ALS Admissions Phase 1 — verified staging delivery

**PASS — ready for the admissions client demonstration.** PR #1 remains unmerged.

[Verified staging preview](https://als-admissions-phase1-staging-faziils-projects.vercel.app/). Uses the existing staging access gate and role accounts. A temporary Vercel share link is supplied privately in the chat; no passwords or share tokens are committed.

Verified application revision: `e09132e3406415ec49a521a5f95acdddad19be0c`; Vercel Preview deployment `dpl_R6YhkzhX7skaUcfVcg8kREtokh3D`, READY. Later documentation/test-runner commits do not change application code.

## Completed fixes

- Homepage keeps ALS branding and real active programs, with responsive course cards, an enquiry form, consent, accessible validation and clear submission states. Tablet card links no longer clip.
- Shared unknown-IP throttling is removed. Signed HttpOnly browser identities have independent 10/hour quotas; the durable phone limit remains 3/hour across browser resets. Caller IP headers are ignored by default. The approved Preview leaves trusted IP headers disabled. Cookie identity is a fairness control, not proof against a bot clearing cookies; the phone quota remains enforced.
- Enquiries support search, status/course/date filters, sorting, pagination, active-admin assignment, notes, contact history, follow-ups and conversion history. Authenticated non-admins and inactive admins cannot access or mutate these records. Direct table writes and anonymous submission RPC execution are denied.
- All admissions check the canonical handler and enabled Auth triggers before creating an identity. Conversion commits Auth/profile, enrollment, permanent Student Code and enquiry link together. A failed verification read never deletes an admitted student. A verified conversion stays visible even if its history refresh fails or returns stale data.
- Explicit canonical relationship hints preserve Student courses/profile, student history and affected live-class queries when staging has additional composite foreign keys. No portal redesign or schema removal was introduced.

## Database release

Owner-approved target only: `als-live-staging`, ref `slghshcdaijbcjfoqerq`, organization `oenarbsvxrmnsvugjdrz`.

Chrome inspection verified Healthy state, 68 prior migration entries, all **61 applicable prerequisites**, exact pre-admission handler match, enabled Auth INSERT/metadata UPDATE triggers and no active live class. The unrelated `20261004104013_production_live_cleanup_access.sql` grant is intentionally absent and was not applied to staging. Existing extra ERP/transfer migrations were retained.

Applied and verified, each with a source checksum, transaction and migration-history entry:

1. `20261106020602_admission_enquiries.sql`
2. `20261106030644_harden_enquiry_submission_and_rpc_validation.sql`

RLS is enabled on all five new public/private tables. Anonymous table access and RPC submission are denied; authenticated direct writes are denied; the service-only submission wrapper is SECURITY INVOKER. Server program access grants only the five required columns. Actual authenticated Admin admission/conversion readiness returned true.

Original baseline: 27 profiles, 6 programs, 13 batches, 26 enrollments and 22 live sessions. DDL preserved the originals; acceptance created one clearly labelled demo batch and two admitted demo students/enquiries. The second admission received the next permanent sequence (`ALS-ADMMW4F1B8R-002`); first admission retained `...-001`. All original enrollment identities, statuses, batches and access windows remained unchanged.

Security Advisor after refresh: **0 errors**, 46 existing warnings and 6 suggestions. The warnings concern existing public LMS/live/core definer functions and the existing password-protection setting; none match the new admissions/readiness functions. No security settings or keys were changed.

## PASS/FAIL checks

| Check | Result |
| --- | --- |
| Homepage submission → hosted persistence → Admin register | PASS |
| Status, assignment, notes, contact and follow-up/outcome history | PASS |
| Real hosted Supabase Auth admission, Student Code and batch | PASS |
| New Student login, courses and profile; duplicate conversion denied | PASS |
| Teacher portal, Admin modules/student detail and role isolation | PASS |
| Dashboard counts match authorized database queries | PASS |
| Desktop 1440px, tablet 768px and mobile 390px | PASS |
| Loaded screens: no overflow; touch navigation/Escape; JS/console errors | PASS — no errors observed |
| Lint, typecheck, unit tests and import regressions | PASS — 551 unit tests, 13 existing skips; 4 Node regressions |
| Production build | PASS locally with persistent cache temporarily disabled; normal Vercel build PASS |
| Fresh isolated PostgreSQL replay | PASS — all 64 migrations and both admissions SQL suites |

The local drive filled during a cached build. A cache-free retry passed; the original `next.config.ts` was restored and no generated-cache deletion occurred. SQL regression checks cover twelve independent browser/phone identities, durable phone limits, malformed direct RPC denial, inactive permissions, trigger drift, conversion rollback and the historical batch deletion regression.

Browser evidence uses **real hosted Supabase Auth and the deployed Preview**, not an Auth stand-in. Viewport checks used Chrome emulation and synthesized touch; no physical-device test is claimed. Captures wait for the protected session and actual page data. The private demo credentials remain only in ignored local QA output. There are no remaining approval/credential blockers for the admissions demonstration.

Live/recording media entry remains disabled as before; this release tested learning/catalogue pages and preserves existing records, but did not open a new provider-media test window. Production databases, production/shared environment variables, secrets, merging and payments were untouched.

## Screenshots and reproducibility

- [Homepage desktop](evidence/admissions-phase1-hosted/homepage-1440.png), [tablet](evidence/admissions-phase1-hosted/homepage-768.png), [mobile](evidence/admissions-phase1-hosted/homepage-390.png)
- [Filtered Admin register](evidence/admissions-phase1-hosted/enquiries-desktop.png), [tablet register](evidence/admissions-phase1-hosted/enquiries-768.png), [converted enquiry on mobile](evidence/admissions-phase1-hosted/enquiry-detail-390.png)
- [Hosted results](evidence/admissions-phase1-hosted/hosted-verification.json), [prerequisite inspection](evidence/admissions-phase1-hosted/staging-preflight.json), [migration/security verification](evidence/admissions-phase1-hosted/staging-migrations.json)

`scripts/admissions-local-qa.mjs` accepts `ALS_TEST_PSQL` and `ALS_TEST_PGPORT` for a disposable localhost cluster. `scripts/admissions-staging-migrations.mjs` is read-only by default, is restricted to the approved project/two migrations, and refuses automatic prerequisite application. It requires a valid management token; this release used the owner's signed-in Chrome instead.

`scripts/admissions-hosted-qa.mjs` requires `--staging-env`, `--accounts-env`, `--playwright` and, for protected previews, `--share`. It rejects production targets, creates labelled demo fixtures, persists passwords only in ignored local output and can reuse its own empty/available demo batch via `--reuse-batch`. Do not use production credentials.

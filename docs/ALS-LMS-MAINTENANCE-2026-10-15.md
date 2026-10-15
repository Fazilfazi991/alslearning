# ALS LMS maintenance — October 15, 2026

## Release scope and baseline

- Branch: `fix/admin-student-recording-workflows`.
- Base: production `main`, `a1b8530a2f60b402621aa5f49545d12eb6e66e89`.
- Existing Vercel project: `alslearning`, `prj_Pw3QKJifCH1tROnJQlBJ9eS1W743`.
- Production Supabase: `dvmahmkapgtjfqmoottt`; isolated staging: `slghshcdaijbcjfoqerq`.
- Focused LMS changes only; no ERP branch integration.

## Implemented workflows

- One accessible header Logout per portal; real server/browser Supabase sign-out,
  protected identity revalidation before showing cached layout content, and
  server guards. Browser Back exposed a cached-shell defect during testing;
  the shared protected wrapper and no-store identity endpoint address it.
- Genuine live recording review in Admin Recorded Classes, supported capture
  and review states, asset ownership/readiness checks, preview, metadata,
  atomic approve/publish/unpublish/reject, and a single published catalogue
  shared with Student courses and dashboard counts.
- Transactional Auth admission with profile, enrollment, history and atomic
  batch-based permanent Student Code; separate optional profile-photo retry.
- Read-only clickable Student details, separate edit/reset/status actions,
  audited compatible transfers, current access and batch history.
- Permanent codes remain unchanged after transfers. Historical inactive
  enrollments can coexist with a return transfer; only one active enrollment
  per Student/Program is allowed.
- Duplicate preflight/joined microphone controls are mutually exclusive.

## Database changes

Applied to staging; not yet applied to Production:

1. `20261015080421_lms_student_admission_transfers_and_replay_catalog`
2. `20261015083408_lms_admission_auth_metadata_transaction_guard`
3. `20261015084520_lms_identity_reporting_and_review_integrity`
4. `20261015090156_lms_active_assignment_uniqueness_for_return_transfers`
5. `20261015092239_lms_reviewed_identity_backfill_report`
6. `20261015101141_lms_admission_capacity_and_inactive_account_safety`

Rollback transactions were checked before committing DDL. Auth metadata is
written after Auth INSERT, within the same Auth transaction; the second
migration handles that ordering. Real failed admission left no Auth user.
No rollback deletes historical data; reverting identity/history schema after
admission requires a separate reviewed plan. Existing production deployment
can remain on its older additive schema during a release rollback.

## Staging evidence so far

- Lint and typecheck passed before final build.
- 465 Vitest tests passed; 13 existing skips; four importer tests passed.
- 13 initial real hosted Auth/API checks and nine extended integrity checks
  passed, including six concurrent admissions with unique codes, duplicate
  rejection, failed Auth rollback, transfer/return transfer, history/code/
  access preservation, deactivation, password reset and Teacher/Student denial.
- Actual browser logout and Back passed for Admin, Teacher and Student against
  staging Auth with local frontend. This is not hosted-frontend or Production
  acceptance.
- Desktop and narrow mobile Student details, transfer and admission layouts
  inspected. Student profile displays the permanent code and transferred batch.
- Reviewed staging legacy backfill: no collisions or unresolved batch gaps;
  six codes assigned, repeat assigned zero. Existing codes, every enrollment
  (including expiry), and retained recordings remained byte-for-byte unchanged
  in the database observations. Two intentionally ineligible/unassigned fixtures
  remain explicitly pending rather than receiving invented admission batches.
- Production read-only preflight: 54 migrations, five Students, two batches,
  no duplicate active assignments, no live classes. Owner confirmed `suku`
  is a test user and authorized any compatible existing batch for its missing
  admission assignment. Inactive QA outsider remains explicitly Unassigned.

## Staging provider access

Owner approved one 24-hour User R2 token, Object Read & Write only on existing
`als-live-poc-recordings`, in account `c595e85a425e3e575b97d71c994f2e69`.
Name: `ALS LMS Maintenance Staging R2 2026-10-15`. Cloudflare displays expiry
October 16. New credentials are stored only in ignored staging configuration.
An existing ready asset returned HTTP 200. Production/QA R2 credentials,
buckets, subscriptions and billing were not changed.

Existing staging SFU `9a19a0fbdcf8759c89dd6deba41c5f1f` authenticated to an
expired historical session (HTTP 410). Existing TURN key
`4a9c6350cb91389b4fb912a16b316b3e` generated a 60-second credential (HTTP 201).
Generated credentials and signed links are not retained in this report.

## Remaining release gates

- Complete hosted staging frontend/browser, real recording publication and
  unpublication, replay, mobile/tablet, permissions and academic regression.
- Final source build and public-bundle secret scan.
- Production clean identity dry run, compatible test-user assignment, migrations,
  complete Vercel release, actual Production workflows and owned QA cleanup.

Live, recording and POC entry remain disabled until a prepared bounded staging
acceptance window. Production is unchanged at this checkpoint.

## Hosted staging checkpoint

- Complete source `1693abc1568f553a269bb0dae92d6b81a8730db0` is READY on the existing Vercel project, isolated alias `https://als-lms-maintenance-staging-faziils-projects.vercel.app`. Production and shared Preview variables were compared unchanged after branch-scoped staging configuration. Automatic maintenance-branch deployment is disabled; explicit Git-connected deployments preserve the verified author identity.
- Real hosted UI created batch `4ea4caeb-2061-4dc3-b978-7e5ed492058b`, Student `4fdcff8f-f523-4858-97f5-aa85c5f04caf`, and permanent code `ALS-QAHMV9CWJRT-001`. Contact/guardian/access/history fields were verified.
- Hosted Admin, Teacher and Student Logout plus browser Back passed.
- Seven hosted integrity checks passed: full-batch field error without Auth creation, inactive admission and blocked login, concurrent one-seat capacity with no rejected Auth residue, private profile-photo signed preview, Student isolation, existing-session deactivation, and Teacher edit/publication denial. A malformed publication test request initially returned 400; the corrected normal request included classroom mode and returned the required 403.
- The full existing staging batch caused a correctly rolled-back admission. A separate LMS capacity guard was added and observed rejecting over-capacity Auth admission, without changing any pre-existing non-LMS guard. No ERP source was merged. Final inactive status now commits atomically after admission initialization.
- Existing staging R2 CORS rules were retained, adding only the exact authenticated maintenance staging origin. Public bucket access remains disabled.
- One fresh class `e4ab3b0a-7771-4dd9-bd58-17d83095d7e4` is scheduled for the new QA batch and existing assigned Teacher. No recording asset was fabricated. Global live/recording/POC remain off; cron job 1 remains paused. Teacher, Student and synthetic lesson pages are prepared. Owner readiness for the native screen-share chooser is pending.
- Production read-only compatibility report: no incompatible enrollments, no Batch Code proposal collisions. Suku is enrolled in CRE Crash Course, which has no existing compatible batch; the later authorized test assignment requires a clearly named QA batch in that same Program, preserving its enrollment ID and access dates. No production mutation has occurred.
- The browser viewport override did not change measured Chrome CSS width (1280/1440) for a requested tablet size. Real narrow IAB/mobile and desktop views were inspected; tablet verification remains outstanding rather than being inferred from an ignored override. Overrides were reset.

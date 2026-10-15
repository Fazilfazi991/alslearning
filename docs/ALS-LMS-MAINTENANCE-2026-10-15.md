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

Rollback transactions were checked before committing DDL. Auth metadata is
written after Auth INSERT, within the same Auth transaction; the second
migration handles that ordering. Real failed admission left no Auth user.
No rollback deletes historical data; reverting identity/history schema after
admission requires a separate reviewed plan. Existing production deployment
can remain on its older additive schema during a release rollback.

## Staging evidence so far

- Lint and typecheck passed before final build.
- 462 Vitest tests passed; 13 existing skips; four importer tests passed.
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

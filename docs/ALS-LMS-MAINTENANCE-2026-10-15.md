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

## Auth and published catalogue follow-up

- Staging migration `20261015104236_lms_student_auth_deactivation_transaction` is applied. Real Supabase password Auth now rejects a deactivated synthetic Student with `user_banned`; reactivation restores login. Repeated deactivation is idempotent. A rolled-back database check proved an independently imposed Auth restriction is preserved on reactivation.
- Four real Student RLS reads passed: other Student contact/profile isolation, other Student history isolation, Admin audit isolation, and unpublished catalogue isolation.
- Source `962285ab0d8849edb5511a8addf8a93d42787dd4` contains the shared Published classes catalogue in Admin, with separate review and uploaded-class sections. The preserved live recording appears once and the published count is one. Its protected R2 preview loaded metadata and decoded at 1280×720 without a media error.
- Local verification: 465 unit/integration assertions plus 4 importer tests pass; 13 existing skipped tests. Lint, TypeScript, production build and public-bundle secret scan pass (111 files, 7 known server credentials, no matches).
- Complete hosted staging deployment `dpl_9dQhupBX6AARpKo9zNJijYkSfsBU` is READY. Bounded window: 2026-10-15T11:04:19.546Z–11:14:19.546Z. Production and shared Preview settings compared unchanged.
- Preflight: zero live classes, open connections, active/closing tracks/subscriptions, open attendance, uploading segments or R2 multipart uploads; cron remains paused. One historical validating recording awaits review, with no upload work; it was preserved.
- The Teacher started class `e4ab3b0a-7771-4dd9-bd58-17d83095d7e4` through the normal UI. Teacher and Student connected; Teacher microphone publication exists and Student reception reached 67 kbps. Camera is off. The exact Teacher provider session returned HTTP 200 with one track. Chrome's native screen-share chooser is awaiting owner selection; recording has not started at this checkpoint.

## Recording acceptance and access revocation

- First class `e4ab3b0a-7771-4dd9-bd58-17d83095d7e4` produced no recording because the native chooser remained pending. The first End UI click is UNPROVEN; authenticated End API restored safety. It is not counted as normal-button acceptance. All three known provider sessions later returned 410, with all database media/attendance closed.
- Fresh retry class `7d3df5e1-1d2e-4f0c-a306-59858585ce0c` captured only the synthetic lesson screen and Teacher microphone. Owner confirmed live voice was audible, spoke both slide markers and later confirmed the visible recording preview was working. Recording `fbee8aac-6b76-4fe8-b7d7-59ec9fc87552` contains 1,361,093 bytes and 89.813 seconds; browser decoding is 1280×720.
- Normal Teacher End click: 2026-10-15T11:32:07.059Z. Class completed: 11:32:09.528Z. Both roles showed ended without reload; both connections, publications, subscriptions and attendance closed. Both exact provider sessions returned 410/session_error after previously returning 200 with microphone and screen tracks. Cron remained paused; no manual cleanup caused this normal closure. Historical earlier gate verdicts remain historical evidence.
- With global media disabled, genuine Admin preview, metadata save, approval and publication succeeded. New title: QA LMS Published Class mv9cwjrt. Admin catalogue rose from one to two; eligible Student Program → Subject showed one Class and its correct batch. Repeated Publish preserved one row and the original publication timestamp. An ineligible real Auth Student received no signed segments.
- Student replay decoded, middle seek (~44.9 seconds) and near-end seek (~85.3 seconds) both resumed to completion. A precise renewal changed the private signed source while preserving active playback: 52.152 seconds before renewal, 57.364 afterward, still playing and readyState 4.
- Open-player revocation was hardened: denied renewals remove cached media, and a lightweight authenticated check runs every 15 seconds and on focus/visibility without storage reads or link signing. Delayed earlier renewals cannot restore a revoked player. Already issued R2 URLs retain the existing bounded signing TTL; application access/reissuance is denied after revocation.
- Recording metadata now refreshes after review decisions, and the embedded Student player uses one page title/back path. Final local gates: 476 unit/integration assertions and 4 importer tests passed, with 13 pre-existing skipped tests; lint, TypeScript, production build and public-bundle scan passed. Concurrent build/type generation initially raced; sequential TypeScript verification passed after build completion.
- Production read-only readiness: current designated rotated review credentials authenticate both existing Admin and Teacher roles. An older review-credential file was obsolete. Production Supabase is `dvmahmkapgtjfqmoottt`, R2 bucket is `als-recorded-classes-production`, and its existing SFU/TURN IDs currently match the staging consumers. Shared provider resources must not be deleted or rotated by this maintenance task; cleanup is limited to exact QA sessions/tracks. No Production data, environment or deployment change has occurred.

## Final staging acceptance follow-up

- Owner explicitly confirmed published Student replay voice and lesson video. Middle/near-end seek and position-preserving signed-link renewal had already passed.
- Normal Admin Unpublish removed the open Student video automatically without a manual renewal. Direct playback returned 404 with no signed segments. Student Classes became empty, both subject counts returned to zero, and the shared Admin published count returned to the original one. The historical accepted recording remains published.
- Normal Reject and Return to pending actions succeeded. The synthetic recording remains unpublished, with its class/session and segments preserved.
- Migration `20261015122018_lms_batch_history_enrollment_status` passed a transaction rollback check and was applied to staging. It closes history for inactive enrollments and starts a new interval upon reactivation. Five real authenticated database assertions passed: reconciliation, suspension closure, one new reactivation interval, retained old rows, and unchanged permanent code/enrollment identity/access dates.
- The owner widened the in-app browser twice. Actual measured responsive widths were 562 and 631 CSS pixels; Student Courses and the removed-player state showed no horizontal overflow. These are recorded as measured widths, not as the ignored requested 768-pixel viewport.
- Latest application source `3881a7babe8d86e5d283cbb3f85170d1238a2bbf` is READY in deployment `dpl_3ms3FqQPcXcYNuDaP9mK3DN6gLuX`; live/recording/POC entry remains disabled and cron paused.

## Production migration transaction incident

The intended combined rollback check included a nested BEGIN/COMMIT from migration
`20261015090156`. Its COMMIT persisted migrations 1–4 before the outer rollback.
The subsequent verification found the new identity column present with the
original 54-row migration ledger. No identity backfill was executed. This is
not reported as a successful rollback. The migration's transaction wrapper has
been removed so the caller owns the complete transaction. The release proceeds
by verifying precisely the persisted schema and original data, testing only
remaining migrations under a genuine rollback, then recording and applying the
authorized release consistently. No destructive schema reversal is used.

- The exact persisted footprint was migrations 1–4, zero assigned codes, five original enrollments and five seeded history rows. Remaining migrations 5–8 then passed a genuine rollback; their private Auth restriction table was confirmed absent afterward, with 54 original ledger rows.
- All 40 pre-existing rows across 12 application tables retained every original field value before completing the migration release. All eight migrations are now recorded in Production.
- The reviewed initial backfill report had only the owner-identified test user missing a batch. A compatible CRE test cohort was created and the normal transfer function retained its original enrollment/access dates. The next dry run was clean. Three remaining legacy codes were backfilled; four permanent codes are unique, one approved inactive outsider remains explicitly Unassigned, and a repeat dry run proposes zero assignments.
- Responsive Admin list, read-only details and admission modal were visually inspected at the measured 631-pixel width without horizontal overflow. No 768-pixel viewport claim is made.

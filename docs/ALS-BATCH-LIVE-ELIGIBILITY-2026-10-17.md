# ALS batch, live eligibility and transfers — 17 October 2026

## Scope and checkpoint

Branch `fix/batch-live-class-eligibility`, based on Production main `01547bafdb68a28569e0c110fc2b1075fa9ea6c1`. This is LMS maintenance. No ERP branch is merged. Production application release is pending hosted browser/media acceptance.

## Verified root causes

- Student list, classroom API and database used different eligibility checks. The API also rejected a real early start until its scheduled join time.
- Production's active ALS Internal Cohort had expired batch access on 11 October, despite the Student enrollment expiring in March 2027.
- Newly created Production New Batch had no Teacher assignment. Admin Batch editing did not expose Teacher/subject assignment or capacity.
- Capacity guards counted enrollment rows rather than distinct currently effective Students. The staging database also has older enrollment and batch-edit guards with the same counting problem. Only their duplicate occupancy expressions are adjusted; other existing checks are preserved.
- A STABLE RLS class lookup could not see a newly inserted class during INSERT RETURNING. Staff ownership now uses columns on the new row; Student eligibility still uses the shared predicate.

## Implementation

Canonical batch UUIDs and composite Program/Batch foreign keys; assigned live subjects; atomic Batch/Teacher/subject editor; database scheduling options; shared live view/connect/playback eligibility; early-start precedence; shared status labels; visible-page refresh fallback; distinct current occupancy with batch locks; same-batch no-op; atomic transfer/history/code preservation; future transfer queue and academic Cron job; old-batch transport/attendance revocation and client access-loss handling.

Future transfers do not reserve current occupancy or change current enrollment early. The scheduled transaction checks capacity at execution. On failure, the previous batch, history and permanent Student Code remain intact, and Admin sees a failed request. The academic transfer job is separate from media cleanup.

## Hosted staging migrations

- `20261017062115_batch_live_eligibility_and_capacity`
- `20261017065945_live_owner_returning_and_effective_membership`
- `20261017070622_lms_legacy_capacity_guard_consistency`
- `20261017071325_scheduled_student_transfers`
- `20261017071924_transfer_live_access_revocation`
- `20261017072114_batch_capacity_current_roster_guard`

Every migration was checked in a caller-owned rollback transaction before staging application. Sources contain no top-level BEGIN/COMMIT. Production schema migrations are not yet applied.

## Data repair approved by owner

Exactly one Production batch, `be7eb968-2e91-488a-8b23-7aae64db3e57` (ALS Internal Cohort), changed to No expiry at `2026-10-17T07:15:33.569355Z`. Enrollment dates and identity codes were unchanged. Audit event `b5fefc1e-301f-442c-89af-c73408b5d8a1` records the old/new batch and owner instruction.

Preflight: Production 6 batches, 7 enrollments, 5 live-session records, 9 history intervals; no incompatible enrollment Program/Batch IDs. Staging 9 batches, 22 enrollments, 17 sessions, 27 history intervals before owned QA; no incompatible Program/Batch IDs in enrollment, session or history rows. Existing staging media was idle. Four staging subject links were backfilled only from existing explicit Teacher and Program/subject links. No text/name inference or historical deletion.

## Verification so far

- 489 Vitest tests and 4 importer tests passed; 13 pre-existing skips.
- Typecheck, ESLint and production build passed (39 static pages).
- 28 hosted database assertions with real Supabase Auth: assigned/unassigned visibility, exact Batch scheduling, upcoming and early-live access, another-Batch direct denial, Student/Teacher transfer denial, same-Batch no-op, full-batch rollback, deactivation freeing a seat, reactivation capacity enforcement, transfer history/actor/reason, eligibility changes, immutable codes, terminal-state denial, concurrent one-seat race, and future-transfer non-early application.
- Scheduled transfer `5005de64-032f-43f4-9b7f-3f620718a7d3`: effective `07:18:53.801Z`, applied by Cron `07:19:00.058597Z`. No manual worker invocation.

## Remaining release gates

Complete hosted browser flows, responsive inspection, actual microphone publication/Student reception/transfer revocation/normal End and replay regression, then Production migrations, complete release and controlled Production acceptance. Staging R2 renewal for the existing bucket is approved and its 24-hour token has been created; owner must save the replacement values in the designated ignored local configuration. No new recording is planned. Existing SFU/TURN IDs are shared with Production and must not be rotated or globally cleaned.

Private fixture IDs, original snapshots, credentials and SDK evidence are under ignored `.local-qa/batch-live/`; never publish private files or secrets.

Scheduled full-batch failure also verified: the worker retained the previous assignment and code, and recorded a failed request. Admin cancellation and anonymous/Teacher/Student denial passed with actual Auth. The first Preview was blocked because the author’s legacy noreply email was unverified; the next maintenance checkpoint uses the same owner’s existing verified Vercel email, without changing team access or plans.

## Hosted candidate and additional checks

Preview `dpl_7G24kj69zAC9PtbZ2HD6wdKocSvv` reached READY at commit `f83f8a021893ef151829d0bc77eb00e82fa54581` and was assigned only the existing isolated staging alias. Initial HTTP 200 checks were insufficient: later inspection found streamed React Server Component errors caused by the ambiguous joins described below. The corrected candidate is verified separately below. Unauthorized Admin routes were rejected. This is HTTP/server verification, not browser interaction or media acceptance.

The final focused display correction passes the authorized session's join-window and ended timestamps to the classroom, refreshes the scheduled label, and keeps Admin's rescheduled join window current. A component test proves a future scheduled join window disappears after an actual early Live transition and Join becomes available. Thirty targeted tests passed, followed by the full 489-test suite, typecheck, lint and the production build.

Staging ledger verification at 07:57 UTC confirms all six migrations and academic transfer Cron job ID `3`, active every minute. The preceding media audit found zero live classes, open connections or active publications; no actual SFU media was created by this task yet. Final complete media closure remains an acceptance gate.

Fresh canonical audit at `2026-10-17T07:56:38.038Z`: Production 6 batches/7 enrollments/5 sessions/9 history intervals; staging including owned QA 12 batches/25 enrollments/21 sessions/34 history intervals. Both have zero incompatible Program/Batch relations, duplicate active Student/Program enrollments, duplicate open history intervals, dangling Teacher/Batch links or upcoming/live classes missing a Batch UUID. Existing unassigned enrollments remain: Production 1 and staging 2. No legacy cohort/name/slug fields are used in the audited operational rows; no batch was inferred or assigned silently.

Owner handoff pending: save the new scoped R2 Access Key ID/Secret Access Key into ignored `r2-renewal.env.local`, and sign the three isolated browser contexts into the existing QA accounts. Computer-use controls redact stored credential values; the in-app and second Chrome context also require the existing owner's Vercel sign-in. Temporary loopback credential-source server was stopped. Staging live/recording remain disabled. No new Production schema/application deployment has occurred.

## Joined-query and admission regression caught before release

Hosted admission returned 201, but its Student Details API returned 503. The new composite Program/Batch foreign keys coexist with the original Batch foreign keys, making unqualified PostgREST Batch embeds ambiguous (`PGRST201`). All affected enrollment, history and live-session embeds now select the explicit canonical composite relationship. This also covers Student Courses/dashboard/profile and Teacher/Admin live/recording metadata. The constraints remain enforced.

Eight exact joined queries passed against hosted staging using real Admin, Teacher and Student Auth, with nonempty enrollment/course/history data and three existing recording metadata rows. Full tests remain 489 passed plus 4 importer tests, with 13 pre-existing skips; typecheck and lint passed again. The current complete Preview is updated only after these checks and the production build.

The owned API admission fixture was created once. Actual Supabase password login succeeded; full one-seat admission was rejected (422); after deactivation, duplicate Auth email was rejected (409), and the normal application password endpoint rejected the inactive account (401). Identity/history are retained. The corrected full Student Details API returned 200 with code, phone, guardian fields, one enrollment and one history interval intact; recording-review metadata returned 200. No Production admission or schema change occurred.

## Current saved checkpoint — 08:11 UTC

Complete source commit `6f202a1a58af9e1d1dcf62f3553b9ac3217d7f42` is READY in Preview `dpl_9vBjDrgAzAtnWWrtHF51ZvUdyqbF`, using only the existing isolated staging alias. Twelve authenticated page requests passed with HTTP 200 and no streamed RSC errors: Admin dashboard/academic/Students/Live/Recorded; Teacher dashboard/Live/new schedule; Student dashboard/Live/Courses/Profile. Eight joined-query probes and the real hosted admission/detail checks also pass. Browser interactions, responsive layouts and actual media still require the pending owner handoffs.

At `2026-10-17T08:11:27.968Z`, staging has zero live classes, open/reconnecting connections, active/closing publications, active/closing subscriptions, open attendance, pending recording work and pending transfers. Live/recording configuration remains disabled. The new scoped R2 token is waiting on the owner's private credential entry; no replacement values have been saved or deployed. No Production schema migration/application deployment occurred.

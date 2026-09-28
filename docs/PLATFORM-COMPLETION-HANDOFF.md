# ALS non-live platform completion handoff

## Identity and boundary

- Original ALS repository checkout: `C:\Users\USER\Desktop\Projects\ALS Learning Platform\ALS Learning Platform` (`codex/cloudflare-native-classroom` at audit start). The Cloudflare Workers compatibility checkout was not used as a base.
- Stable committed Hostinger/native base: `967b4407d8724f22092a44da83984a3f5d2edaac` on `codex/hostinger-staging`.
- Completion branch/worktree: `codex/platform-gap-audit` at `C:\Users\USER\Desktop\Projects\ALS Learning Platform\als-platform-gap-audit`.
- Live-class task: active separately in `als-hostinger-staging/`, with uncommitted `docs/HOSTINGER-STAGING-DEPLOYMENT.md` at the last comparison. Its latest inspected commit was `8cc649a58b6145ccd62600024bbf0fa4ba09c29b` (hosted classroom reception/cleanup). Do not reset, rebase, cherry-pick into, or alter that worktree as part of this handoff.
- Three real specialist workers performed bounded work and finished: `/root/student_experience` (Student audit, metrics/retry implementation, Admin cross-review), `/root/admin_operations` (Admin audit, batch/enrollment implementation, Student cross-review), `/root/teacher_shared_ui` (Teacher/shared UI read-only audit). The coordinator owns the register, integration branch, tests, and this handoff.

No `.env.local` or hosted credential was copied into the completion worktree. Its only environment example is `.env.example`. The ignored `node_modules` junction used for local gates pointed to the original checkout's installed dependencies, not to a database or browser session. No hosted, production, Cloudflare, Supabase, connected Chrome, or cleaning-site changes were made here.

## Audit outcome and preserved behavior

The detailed, evidence-labeled register is `docs/PLATFORM-GAP-AUDIT.md`. The current catch-all Admin/Teacher routes mount database-backed portals; old mock portal components and static Biochemistry exam files are not active journeys. Source and historical acceptance support preserving enrolled course/subject access, private material links, server-graded attempts and review, Admin academic/question/test/material authoring, and assignment-scoped Teacher tools. The retained `docs/core-pipeline-delivery.md`, `docs/student-courses-mobile-report.md`, and submitted-review reports contain historical local/QA/Production evidence; this branch did not repeat their hosted tests.

Top confirmed gaps, by impact:

1. **P0 — batch deletion can broaden access.** The original Admin Delete draft path could delete an upcoming batch. `enrollments.batch_id` becomes `NULL`; batch restrictions on content/tests cascade away. Core access then treats those records as program-wide. This branch disables batch deletion in the UI *and* repository as a fail-closed mitigation. Direct authorized database deletion remains possible until a coordinated database guard exists. Do not re-enable the button merely because the UI mitigation passes.
2. **P1 — batch restore activated access.** Archived batch restore wrote `active` regardless of the earlier state; upcoming/completed appeared as Draft. Fixed locally: these states remain distinct and restore returns to Upcoming, requiring explicit activation.
3. **P1 — client-reported multiple-program workflow.** The user supplied a Vercel-era Admin screenshot showing one Program selector. Source on `main` and the Hostinger base is identical: each Save inserts one enrollment; Edit changes that row, potentially replacing its Program. The schema allows different program rows for one Student, and Student Courses handles multiple active programs. No failed second save or error text is visible/reproduced. Fixed the workflow clarity locally: after a successful new or edited save the form keeps the Student, clears Program/Batch/window, and prompts for another Program; Edit warns about replacement and has Add another program. Each Program still receives its own enrollment and access settings.
4. **P1 — inaccurate Student dashboard counts and inert recovery.** Completed/live classes and unavailable tests were counted under Upcoming/Available labels; five non-live route error pages rendered Try Again without a handler. Fixed locally using future scheduled classes, `state === 'available'`, and Next 16.3.3 `retry` callbacks.

Pending P2 or business-dependent items include Admin list truncation above the configured 1,000-row API limit (current hosted threshold not measured), duplicate program-wide enrollment with `NULL` batch (Postgres uniqueness permits it), profile/progress wording, notification producers, Teacher mobile More keyboard behavior, and public Contact copy. Certificate eligibility, support channel/SLA, paid notifications, payment policy, analytics/reports/CMS, matching questions, and advanced checkpoints need ALS scope or business decisions; they were not fabricated in this batch.

## Reviewable commit order

Apply the following commits **in order only after the live-class candidate is stable**, then test the combined revision. This task does not push, merge, deploy, or change hosted fixtures.

1. `87bb311fa3f4e59e9bd4afa963751e86c3f9dd0f` — `fix: preserve batch access state and block unsafe deletion` (Admin academic repository/workspace, status types, focused test).
2. `64675c89c1deb841c37de7f13806fca479dc644e` — `fix: correct student metrics and route retries` (Student dashboard, five non-live error boundaries, shared UI state primitive, focused test).
3. `2b65b182e077ca525e2c8e3b69d859d693d3d5e8` — `fix: make additional program enrollment explicit` (Admin enrollment form, focused repository test).
4. The commit adding this handoff and `docs/PLATFORM-GAP-AUDIT.md` follows those three on `codex/platform-gap-audit`; its full SHA is supplied with the final branch handoff.

No migration is included. The later database safety work should be a new, forward-only migration after comparing the live team's migration names/order. It must prevent deleting *referenced* batches atomically, including dependencies from `enrollments`, `content_batch_access`, `test_batches`, and `live_sessions`, without relying on a client precheck. For example, access-sensitive references can use restrictive foreign keys or an authorized transactional procedure that rejects any referenced batch. Keep the temporary repository/UI block until this is applied and tested. A separate uniqueness policy/index is needed if ALS confirms that a Student may have only one program-wide (`NULL` batch) enrollment per program; reconcile existing duplicates first. Both schema changes need isolated DB/RLS tests and coordinated hosted rollout, not this branch's mocked tests.

## Local acceptance and limits

| Gate | Result and environment |
| --- | --- |
| Focused Student pre-fix reproduction | Seven focused cases failed on the base: mixed-state counts and five boundary callbacks/shared retry. All seven passed after the Student patch. |
| Focused Admin tests | Batch status/delete tests 5 passed; enrollment insert-vs-update tests 2 passed, using mocked Supabase clients. These are **not** DB/RLS acceptance. |
| Full Vitest suite | 42 files passed, 3 skipped; 266 tests passed, 13 skipped. Run from the isolated branch with installed Next 16.3.3/React 19.2.8/Vitest 5.0.0 dependencies. |
| Lint, typecheck, build | Full ESLint passed. `next typegen` then `tsc --noEmit` passed. Next 16.3.3 Webpack production build compiled, typechecked, and generated 28 static pages. No hosted environment variables were provided. |
| Separate Node import test | **NOT VERIFIED:** `node --test scripts/microbiology-import.test.mjs` exits before tests because ignored `.local-qa/microbiology-preflight-records.json` is absent. The fixture appears to derive from client question content, so it was not copied from another checkout as if it were a safe synthetic fixture. This is an environment/fixture limitation, not an observed regression in changed files. |
| Database/RLS, hosted browser, desktop/mobile authenticated visual check | **NOT RUN.** No genuinely isolated local database and approved synthetic accounts were prepared; connected Chrome and hosted fixtures belong to the live-class team. No mocked test is called database acceptance. |
| Diff and private-file checks | `git diff --check` passed before commits; no environment or private fixture was staged. Final tracked-file secret/path scan and clean-tree check are recorded in the final report. |

No local test server or watcher was left running. The Next production build was compile-only; no application request reached a hosted database.

## Integration comparison and required combined tests

At the last comparison, none of the changed paths in commits 1–3 overlap files changed from base `967b4407…` to live commit `8cc649a…`. The live task still had an uncommitted deployment document, which this branch did not edit. **This is not a merge-compatibility claim.** Recompare against the live branch's final committed and uncommitted state at integration, especially `src/components/ui/states.tsx`: the live-class error boundary still uses that primitive without a retry callback and remains the live owner's issue. Do not resolve new conflicts with blanket ours/theirs.

After integrating on the release owner's test candidate, run full lint/typecheck/Vitest/build and the fixture-backed Node test only with its authorized fixture. In an isolated or expressly approved staging database, verify: Admin creates two different Program enrollments for the same synthetic Student without replacing either; Edit updates the selected row; the Student Courses chooser shows both only while eligible; duplicate same-program/no-batch policy; archived batch restore leaves access denied until deliberate activation; batch deletion is denied by the application and, after the later schema guard, by direct authorized DB writes. Recheck Student dashboard counts, retry behavior, Teacher assignment limits, question/test review privacy, and all live media/recording/cleanup acceptance on the **combined** revision. Desktop/mobile authenticated visual checks must use a separate browser/profile or be scheduled by the live owner after their session handoff.

The release owner controls integration, deployment packaging, uploads, rollback, hosted migrations, and final acceptance. Vercel remains unchanged by this local patch; the user's screenshot can only be closed as a hosted defect if the client supplies the actual second-save error or the release owner reproduces and verifies the improved flow in the target deployment.

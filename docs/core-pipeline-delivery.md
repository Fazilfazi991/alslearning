# ALS Core Content Pipeline — Delivery

Verdict: **ALS CORE CONTENT PIPELINE — PASS**
Import readiness: **YES — READY FOR PATHOLOGY IMPORT**

Scope: Admin academic configuration → transactional question/test/material authoring → assignment-scoped teacher access → eligible student learning and server-graded attempts. No client question-bank files were imported.

## Change identity and environment

- Starting SHA: 69c791745187167367f06d5fefc711c7167b61f5
- Branch: codex/core-content-pipeline
- Final SHA: the commit containing this report; the exact hash is supplied in the delivery message.
- Database: xstssknlgdraulebdsfd, explicitly confirmed by the user as development/QA.
- Production touched: **No**. No deployment, production migration, database reset, or removal of original QA fixtures.
- The local SUPABASE_PROJECT_REF value differs from the configured URL. Migration/test utilities derive the project from NEXT_PUBLIC_SUPABASE_URL and require CORE_QA_PROJECT_REF to match it.
- Private keys stay in server-side QA utilities and are never bundled into the application.

## Forward migrations

1. 20260910024559_core_content_pipeline.sql — consistent access helpers and replacement RLS; revoked raw core writes; immutable private attempt snapshots; transactional question/test/material RPCs; bank sampling; grading and history; image storage; academic fields.
2. 20260910030225_core_pipeline_guards.sql — null-safe active-role guards and hidden-score handling, including idempotent submission.
3. 20260910030835_core_pipeline_acceptance.sql — batch-aware historical access, unpublished-test summaries, scoped test-author bank selection, taxonomy visibility and image ownership guards.
4. 20260910032537_core_order_permissions.sql — restrict program-wide material reordering to Admin, matching the UI.

All four were applied to QA and verified in schema_migrations. Earlier migrations and existing QA data were preserved. Replacement function definitions in subsequent migrations are intentionally retained as applied migration history.

## Implemented behavior

- /admin/academic: program duration, access defaults and subject mappings; batch academic/access dates, timing and status. Local date inputs preserve the stored instant. Course detail selects a currently eligible enrollment when several exist. Dialogs trap focus, permit Escape cancellation and display save errors.
- /admin/questions: add/view/edit, draft/active/archive, search/status filtering, taxonomy, marking, source/year/session/reference/label metadata, explanation, stem and solution images. Options and keys commit in one transaction. Image uploads block save until complete.
- Single MCQ, multiple MCQ, true/false, image MCQ and case-based single-answer questions are supported. Matching is disabled with an explanation.
- /admin/tests: draft/publish/unpublish/archive, taxonomy and eight categories, duration, attempt limit, calculated marks, negative marking, availability, batch eligibility and review settings. Both manual selection and a fresh random eligible bank sample per attempt work.
- Students cannot insert/update/delete attempts or answer-result rows. Authenticated RPCs own response validation, expiry, scoring and submission. Snapshots preserve questions, options, marking and review settings across later edits.
- Teachers see actions filtered by assignment permissions and taxonomy. A test-only teacher can select the active bank without obtaining question editing or answer-key access. Batch-restricted mutations also require the teacher's batch assignment.
- /admin/courses: actual file upload, metadata-only edits, file replacement, publication and batch scoping; stable slugs and ordering. Images render as images, videos use supported players, PDFs/documents use secure open links to their supported readers.
- Original checkpoint records remain readable with corrected relation labels. New checkpoint controls and playback are explicitly disabled; the existing checkpoint-response RPC is not callable by students.
- Legacy /admin/question-bank, /admin/assessments and mock batch routes redirect to canonical routes. Static clinical-biochemistry mock test pages redirect to the real student test list; this is route cleanup, not a Biochemistry import.

## Verification evidence

| Boundary | Result | Evidence |
| --- | --- | --- |
| UI → authoring RPC → database | PASS | Browser Admin created a four-option active question with explanation and images, saved a draft test and published it, uploaded image/PDF materials, added a video and edited metadata. |
| Academic Admin → database | PASS | Final 80-assertion acceptance run creates academic fixtures through an authenticated Admin client. Browser program duration and batch timing/date changes save and reload. Direct database checks confirm duration 91, batch dates and Dubai-to-UTC access times. |
| Assignment → teacher UI/RLS | PASS | Desktop test-only teacher sees zero question/material rows and disabled create actions; permitted test draft saves successfully. Direct revoked-permission and wrong-batch mutations fail. |
| Eligibility → student visibility | PASS | All six denial cases hide tests/materials and block start/signing. Mobile future-start student has no available tests; direct test URL returns 404. |
| Attempt → grading → review | PASS | Browser answer survives refresh with the original expiry; submission yields 1/1, selected/correct answer and explanation; history and both images survive reload. |
| Storage → renderer | PASS | PNG loads with 320px intrinsic width; video loads, plays and reaches its end. PDF is delivered via secure-open UI with no video element or empty embedded pane; authenticated retrieval returns application/pdf and %PDF bytes. |
| Database integrity | PASS | RLS true on the eight inspected core tables, authenticated grading/core table mutations revoked, anonymous access to seven new core RPCs denied; original three QA profiles still present. |

Browser acceptance used the local production build at localhost:3002, at 390×844 and 1440×1000. No page-level horizontal overflow or console errors were observed in tested core flows. Mobile coverage includes authoring, batch fields, learner media and results; desktop coverage includes academic editing, uploads, image previews teacher permissions and persisted student results. Screenshots were inspected during the session; this table is the retained browser QA summary.

Automated gates:

- pnpm typecheck — PASS.
- pnpm lint — PASS.
- pnpm build — PASS (Next.js 16.3.3 production build).
- pnpm test — 11 tests pass across two files, including assignment visibility and date handling beyond the existing CSV tests.
- pnpm test:core-db — 80 assertions pass against QA.
- pnpm test:core-security — 12 additional assertions pass against QA.

QA scripts require CORE_QA_PROJECT_REF=xstssknlgdraulebdsfd and the existing local environment. Run test:core-db before test:core-security; the first creates disposable synthetic fixtures and records their IDs in the ignored core-qa-results.json. The second uses those fixtures. Original QA fixtures are not deleted. Authentication links can be generated for synthetic fixtures with scripts/core-qa-login.mjs; no emails are sent.

## Deliberate limits / remaining work outside this batch

- Matching questions and advanced video checkpoints remain disabled, as permitted by this batch's scope.
- PDF display is delegated to a supported browser/document reader through a signed link, rather than relying on an unreliable embedded PDF plugin.
- Private media signing checks current access. Already issued signed URLs remain valid until their short expiry (question images: five minutes, materials: fifteen minutes).
- No production deployment has occurred. Production rollout still requires explicit instruction and its own environment/migration verification.
- PATHO 1–6 and Biochemistry import remain separate future work. The canonical transactional question schema/RPC is ready for that import; the legacy mock/CSV UI is not the import workflow.
- Live classes, Cloudflare transport, recordings, payments, certificates, CMS, reports, support, notifications and general dashboard redesign were outside scope.

## Files changed

- .gitignore
- docs/core-pipeline-delivery.md
- package.json
- scripts/core-db.mjs
- scripts/core-fixtures.mjs
- scripts/core-pipeline-qa.mjs
- scripts/core-qa-login.mjs
- scripts/core-security-qa.mjs
- src/app/admin/[[...slug]]/page.tsx
- src/app/admin/layout.tsx
- src/app/student/exams/[testSlug]/page.tsx
- src/app/student/exams/clinical-biochemistry-final/page.tsx
- src/app/student/exams/clinical-biochemistry-final/result/page.tsx
- src/app/student/exams/clinical-biochemistry-final/review/page.tsx
- src/app/student/exams/clinical-biochemistry-final/take/page.tsx
- src/app/student/learn/[lessonId]/page.tsx
- src/components/admin/academic-workspace.tsx
- src/components/admin/admin-backend-manager.tsx
- src/components/admin/admin-portal.tsx
- src/components/admin/admin-shell.tsx
- src/components/admin/core-fields.tsx
- src/components/admin/core-manager.tsx
- src/components/learning/core-learning-player.tsx
- src/components/learning/private-image.tsx
- src/components/student/core-test-engine.tsx
- src/components/teacher/teacher-backend-portal.tsx
- src/lib/academic-repository.ts
- src/lib/admin-backend.ts
- src/lib/core-repository.ts
- src/lib/core-rules.test.ts
- src/lib/core-time.ts
- src/lib/student-data.ts
- supabase/migrations/20260910024559_core_content_pipeline.sql
- supabase/migrations/20260910030225_core_pipeline_guards.sql
- supabase/migrations/20260910030835_core_pipeline_acceptance.sql
- supabase/migrations/20260910032537_core_order_permissions.sql

## Database acceptance assertions

- PASS: Draft question cannot be selected
- PASS: Draft test hidden
- PASS: Published test visible
- PASS: Student batch visible
- PASS: Teacher assignment content scope
- PASS: Student question table does not leak keys or explanations
- PASS: Answer keys hidden
- PASS: Invalid question transaction rejected
- PASS: Failed transaction leaves no question
- PASS: Student direct score write DENIED
- PASS: Student direct status write DENIED
- PASS: Student direct expires_at write DENIED
- PASS: Student direct submitted_at write DENIED
- PASS: Student direct correct_count write DENIED
- PASS: Student direct negative_marks_total write DENIED
- PASS: Pre-submission payload has no key/explanation
- PASS: Pre-submission review denied
- PASS: Answers survive refresh
- PASS: Server score correct
- PASS: Submitted result tampering DENIED
- PASS: History snapshot survives question edit
- PASS: Three-attempt limit enforced
- PASS: History retains all attempts
- PASS: future: test hidden
- PASS: future: start denied
- PASS: expired: test hidden
- PASS: expired: start denied
- PASS: suspended: test hidden
- PASS: suspended: start denied
- PASS: inactive: test hidden
- PASS: inactive: start denied
- PASS: wrong-batch: test hidden
- PASS: wrong-batch: start denied
- PASS: wrong-program: test hidden
- PASS: wrong-program: start denied
- PASS: Unpublish prevents new attempt
- PASS: Server rejects answers after expiry
- PASS: Expired attempt finalized on reload
- PASS: multiple_mcq persists
- PASS: true_false persists
- PASS: image_mcq persists
- PASS: case_based persists
- PASS: Matching explicitly disabled
- PASS: Stem image authorized during attempt
- PASS: Solution image denied before submission
- PASS: All supported formats scored correctly
- PASS: Solution image authorized after submission
- PASS: One-attempt limit enforced
- PASS: Random sample has requested distinct eligible questions
- PASS: Submit does not reveal hidden score
- PASS: Idempotent submit does not reveal hidden score
- PASS: Review respects hidden flags
- PASS: video metadata edit preserves slug/order/file
- PASS: video visible to eligible student
- PASS: pdf metadata edit preserves slug/order/file
- PASS: pdf visible to eligible student
- PASS: pdf signed file authorized
- PASS: image metadata edit preserves slug/order/file
- PASS: image visible to eligible student
- PASS: image signed file authorized
- PASS: future: material hidden
- PASS: future: private material URL denied
- PASS: expired: material hidden
- PASS: expired: private material URL denied
- PASS: suspended: material hidden
- PASS: suspended: private material URL denied
- PASS: inactive: material hidden
- PASS: inactive: private material URL denied
- PASS: wrong-batch: material hidden
- PASS: wrong-batch: private material URL denied
- PASS: wrong-program: material hidden
- PASS: wrong-program: private material URL denied
- PASS: Teacher wrong program mutation denied
- PASS: Teacher unassigned batch mutation denied
- PASS: Teacher revoked question permission denied
- PASS: Teacher revoked content permission denied
- PASS: Test-only teacher can select active bank
- PASS: Test-only teacher cannot read keys
- PASS: Historical result summary survives unpublishing
- PASS: History refuses another student attempt
- PASS: Concurrent starts resume one attempt
- PASS: Forged option denied
- PASS: Duplicate options denied
- PASS: Direct answer result write denied
- PASS: Direct attempt insert denied
- PASS: Concurrent submissions are idempotent
- PASS: Negative marks persist
- PASS: Unanswered question receives no penalty
- PASS: Teacher program-wide reorder denied
- PASS: Admin reorder leaves distinct positions
- PASS: Private PDF returns PDF bytes
- PASS: Cross-student review hidden

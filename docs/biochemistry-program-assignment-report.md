# Biochemistry Production program assignment — 11 September 2026

## A. Verdict

BIOCHEMISTRY PROGRAM ASSIGNMENT — PASS

The missing program relationship is resolved, and live Admin and Student acceptance passed. No question importer was run and no application deployment was needed.

## B. Program structure

Production target: `dvmahmkapgtjfqmoottt`.

DHS Long Term: `fa5c8e10-6485-4b65-b354-ccbfcc4a0a63`.

| Subject | Subject ID | Before | After | Order |
|---|---|---|---|---:|
| Pathology | `16a8ce52-9e59-4914-af0a-c614cfe4826d` | Assigned | Assigned, unchanged | 0 |
| Microbiology | `6d9f0a3a-14d1-48a9-abe8-a5cc7f7f7fae` | Assigned | Assigned, unchanged | 1 |
| Biochemistry | `7c243eff-1f33-4c96-a2cf-e65f08f9fcfa` | No program assignment | Assigned | 2 |

The canonical relationship is `public.program_subjects`, keyed by `(program_id, subject_id)`. One row was inserted using the authenticated Production Admin under existing RLS. No parallel model was introduced. Existing Pathology/Microbiology rows were not deleted or rewritten.

Mappings have no independent active/inactive column. DHS Long Term and all three subjects are active; that is their applicable status.

## C. Biochemistry

708 Active, five Review Draft, one recoverable quarantine record; 713 normal question rows. BIO 1–8 resolve under DHS Long Term without recreating chapters. All eight native tables and scientific formatting remain unchanged.

The five BIO 6 Drafts remain Q73, Q77, Q135, Q172 and Q188. BIO 5 Q31 remains quarantined with no inferred answer. Complete question/option/key/media/taxonomy fingerprints and all three Production import manifests confirmed no content or source-identity changes.

## D. Live Admin Test Builder

Verified in the existing `fazil4fazi@gmail.com` Chrome session at `https://alslearning.vercel.app/admin/tests`:

- Pathology, Microbiology and Biochemistry selectable under DHS Long Term.
- All Biochemistry sections and BIO 1–8 populated from the database.
- Manual selection: 708 Active available. BIO 5 filtering: 41 available; Q35 search returned its source question and checkbox selection worked.
- BIO 5 Q35 preview retained isotope superscripts. BIO 3 Q5 preview rendered its 4 × 3 native table.
- Random Active Bank: 708 available. Requesting 709 displayed the count validation error and disabled Save.
- BIO 6 Random scope: 197 available; requesting 20 was valid. The five Drafts and quarantine remain excluded.

These editor experiments were closed without saving. The single restricted test update described below was performed separately through canonical `core_save_test`. No hardcoded labels or frontend changes were made.

## E. Existing Student

`zorxdxb@gmail.com`, ID `c4a4db85-7407-4da1-bc8f-36016920b3c9`, has an active DHS Long Term enrollment:

- Enrollment `2feb5a41-cf7b-493b-b992-2259fc09c416`.
- Existing restricted batch `be7eb968-2e91-488a-8b23-7aae64db3e57`, LIVE QA — Student acceptance.
- Access starts `2026-09-11T06:07:49.981+00:00`; expires `2026-10-11T06:07:49.984+00:00`.

The enrollment and batch were unchanged. This batch has exactly one active Student enrollment, belonging to the authorized Student. The user signed in through the normal Production password form in Chrome; no password reset or new user was needed.

Desktop and mobile DHS Long Term pages display Pathology, Microbiology and Biochemistry. Student RLS assertions also confirmed three subjects, eight BIO sections and private-test access while direct raw question-bank/answer-key reads remained denied.

## F. Live desktop and mobile acceptance

Updated the existing restricted test `1781c9ea-76a3-4f26-a23f-56cc1176e7ef` from LIVE QA — Pathology + Microbiology to **LIVE QA — Three Subject Acceptance**. It contains 15 Active questions: three Pathology, three Microbiology and nine Biochemistry. It remains restricted to the same single-Student batch and retains its existing availability window and five-attempt limit.

Biochemistry samples cover a normal MCQ/Greek beta, native matching table, angstrom units, biochemical equation, powers and micro units, isotope superscripts, PaCO₂/HCO₃⁻, a long 10 × 6 explanation table and a sigma/square-root formula.

Live flow passed: normal Student login → dashboard → restricted test → start → select answers → refresh retaining the saved answer → submit → server grading → redesigned review → history reload/reopen.

New submitted attempt: `b6511ede-97d0-4d89-acbc-99b35cc2dfde`. Score **4/15**, four correct, eleven incorrect, zero unanswered, fifteen answer rows and fifteen snapshot questions. Answers were test inputs; no source content was corrected.

Desktop 1440 × 1000 and mobile 390 × 844 were checked. Mobile dashboard, program subject visibility, questions, options, formulas, result summary and answer cards worked. Review showed Your Answer, Correct Answer, correctness, marks and explanations. No replacement characters or page-level horizontal overflow were observed. The mobile long table used an approximately 308px container for 843px content; keyboard scrolling moved its internal scrollLeft to 40. The viewport override was reset after QA.

History contains three submitted attempts. Both previous attempts retain their original thirteen-question snapshots and scores; the new attempt contains fifteen questions. The private test remains active within its existing restricted availability window for the authorized Student. No permanent unrestricted test was created.

Observed application defects: none. Screenshots were inspected inline; no standalone screenshot artifact is claimed.

## G. Idempotency and safety

Assignment run 1: one new mapping. Run 2: zero new mappings. Exactly one canonical DHS Long Term ↔ Biochemistry relationship exists. Duplicate program/subject mappings: 0.

All three subject banks remain unchanged: Production totals are 2,472 questions, 9,888 options, 2,472 answer keys, 124 media relationships, 135 storage objects, three subjects and 21 chapters. Existing enrollment records and quarantine/source manifests are unchanged.

QA `xstssknlgdraulebdsfd` received only read-only inspection; its complete public data fingerprint, catalog and migration baseline are unchanged. Production RLS/function/policy catalogs and migration history are unchanged.

Checks: direct database/content comparisons PASS; assignment idempotency PASS; Student academic-access assertions PASS; live browser checks PASS; 24 scope/table tests PASS; ESLint on new scripts PASS. No application code changed, so no application build or deployment was required for this mapping task.

## H. Exact database mutations and Git

1. Inserted one `program_subjects` row: DHS Long Term ↔ Biochemistry, display_order 2.
2. Updated the existing restricted test's title, question_count (13 → 15), total_marks (13 → 15), mixed-subject selection rules and update timestamp through canonical authoring. The existing test-question list was replaced with the verified fifteen-question list. The restriction retained the same batch ID.
3. Created one normal Student attempt, fifteen answer records and one fifteen-question private snapshot; submission persisted its server grading results.

Programs created: 0. Subjects created: 0. Chapters created: 0. Enrollments changed: 0. Tests created: 0. Auth users created: 0. Questions re-imported: 0. Question content edited: 0. Migrations: 0. RLS changes: 0. Vercel changes/deployments: 0.

Starting SHA: `7fb77790d31d5d8585b7256b27de9c6805191bf1`. Branch: `codex/biochemistry-preflight`. Only local task scripts and evidence/report files were added; no push or application promotion.

Evidence: `biochemistry-program-assignment.json`, `biochemistry-live-test.json`, `biochemistry-assignment-verification.json`, `biochemistry-live-attempts.json` and `biochemistry-live-browser-verification.json`.

## I. Final status

YES — BIOCHEMISTRY FULLY LIVE

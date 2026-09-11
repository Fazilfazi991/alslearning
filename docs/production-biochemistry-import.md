# Biochemistry Production import — 11 September 2026

Resolution: the program-assignment blocker documented below was subsequently resolved and live acceptance passed. See [Biochemistry program assignment report](biochemistry-program-assignment-report.md). The original import evidence below is retained as its historical record.

## A. Verdict

BIOCHEMISTRY PRODUCTION IMPORT — FAIL

The content import, source reconciliation, integrity, security and second-run idempotency passed. The remaining acceptance blocker is **Production program assignment**: no program currently includes Biochemistry. The application requires a valid program/subject scope, so its Manual and Random selection functions currently return no eligible Biochemistry scope. No program assignment was invented. The user has been asked which Production program should receive the subject.

## B. Target

Production: `dvmahmkapgtjfqmoottt`. QA: `xstssknlgdraulebdsfd`.

Only Production Biochemistry content/taxonomy was written. QA received read-only baseline and final inspection. The Production Admin was the existing `fazil4fazi@gmail.com`, authenticated through the previously approved Auth generateLink/verifyOtp flow. All 713 question saves used `core_save_question`; no service-role authoring bypass or direct question inserts were used.

## C–D. Reconciliation and persisted rows

| Sub-head | Source | Active | Review Draft | Quarantine | Tables |
|---|---:|---:|---:|---:|---:|
| BIO 1 | 32 | 32 | 0 | 0 | 0 |
| BIO 2 | 46 | 46 | 0 | 0 | 0 |
| BIO 3 | 44 | 44 | 0 | 0 | 1 |
| BIO 4 | 200 | 200 | 0 | 0 | 0 |
| BIO 5 | 42 | 41 | 0 | 1 | 3 |
| BIO 6 | 202 | 197 | 5 | 0 | 1 |
| BIO 7 | 85 | 85 | 0 | 0 | 1 |
| BIO 8 | 63 | 63 | 0 | 0 | 2 |
| TOTAL | 714 | 708 | 5 | 1 | 8 |

713 persisted question rows + one recoverable quarantine payload = 714 source records. One existing canonical subject was reused, eight chapters created, and no topics invented. Added options: 2,852. Added answer keys: 713. Added media relationships/uploads: 0.

| Production inventory | Before | After |
|---|---:|---:|
| Questions | 1,759 | 2,472 |
| Options | 7,036 | 9,888 |
| Answer keys | 1,759 | 2,472 |
| Media | 124 | 124 |
| Storage objects | 135 | 135 |
| Subjects | 3 | 3 |
| Chapters | 13 | 21 |
| Auth users | 2 | 2 |
| Tests | 1 | 1 |
| Attempts | 2 | 2 |

## E–F. Review and quarantine

BIO 6 Q73, Q135, Q172 and Q188 remain Draft with their source answer-letter/named-option conflicts intact. BIO 6 Q77 remains Draft with C marked Correct while the solution additionally says D is correct. None was medically resolved or rewritten.

BIO 5 Q31 has no option marked Correct. Its written answer was not inferred as a key. The entire approved source payload remains in `production-biochemistry-quarantine.json`, linked from the Production manifest, and no normal question row exists for it.

## G. Tables and scientific content

All eight native table ASTs were compared against their approved source and retained their exact parent, ordering, rows/cells/spans and scientific formatting:

- BIO 3 Q5: stem, 4 × 3.
- BIO 5 Q13/Q34/Q42: stems, each 5 × 2.
- BIO 6 Q13: stem, 4 × 3.
- BIO 7 Q47: stem, 5 × 2.
- BIO 8 Q8: solution, 5 × 6.
- BIO 8 Q10: solution, 10 × 6.

Full canonical payload comparison covered all 713 questions, including rich text, superscript/subscript, Greek symbols, scientific units, isotope notation, formulas, option order, answer markers, marks and metadata. Additional persisted spot checks included BIO 5 Q35 isotope ASTs, BIO 7 Q46 PaCO₂/HCO₃⁻ and BIO 8 Q30 Σ/√. No browser attempt was created; Student rendering had already passed QA.

## H. Sources and identities

All eight exact DOCX SHA-256 values matched the approved QA manifest before import. The preflight and complete parsed-source hashes were also pinned. BIO 6 / BIO 7 JSO SIR 19 collision: **NONE**.

Identity remains SHA-256 of subject, BIO sub-head, exact filename, source file hash and source sequence, with the same deterministic question IDs used in QA. Missing visible numbers at BIO 3 Q39, BIO 7 Q48 and BIO 8 Q57 remain absent; source sequence provides traceability. Raw previous-paper metadata remains unchanged.

Two repeated-stem groups and 27 near-duplicate candidate pairs were preserved as legitimate separate source records. Accidental import duplicates: 0.

## I. Second-run idempotency

The exact same importer ran twice. Second-run output:

```json
{
  "new_subjects": 0,
  "new_chapters": 0,
  "new_questions": 0,
  "new_options": 0,
  "new_answer_keys": 0,
  "new_tables": 0,
  "new_import_identities": 0,
  "unchanged_questions": 713,
  "uploads": 0,
  "new_quarantine_duplicates": 0
}
```

## J. Integrity

Orphan options: 0. Orphan answer keys: 0. Orphan tables: 0; tables are embedded canonical AST blocks and every block was verified against its parent source. Duplicate source identities: 0. Duplicate subjects/chapters: 0. Drafts in the Active database bank: 0. Quarantine exposed as a normal question: 0.

## K. Existing subjects and QA

Pathology is unchanged: 966 question rows, 961 Active and five Draft. Microbiology is unchanged: 793 rows, 791 Active and two Draft. Protected Production public-table fingerprints verified unchanged existing data, including source identities, questions, options, answer keys and media. Existing users/tests/attempt counts also remained unchanged; neither subject was reimported.

QA's complete public-table fingerprints, counts, function/policy catalog and migration versions matched the baseline. QA still contains 2,533 questions, 10,084 options, 2,540 keys and 244 media relationships. No QA mutation was performed.

## L. Security and application selection

Production Admin authorization was proven by the canonical imports and authenticated reads. An existing real Production Student identity was used in a rollback-only SQL denial probe: `core_save_question` rejected the caller with “Question permission denied”, and direct questions/answer-key reads returned no rows. No new identity or attempt was created. Direct authenticated INSERT/UPDATE/DELETE privileges on attempts remain denied.

All 42 Production function definitions, 72 policies, table RLS settings and 25 migration versions matched baseline. Teacher assignment boundaries were checked through unchanged definitions/policies and the canonical assignment predicate; no Teacher account or synthetic Teacher probe was created.

Authenticated hierarchy queries resolve Pathology, Microbiology, Biochemistry and all BIO 1–8 chapters. The Biochemistry index contains 708 Active and five Draft records. **However, no `program_subjects` mapping exists for Biochemistry.** Running the actual `eligibleTestQuestions` application function therefore returns zero for Manual/Random mode until a valid program is chosen and assigned.

DHS Long Term currently includes Pathology and Microbiology. Other existing programs are DME Long Term, CRE Crash Course and MSc MLT Entrance. Choosing a program is a scope decision, not a source correction; no mapping was changed without that decision.

## M. Checks, code and environment

- Source hashes: 8/8 PASS.
- Focused tests: 33 PASS across importer, source/scientific content, native tables and selection scope.
- First-run reconciliation: 12 checks PASS; final payload/idempotency verification: 13 checks PASS.
- Integrity, unchanged existing content, QA and security baseline: PASS.
- Production Test Builder scope acceptance: BLOCKED by missing program assignment.
- New import/verification scripts: ESLint PASS.
- Approved starting SHA: `e1e9fcc079b044fdf17dd9251a817d9fcd66dc57`.
- Branch: `codex/biochemistry-preflight`; local import tooling/evidence only, no application promotion.
- Frontend code changed: NO. Migrations/RLS changed: NO.
- Vercel changed: NO. Deployment triggered: NO. Student/Teacher users, tests and attempts created: 0.

Machine-readable evidence: `production-biochemistry-import-manifest.json`, `production-biochemistry-first-run.json`, `production-biochemistry-verification.json`, `production-biochemistry-reconciliation.json`, and `production-biochemistry-quarantine.json`. Reconciliation includes baseline/final fingerprints and counts.

## N. Final status

NO — BIOCHEMISTRY PRODUCTION IMPORT STILL REQUIRES WORK

The imported bank is preserved. The remaining decision is which existing Production program should include Biochemistry; no reimport is needed to resolve that scope assignment.

# Pathology actual import delivery — 2026-09-10

## A. Verdict

PATHOLOGY IMPORT — PASS

The real client bank is imported into approved QA Supabase `xstssknlgdraulebdsfd`. All 968 source occurrences reconcile. Production was not touched.

## B. Reconciliation

| Sub-head | Source | Active | Review Draft | Quarantined | Images |
|---|---:|---:|---:|---:|---:|
| PATHO 1 | 310 | 306 | 4 | 0 | 4 |
| PATHO 2 | 137 | 136 | 0 | 1 | 0 |
| PATHO 3 | 168 | 167 | 1 | 0 | 4 |
| PATHO 4 | 100 | 99 | 0 | 1 | 0 |
| PATHO 5 | 148 | 148 | 0 | 0 | 0 |
| PATHO 6 | 105 | 105 | 0 | 0 | 0 |
| **TOTAL** | **968** | **961** | **5** | **2** | **8** |

966 canonical database questions plus two recoverable quarantine records. No failed or silently dropped records.

## C. Database counts and traceability

Verified after browser edit/save acceptance: 961 active questions, five content-review drafts, 3,864 ordered options, 966 answer-key rows, eight ordered private-media relations. Every key belongs to an option of its own question; no orphan media or duplicate import identities within the import.

Reused existing Pathology subject `ae4af773-97d1-4eea-89cf-86a5edfdfe02` and Junior Scientific Officer / JSO exam `f98f503c-cf40-4b2e-a79d-5e29e58714e1`. Created the six previously absent global chapters:

1. PATHO 1 - Haemopoiesis, Anaemia, Leukemia, Hemostasis
2. PATHO 2 - Clinical Pathology
3. PATHO 3 - Routine and Special Haematological Investigations
4. PATHO 4 - Cytology and Cytogenetics
5. PATHO 5 - Histopathology
6. PATHO 6 - Blood Banking

Bank questions have `program_id=null` and `topic_id=null`; no client program or lower-level topic was invented. The disposable test uses a separate QA-only program and batch.

79 imported previous-paper questions retain exact reference and parsed year. The source contains 80 such records; the remaining one is quarantined PATHO 4 Q43 (`119/2024`). References including leading zeros are preserved. No references were found outside question tables and no ambiguous multiple references were inferred. The existing canonical database enum is `previous_exam`, displayed as **Previous paper**; this implements the requested previous-paper classification without adding a competing `previous_paper` enum. Original labels remain in source text and traceability fields. 99 imported blank solutions remain blank.

Batch: `als-pathology-client-20260910-v1`. The deterministic manifest records all 968 source identities, filenames, SHA-256 hashes, source indices, database IDs, classifications, references/years and media IDs. UUIDv5 identities use document hash plus source question sequence. Source occurrences, including repeats, remain distinct.

Import used the authorized canonical `core_save_question` transaction boundary. Questions, options, keys, rich text and media relations were committed atomically per question. Original media bytes were hash-checked before upload and after private-storage download.

Second import run: **0 created, 966 unchanged, 0 failed; 0 images uploaded, 8 reused**. Existing content is compared before skipping; a changed payload is refused rather than silently overwritten. All six DOCX hashes still match the approved baseline.

Duplicate analysis preserved every source occurrence. Three exact groups: PATHO 1 Q209/Q294; PATHO 5 Q63/Q80; PATHO 5 Q70/Q72. Four near-duplicate pairs meet the recorded lexical thresholds. Nine equal-normalized-stem groups have differing marked-answer text and/or solution and are reported as potential contradictory duplicates for faculty review. These are lexical candidates, not nine newly adjudicated medical conflicts; differing option letters or explanation detail can account for differences. They do not replace the approved five within-record conflicts or alter the required status split. Full candidate evidence and methods are in `pathology-duplicates.json`.

## D. Content review required

All five records remain **DRAFT / CONTENT REVIEW REQUIRED**, preserving both sides of each conflict. None was medically resolved or made active.

Source file P1: `app friendly format - JSO SIR 1 - Haemopoiesis, Anaemia, Leukemia, Hemostasis.docx`.

Source file P3: `app friendly format - JSO SIR 3 - Routine and Special Haematological Investigations.docx`.

| Source file | Source index | Marked correct option | Conflicting written answer | Status |
|---|---|---|---|---|
| P1 | Q42 | B — Schistocytosis | `Ans: C` | Draft / Content review required |
| P1 | Q180 | B — Drabkin’s method | `Ans: C` | Draft / Content review required |
| P1 | Q190 | B — Sigmoidal | `Ans: C` | Draft / Content review required |
| P1 | Q205 | B — Thalassemia minor | `Correct Answer: A) Thalassemia minor` | Draft / Content review required |
| P3 | Q97 | D — Polycythemia vera | `Answer: C. Polycythemia vera` | Draft / Content review required |

Q205 and Q97 contain letter/text inconsistencies. Original trailing whitespace, line breaks and correct/incorrect designations remain preserved in the source payload; the table only abbreviates their display. Q190 retains its four solution images. All five drafts were individually rejected from explicit test selection, and generated selection returned exactly the 961 active records. Student test authoring was denied; direct question/key access and signing Q190 media were denied.

## E. Quarantine

`pathology-quarantine.json` contains full recoverable stems, options, correct/incorrect designations, solutions, rich representations, source filenames/hashes and indices for:

- PATHO 2 Q6, `app friendly format - JSO SIR 2 - Clinical pathology.docx`: “A cause of overflow proteinuria is:”; all four options marked Incorrect; solution `Answer: `.
- PATHO 4 Q43, `app friendly format - JSO SIR 4 - Cytology and Cytogenetics.docx`: “Which of the following is a not an example for vapor fixative?” with `119/2024 previous QP`; all four options marked Incorrect; blank solution.

Reason: **MISSING CORRECT ANSWER**. Their deterministic question IDs are absent from the database and test selections. No malformed question or invented answer was inserted.

## F. Media

**8/8 original images uploaded and verified byte-for-byte**, with original MIME types, question relationships, solution roles and source order. All eight render in Admin at both viewports. PATHO 1 Q190 renders four ordered images: PNG, JPEG, PNG, GIF. Its original static, one-frame GIF remains unconverted.

The four active solution images belong to PATHO 3 Q16, Q24, Q78 and Q79. All four render in Student review after submission, in source order, on desktop and mobile. Q190 and its four images remain inaccessible to the Student. No source question contains a stem image; that acceptance item is not applicable.

## G. Rich text

All 968 source records parse through the canonical rich representation; all 966 database payloads match the source text and AST, including option order, answer markers, explanations, marks, negative marks, formatting, Unicode and line breaks. No spelling, grammar, clinical values or answers were rewritten.

PATHO 2 Q126 and PATHO 4 Q68 retain their superscripts through DOCX → importer → database → Admin save/preview → Student attempt → result/review → reload, at both sizes. Source Unicode subscripts are preserved. There are no DOCX subscript-format runs in these six files, so real-source subscript-format coverage is not claimed; canonical superscript/subscript support remains covered by the existing rich-text regression tests.

## H. End-to-end acceptance and cleanup

Admin Question Bank → Pathology search/filter → source record edit/save → QA test → Student attempt → server grading → explanations/media → persistent history: **PASS**.

Admin search finds 966 imports; all six chapter filters reconcile, Active finds 961, Draft/Review finds five, and Previous paper finds 79. Existing source records were opened and saved without changing client content. A final deep database comparison after these saves passed for every imported payload.

Exactly one disposable test was created: `fa0e3cc8-c0f6-5648-bd85-7c5ec01d6d1a`, “QA ONLY — Pathology import acceptance”. It was temporarily configured for generated-selection security checks, then restored to its ten-question manual bank. It is scoped to the dedicated QA batch and synthetic enrolled Student. An unenrolled fixture cannot see or start it.

The bank covers all six chapters, both required superscript examples, all four active image questions, a blank explanation, previous-paper metadata and the longest source explanation. Q190 was excluded because it is a conflict draft. In-progress network payloads contained no answer keys, explanations or solution-media fields. Answers survived refresh in the same attempt. Both accepted viewport runs scored **10/10**, calculated by the server, and history survived reload.

The test is now **ARCHIVED**. Four submitted QA attempts are retained: two from the initial browser diagnostic run and two from the final complete acceptance run; all scored 10/10. No extra test was created. Imported questions, drafts, quarantine evidence and history remain retained.

## I. Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm test` | PASS — 29 tests |
| Python parser tests | PASS — 6 tests |
| `pnpm test:core-db` | PASS — 80 assertions |
| `pnpm test:core-security` | PASS — 12 assertions |
| Final import/database/media verification | PASS — 24 assertions |
| Draft selection/access/QA test scoping | PASS — 10 assertions |
| Import idempotency | PASS — zero new questions/images on second run |
| Desktop 1440 × 1000 and mobile 390 × 844 | PASS — 83 browser assertions |
| Admin media/rich detail, both sizes | PASS — 14 additional assertions |
| Horizontal overflow / browser errors | None observed in accepted flows |
| Six original source-file hashes | Unchanged |
| Cleanup | One disposable test archived; client records retained |

Initial browser checks needed automation corrections: wait for the editor to close after an asynchronous save, and scroll off-screen lazy images into view before checking loaded pixels. No core security or content fidelity behavior was weakened. Final runs passed; representative desktop/mobile screenshots were visually inspected.

Reproducible scripts require `CORE_QA_PROJECT_REF=xstssknlgdraulebdsfd`, `.env.local` configured for that QA project, and existing authorized synthetic fixtures. Preparation: `python scripts/pathology-prepare.py`; import: `node --env-file=.env.local scripts/pathology-import.mjs`; verification: `node --env-file=.env.local scripts/pathology-verify.mjs`. Browser scripts require `PLAYWRIGHT_MODULE` pointing to the installed Playwright module and the QA-configured local server on port 3004. Acceptance setup and cleanup scripts explicitly operate the same deterministic QA test; rerunning setup intentionally reactivates that test for another acceptance cycle.

## J. Git / environment / evidence

- Starting SHA: `6d2147a51e4534a778dba6f00ecc6ff43a3d1364`.
- Branch: `codex/pathology-import`.
- Final SHA: the delivery commit containing this report, supplied in the final task response (not embedded as a self-referential commit hash).
- QA Supabase: `xstssknlgdraulebdsfd` only.
- Production touched: **NO**. No deployment, database reset or migrations in this batch.
- Biochemistry: not started.

Changed application file: `src/components/admin/core-manager.tsx` adds subject/chapter/source/review filters and source-aware search/row details.

New import/acceptance code: `scripts/pathology-client.mjs`, `pathology-import-model.mjs`, `pathology-prepare.py`, `pathology-import.mjs`, `pathology-verify.mjs`, `pathology-duplicates.py`, `pathology-acceptance-setup.mjs`, `pathology-browser-qa.mjs`, `pathology-media-browser-qa.mjs`, `pathology-acceptance-cleanup.mjs`, and `src/lib/pathology-import.test.ts`.

Retained evidence under `docs/`: `pathology-import-manifest.json`, `pathology-quarantine.json`, `pathology-duplicates.json`, `pathology-database-verification.json`, `pathology-test-acceptance.json`, `pathology-browser-verification.json`, `pathology-media-browser-verification.json`, `pathology-cleanup-verification.json`, `pathology-gates.json`, and this report. Local screenshots remain under `.local-qa/pathology-*.png`; source DOCX files remain unchanged in `MOQ/` and are not added to Git.

## K. Final status

YES — PATHOLOGY COMPLETE, READY FOR NEXT SUBJECT

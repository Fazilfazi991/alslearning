# Pathology import preflight — 2026-09-10

## A. Verdict

`PATHOLOGY IMPORT — FAIL`

Stopped before database writes under the request's explicit instruction: "If a core-pipeline defect is found, STOP and report it rather than casually weakening security."

PATHO 1, source sequence 190 has four distinct solution images. The approved core only persists and renders one `explanation_image_path` per question. One source image is GIF, outside the configured PNG/JPEG/WebP bucket MIME allowlist. Faithful import requires ordered multiple-image support across the canonical authoring RPC, attempt snapshots, authorized image access, and Admin/Student rendering, plus source-preserving GIF handling. No workaround, security change, or core fix was made. The earlier import-readiness verdict did not cover this actual source requirement.

Evidence: `src/lib/core-repository.ts:33`, `src/components/student/core-test-engine.tsx:42,313`, and `supabase/migrations/20260910024559_core_content_pipeline.sql:7,129-131,168,237,242-245`. These define a singular path, snapshot/review representation, bucket formats, and path-based access checks. Live database configuration was not re-inspected in this stopped batch.

## B. Import summary

Counts are a read-only OOXML inventory of question tables, not completed structural validation. Images below are source occurrences, not uploads.

| Sub-head | Source Questions | Imported | Quarantined | Pending | Images | Previous-Paper Questions |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| PATHO 1 | 310 | 0 | 0 | 310 | 4 | Not validated |
| PATHO 2 | 137 | 0 | 0 | 137 | 0 | Not validated |
| PATHO 3 | 168 | 0 | 0 | 168 | 4 | Not validated |
| PATHO 4 | 100 | 0 | 0 | 100 | 0 | Not validated |
| PATHO 5 | 148 | 0 | 0 | 148 | 0 | Not validated |
| PATHO 6 | 105 | 0 | 0 | 105 | 0 | Not validated |
| TOTAL | 968 | 0 | 0 | 968 | 8 | Not validated |

Preflight reconciliation: source = imported + quarantined + pending, or 968 = 0 + 0 + 968. The required completed-import equation is not satisfied. Pending records are not malformed or quarantined records. Full parse-failure counts remain unassessed. No source content was silently omitted from an import; no import occurred.

## C. Taxonomy

Intended mapping in the existing Program → Subject → Chapter → Topic hierarchy is Subject `Pathology`, with these Chapters:

1. PATHO 1 - Haemopoiesis, Anaemia, Leukemia, Hemostasis
2. PATHO 2 - Clinical Pathology
3. PATHO 3 - Routine and Special Haematological Investigations
4. PATHO 4 - Cytology and Cytogenetics
5. PATHO 5 - Histopathology
6. PATHO 6 - Blood Banking

No taxonomy was created or changed, no Topics were invented, and live taxonomy resolution remains pending.

## D. Import anomalies

- PATHO 1, sequence 190: stem `The oxygen-hemoglobin dissociation curve is:`. Options are A `Hyperbolic` (Incorrect), B `Sigmoidal` (Correct), C `Linear` (Incorrect), D `Parabolic` (Incorrect). Solution text says `Ans: C`, followed by four images. Source marks are 1 and 0. Preserve B as the authoritative marked answer and retain the conflicting solution unchanged on eventual import.
- PATHO 4: all 100 solution cells are blank with no images. This is valid source content; leave explanations blank on eventual import.
- Malformed questions, missing answers/marks, duplicates, and other suspicious content: full assessment not completed because of the core stop condition. No clinical corrections made.
- Quarantined entries: none. All 968 records remain pending before import.

## E. Image verification

Eight embedded image occurrences discovered: zero stem images and eight solution images. PATHO 1 sequence 190 has four; PATHO 3 sequences 16, 24, 78, and 79 each have one. No stem-image acceptance example exists in this inventory.

PATHO 1 sequence 190 image order and binary evidence:

| Relationship | DOCX media | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| rId5 | word/media/image1.png | 166338 | c85a4cf6668b172f42ace6c0ec66e5442b91ebfa27224a458fe65bc67d46e781 |
| rId6 | word/media/image2.jpeg | 7366 | ce76bec45d085c0d60a9e4437b4b3aae08a9ec5fa1e7cc1ac7a7350ba69ba914 |
| rId7 | word/media/image3.png | 26286 | 57d69ac585e06b5c89af26b133d3d556b13243eb10b521d0c6b2af4a5ca17e8a |
| rId8 | word/media/image4.gif | 1477 | be60ef22ce9a2c4070e54196b978be87a44f32dc89cd5c498caa9a138f89bee3 |

The four blocker binaries were read in memory. Extracted to disk: 0. Uploaded: 0. Failed uploads: not applicable, none attempted. Admin/Student rendering and storage authorization: not tested in this batch. Images were not flattened into a montage, converted, discarded, or replaced with OCR.

## F. Source metadata

`pathology-preflight.json` records each original filename, SHA-256, sub-head, question count, blank-solution count, and image locations. It is a preflight inventory, not an imported-question manifest or completed idempotent importer.

A preliminary lexical scan found year/reference candidates in 30 PATHO 4 tables, 9 PATHO 5 tables, and 41 PATHO 6 tables (80 total). These are not verified previous-paper question counts; references outside tables and their scope still require parsing. No source/year/reference metadata has been written. The canonical source enum uses `previous_exam`; any future mapping must preserve the original label/reference and avoid uncertain inference.

## G. End-to-end QA

Not executed. No imported active questions, disposable QA test, Student attempt, grading result, or result history was created. Existing QA fixtures were left untouched.

## H. Gates

| Gate | Result |
| --- | --- |
| TypeScript / ESLint / production build | Not run: stopped before application changes |
| Unit/import tests | Not run; importer not implemented |
| Preflight reconciliation | 968 source = 968 pending; source hashes verified |
| Completed import reconciliation | Not achieved |
| Database verification | Not run; no database operations in this batch |
| Admin / Student desktop browser QA | Not run |
| 390px mobile QA | Not run |
| Console/runtime error check | Not tested |

Prior core-batch passes are not treated as evidence for this import batch.

## I. Git / environment

- Starting SHA: `29e1426bf0d2cb05a0fe6c95847e782bfe73b1e3`.
- Branch: `codex/pathology-import`.
- Final SHA: the commit containing this report and inventory; exact hash supplied in the delivery response (avoids a self-referential commit hash).
- Files changed: `docs/pathology-import-blocker.md`, `docs/pathology-preflight.json` only.
- Client DOCX files in `MOQ/` remain unmodified and untracked.
- Migrations: none.
- Approved QA database: `xstssknlgdraulebdsfd`; no reads or writes this batch.
- Original QA fixtures: untouched.
- Production touched: **NO**.

## J. Next-section readiness

`NO — PATHOLOGY STILL REQUIRES WORK`

The core image compatibility blocker needs resolution before resuming the source-faithful import and all acceptance gates. No Biochemistry work was started.

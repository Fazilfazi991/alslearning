# Core question media extension — stopped inspection

`CORE QUESTION MEDIA EXTENSION — FAIL`

`NO — PATHOLOGY IMPORT STILL BLOCKED`

## New blocker and stop condition

The request says: "If ANY other core-pipeline blocker is discovered: STOP." Read-only inspection found a source-formatting compatibility gap before schema implementation. The original import request explicitly requires preserving superscripts/subscripts and explanation formatting.

- PATHO 2, sequence 126: four option runs (`st`, `nd`, `rd`, `th`) and one solution run (`nd`) use Word superscript formatting.
- PATHO 4, sequence 68: four option runs (`nd`, `th`, `th`, `th`) use Word superscript formatting.

These are ordinary characters with OOXML `w:vertAlign` formatting, not existing Unicode superscript characters. The core stores option content and explanation as strings and renders them as React text. The Admin editor uses plain inputs/textareas. Flattening the source loses formatting; embedding HTML in these strings would display markup literally. Substituting Unicode characters would change the supplied text. No such transformation was made.

Evidence: `src/components/admin/core-manager.tsx:518,535-537`; `src/components/student/core-test-engine.tsx:250,309-310`; `supabase/migrations/20260910024559_core_content_pipeline.sql:129-135`. A source-preserving structured-text representation and safe rendering/editing path needs to be addressed alongside the authorized media work before asserting full source compatibility. This is a fidelity blocker, not an assertion that ordinal meaning changes when flattened.

The ordered-media extension has **not** been implemented. Existing single-image and GIF limitations remain. No schema/security changes were attempted after finding the additional blocker.

## GIF inspection

PATHO 1 `word/media/image4.gif` has **1 frame**, dimensions **291 × 355**, SHA-256 `be60ef22ce9a2c4070e54196b978be87a44f32dc89cd5c498caa9a138f89bee3`. It is static. The original was read in memory and not converted or uploaded. Existing `PrivateImage` uses `next/image` with `unoptimized`, a 300-second signed URL, and a 240-second refresh timer. Runtime expiry and GIF rendering were not tested. The bucket's migration allowlist still excludes GIF; this batch did not query live bucket settings.

## Six-file preflight inventory

Counts below are source inventory, not a passing full structural preflight. Stem/solution/multiple columns count questions.

| Sub-head | Questions | With stem images | With solution images | With multiple images | Image occurrences | GIF files |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PATHO 1 | 310 | 0 | 1 | 1 | 4 | 1 |
| PATHO 2 | 137 | 0 | 0 | 0 | 0 | 0 |
| PATHO 3 | 168 | 0 | 4 | 0 | 4 | 0 |
| PATHO 4 | 100 | 0 | 0 | 0 | 0 | 0 |
| PATHO 5 | 148 | 0 | 0 | 0 | 0 | 0 |
| PATHO 6 | 105 | 0 | 0 | 0 | 0 | 0 |
| Total | 968 | 0 | 5 | 1 | 8 | 1 |

Unsupported by the current image MIME allowlist: 1 GIF. Four ordered images on one question remain unrepresentable by the current singular-path pipeline. Additional full parser validation (malformed questions, missing answers/marks, all conflicts and formatting) was not completed because of the stop condition; those counts are **unassessed**, not zero. The nine superscript runs affect two questions.

Known answer conflict: PATHO 1 sequence 190 marks B Correct but its solution says `Ans: C`. Both source values remain unchanged, no answer was selected on the client's behalf, and the question remains pending for client/teacher clarification. This supersedes the prior report's proposal to treat B as the import answer.

Source reconciliation remains **968 = 0 imported + 0 quarantined + 968 pending**. All original source hashes match the previous inventory. No Pathology import or QA test creation occurred.

## Deliverables and validation

- `scripts/pathology-media-preflight.py`: repeatable read-only OOXML inventory for image occurrences, roles, source indices, GIF frame count, and vertical-format runs. Requires Python and Pillow; writes only JSON to stdout. This is not a complete importer or structural validator.
- `docs/pathology-media-preflight.json`: regenerated inventory with source hashes and exact formatting locations.
- `docs/core-media-extension-blocker.md`: this report.

Executed: six-file inventory scan, GIF decode/frame inspection, source-hash comparison, inventory arithmetic, and repeat-output comparison. No application changes were made.

| Required gate | Status |
| --- | --- |
| TypeScript | Not run — stopped before implementation |
| ESLint | Not run — stopped before implementation |
| Production build | Not run — stopped before implementation |
| Unit/media tests | Not implemented/run |
| Existing core DB tests | Not run |
| Security tests and signed URL expiry | Not run |
| Desktop Admin/Student QA | Not run |
| 390px mobile QA | Not run |
| All 968 structurally representable | Not confirmed; blockers remain |

## Git and environment

- Starting SHA: `081a2c52449ac15fe88c83a0d98428b5cd8a4b5a`.
- Branch: `codex/pathology-import`.
- Final SHA: commit containing these three files; exact hash in delivery response.
- Files changed: the three deliverables above only.
- Migrations added/applied: none.
- Approved QA DB: `xstssknlgdraulebdsfd`; no database reads or writes this batch.
- Existing QA fixtures/questions: untouched.
- Production touched: **NO**.
- Original DOCX files: unchanged and untracked.

Work stopped under the explicit additional-blocker condition. No import, source conversion, answer correction, or security relaxation occurred.

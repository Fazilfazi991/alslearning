# Core content fidelity extension

## A. Verdict

`CORE CONTENT FIDELITY EXTENSION — PASS`

No Pathology questions were imported. All six original DOCX hashes remain unchanged. The extension and synthetic acceptance work ran only against approved development/QA Supabase `xstssknlgdraulebdsfd`.

## B. Core capabilities

- Ordered, normalized `question_media` relations support zero, one, or multiple stem and solution images. Each relation retains role, position, path, MIME type, filename, and source JSON. Existing single-image references were backfilled without deleting their columns or objects.
- PNG, JPEG, WebP, and GIF use the existing private bucket. The renderer remains unoptimized and uses authorized signed URLs. Original image bytes are retained.
- A versioned JSON AST separates paragraph blocks, text runs, and an allowlist of bold, italic, underline, superscript, and subscript marks. Line breaks and ordinary Unicode are preserved. Searchable plain text is derived server-side from formatted fields; plain-text-only questions remain valid.
- The compact Admin toolbar edits selected text and shows a formatted preview. An unchanged save retains the AST. Edits preserve formatting outside the changed range, including the distinction between a paragraph boundary and an inline line break.
- Admin media lists support preview, removal, addition, and reordering. Galleries are separated by stem/solution role. Removing a relation does not delete storage bytes needed by historical snapshots.
- The canonical `core_save_question` RPC saves the question, formatted fields, options, keys, and media in one transaction. Invalid rich content or media rolls back the entire operation. Caller-supplied stable question/media IDs support repeatable saves without attachment duplication.
- Attempt snapshots retain original formatted content and ordered media. Active-attempt payloads omit solution text, solution AST, solution media, and keys. Review and media signatures retain existing enrollment, ownership, submission, and review-setting checks. Historical plain-text/single-image snapshots continue to work.
- Rich content renders as React text and explicit safe elements, never arbitrary HTML. Executable AST attributes/marks are rejected; literal HTML-looking source text is displayed as text.

## C. Six-file preflight

“Rich Text” counts questions with source run marks or list formatting. All 968 have such formatting, most commonly bold. “Images” counts image occurrences. “Structurally Ready” excludes records missing a marked correct answer; it does not indicate client approval of the content.

| Sub-head | Questions | Rich Text | Images | Conflicts | Structurally Ready |
| --- | ---: | ---: | ---: | ---: | ---: |
| PATHO 1 | 310 | 310 | 4 | 4 | 310 |
| PATHO 2 | 137 | 137 | 0 | 0 | 136 |
| PATHO 3 | 168 | 168 | 4 | 1 | 168 |
| PATHO 4 | 100 | 100 | 0 | 0 | 99 |
| PATHO 5 | 148 | 148 | 0 | 0 | 148 |
| PATHO 6 | 105 | 105 | 0 | 0 | 105 |
| **Total** | **968** | **968** | **8** | **5** | **966** |

Exact disjoint reconciliation: **961 structurally valid without detected answer-letter conflict + 5 structurally valid with content-review flags + 2 missing-answer records = 968**. All remain pending; imported = 0, actual quarantined database records = 0.

Two records must be quarantined rather than activated unless faculty supplies a correction:

- **PATHO 2 Q6**, “A cause of overflow proteinuria is:” — all four options are marked Incorrect; solution is `Answer:` with no answer supplied.
- **PATHO 4 Q43**, “Which of the following is a not an example for vapor fixative?” — all four options are marked Incorrect; solution is blank. The supplied `119/2024 previous QP` text is retained.

Five **CONTENT REVIEW REQUIRED** conflicts, preserved without choosing or changing an answer:

| Record | Marked option | Written solution letter |
| --- | --- | --- |
| PATHO 1 Q42 | B | C |
| PATHO 1 Q180 | B | C |
| PATHO 1 Q190 | B | C |
| PATHO 1 Q205 | B | A (the written answer text names the B option) |
| PATHO 3 Q97 | D | C (the written answer text names the D option) |

Conflict detection checks explicit `Ans`/`Answer` A–D references. This is not a clinical review or a claim that every possible content inconsistency has been detected.

Other inventory:

- Superscript formatting: **2 questions**, 9 formatted runs. Subscript formatting runs: **0 questions**; existing Unicode subscripts such as `A₂` remain unchanged.
- Questions with images: **5**, all solution images; multiple-image questions: **1**. Source images decoded/read in memory: **8**. Client image files extracted to disk/uploaded: **0/0**. GIFs: **1**, unsupported media: **0**.
- Exact duplicates: **3 pairs**, preserved: PATHO 1 Q209/Q294; PATHO 5 Q63/Q80; PATHO 5 Q70/Q72. Equality includes text AST, options/markings, solution AST, marks, and image hashes/order; no deduplication occurs.
- Blank solutions: PATHO 4's **100** blank solutions remain blank.
- No other blocking parser anomalies were detected in these six files. Resolved Word list markers/order are retained in text, with original list IDs/levels recorded in candidate metadata. VML horizontal separators are document decoration, not question images.
- Source document/hash/index keys and image relationships, role/order, original MIME, original filename, bytes/hash, and paragraph/run locations are recorded. Reference candidates remain in original text and candidate metadata; previous-paper scope classification belongs to the subsequent import mapping and is not guessed here.

The offline parser writes local candidate JSON, not database records. All **5,808** stem/option/solution AST fields passed the same canonical frontend validator and matched their plain-text projections.

## D. Specific blocker retests

- **PATHO 1 Q190:** four solution images resolve in source order `rId5`, `rId6`, `rId7`, `rId8`, positions 0–3. The canonical media model and allowed-review gallery support all four; synthetic DB/browser tests verify ordering and access. The client question itself was not uploaded or saved.
- **PATHO 2 Q126:** option runs `st`, `nd`, `rd`, `th` and solution run `nd` are preserved with `superscript` marks.
- **PATHO 4 Q68:** option runs `nd`, `th`, `th`, `th` are preserved with `superscript` marks.
- **GIF:** the original Q190 GIF remains one frame, 291 × 355 pixels, SHA-256 `be60ef22ce9a2c4070e54196b978be87a44f32dc89cd5c498caa9a138f89bee3`. No conversion. Synthetic static GIF upload, exact-byte retrieval, and Admin/Student rendering pass.
- **B-versus-C:** remains **CONTENT REVIEW REQUIRED**, not a core-system blocker. Neither source designation was changed.

## E. QA

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS, final run without warnings |
| `pnpm build` | PASS |
| Unit tests | PASS, 25 |
| Existing core DB tests | PASS, 80 assertions |
| Existing core security tests | PASS, 12 assertions |
| Fidelity DB/media/security tests | PASS, 42 assertions |
| Source-specific Python tests | PASS, 6 |
| Six-file preflight | PASS with 2 content quarantine candidates and 5 conflict flags |
| Desktop 1440px / mobile 390 × 844 | PASS, 27 combined browser assertions |
| Browser console/runtime errors / horizontal overflow | None in tested workflows |

DB coverage includes rollback on creation/edit, idempotent saves, reordered media, zero/one/multiple images, GIF/PNG/JPEG bytes, denied unrelated signatures, pre-submit solution denial, allowed-review signatures, hidden-review denial after submission, and expired signed-URL rejection. The existing core suite also exercises single/multiple MCQ, true/false, image MCQ, case-based questions, publication status, and grading.

Browser coverage creates and saves formatted questions, uploads two stem/four solution images, previews GIF, reloads and resaves without stripping formatting, attempts as an authorized fixture Student, refreshes answers, submits, renders all solution images, and refreshes historical review. Literal script-looking text remains inert. Screenshots are local acceptance artifacts under `.local-qa/`.

Five actual pre-migration reviews were verified through the current review RPC. All ten profiles in the immediately preceding core fixture manifest and its original question still exist. No original fixtures were deleted or reset. Fourteen disposable fidelity test configurations, including retry fixtures, were archived; all questions, attempts, snapshots, and image objects were retained.

Live database checks confirm the bucket is private, `question_media` has RLS, authenticated direct media inserts are denied, anonymous authoring execution is denied, and the private AST helper cannot be called directly by authenticated clients.

Supabase advisors were fetched through the authorized Management API after the connector denied access. No new media-table or AST-helper warning was reported. Existing notices remain for intentionally protected private tables, callable existing SECURITY DEFINER entry points, and disabled leaked-password protection. These are not reported as a clean advisor result or changed in this scoped batch. See [function advisory guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [private-table policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), and [password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## F. Git / environment

- Starting SHA: `b9db6c9c6480acba6f95bd592afbcc1e25d7593d`.
- Branch: `codex/pathology-import`.
- Final SHA: the commit containing this delivery; exact hash supplied in the final response.
- Forward migration added and applied to QA: `supabase/migrations/20260910042640_core_content_fidelity.sql`.
- QA DB: **xstssknlgdraulebdsfd**. No reset. Synthetic acceptance fixtures only; **no client Pathology import**.
- Production touched: **NO**.
- Source DOCX files remain unmodified and untracked.

Changed files (23):

- `.gitignore`
- `docs/core-content-fidelity-delivery.md`
- `docs/fidelity-verification.json`
- `docs/pathology-fidelity-preflight.json`
- `package.json`
- `scripts/fidelity-browser-qa.mjs`
- `scripts/fidelity-fixtures.mjs`
- `scripts/fidelity-qa.mjs`
- `scripts/fixtures/fidelity.gif`
- `scripts/fixtures/fidelity.jpeg`
- `scripts/fixtures/fidelity.png`
- `scripts/pathology-fidelity-preflight.py`
- `scripts/test_pathology_preflight.py`
- `src/components/admin/core-manager.tsx`
- `src/components/admin/rich-editor.tsx`
- `src/components/learning/question-gallery.tsx`
- `src/components/learning/rich-text.tsx`
- `src/components/student/core-test-engine.tsx`
- `src/lib/core-repository.ts`
- `src/lib/question-media.ts`
- `src/lib/rich-text.test.ts`
- `src/lib/rich-text.ts`
- `supabase/migrations/20260910042640_core_content_fidelity.sql`

Repeatable commands: `pnpm test`, `pnpm test:core-db`, `pnpm test:core-security`, `pnpm test:fidelity-db`, and `pnpm test:fidelity-browser`. DB commands require `CORE_QA_PROJECT_REF=xstssknlgdraulebdsfd` and authorized local environment credentials. Browser tests require the local production server on port 3003 and `PLAYWRIGHT_MODULE` pointing to the installed Playwright module; they use headless Edge. Python preflight requires Python/Pillow: `python scripts/test_pathology_preflight.py` and `python scripts/pathology-fidelity-preflight.py --records .local-qa/pathology-candidates.json`.

## G. Final readiness

`YES — PATHOLOGY PREFLIGHT CLEAR, SAFE TO RESUME IMPORT`

This permits resuming a controlled import with the two missing-answer records quarantined and the five conflicts retained for content review. It does not authorize silently repairing them or publishing all 968 as valid active questions. No import was performed in this batch.

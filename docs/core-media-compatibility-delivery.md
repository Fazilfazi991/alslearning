# A. Verdict

CORE MEDIA COMPATIBILITY EXTENSION — PASS

Both remaining core blockers are resolved. All 797 Microbiology source records reconcile: 791 structurally ready, two requiring content review, four quarantined, zero technical blockers. Microbiology was not imported.

# B. EMF source and display fidelity

All 11 original EMFs across ten questions are preserved byte-for-byte in local source storage, with filenames, MIME, SHA256, question relationship and order. All 11 have deterministic PNG display derivatives. There are zero failed conversions and zero unsupported EMFs in the corrected preflight.

The installed toolchain is Windows GDI+ for conversion and Microsoft Word 16 for independent rendering of the unmodified DOCX documents to PDF. Derivatives use the exact authored DOCX presentation at 600 DPI, preserving displayed aspect ratio, source colors, labels, arrows and white background. MICRO 2 Q46 has an explicit Word crop of 53.478% on the right; that authored crop and display proportions are retained. No crop was inferred and no source bytes were overwritten. The full uncropped EMF remains the original asset.

All 11 contain raster records; Q46 in MICRO 2 and Q77 in MICRO 4 also contain vector-text records. No duplicate original hashes were found. No alpha-blend or transparent-blit records were detected; visual comparison confirmed the source backgrounds. Original sizes range from 111,492 to 20,423,184 bytes. Exact bounding rectangles, physical frames, record types and presentation metadata are in [the source inventory](emf-source-inventory.json).

Every final derivative was visually compared against its actual Word-rendered source page for complete content, labels, colors, fonts, arrows/lines, readability and proportions. Fresh renders have identical hashes; cache reruns retain the same derivative, and identical bytes under another source filename retain that occurrence's filename. Conversion errors remain explicit blockers. [Conversion evidence](emf-conversion-verification.json) and [visual checks](emf-visual-verification.json) contain exact hashes and dimensions for every asset.

The existing `question_media.storage_path` and `mime_type` continue to identify the browser display asset. Existing JSONB `source.original` records original path, MIME, filename and SHA256; `source.conversion` records converter kind/version, display hash and dimensions. No EMF-specific content columns were added. The converter is reusable and optional at the parser boundary; the full preflight supplies it and requires a matching visual-review hash before accepting a derivative.

Both assets remain private. Eligibility and snapshot review rules authorize signing: eligible stem access works during the attempt; solution original and derivative access fail before permitted review and succeed afterward. Unrelated users cannot sign either asset. The Student renderer uses only the PNG display path. Admin shows “Source format: EMF · Display format: PNG” only for converted media. Full-size image links support inspection without reducing the stored derivative resolution.

Original-sized storage was tested with a 20,423,184-byte synthetic capacity fixture. The private QA bucket limit is now 32 MiB; the capacity fixture was removed immediately. This avoids a future failure when preserving the largest original.

## All affected source questions

The asset table below is generated from the verified conversion manifest. MICRO 2 is `app friendly format - JSO SIR 8 - BACTERIOLOGY.docx`; MICRO 3 is `app friendly format - JSO SIR 9 - MYCOLOGY.docx`; MICRO 4 is `app friendly format - JSO SIR 10 - PARASITOLOGY.docx`. Q40 contains two EMFs; every other listed question contains one.

| Question | Original filename / SHA256 | PNG dimensions | PNG bytes | Fidelity |
|---|---|---:|---:|---|
| MICRO 2 Q20 | `word/media/image7.emf`<br>`bc2fa31f4956e3a68b38bc65ad21af6b600ae73a3834aed0e4efeec7af40b7bb` | 2817 × 1730 | 1,831,470 | PASS |
| MICRO 2 Q40 | `word/media/image15.emf`<br>`20981c714d3214db7f3a7bfd633039b4279f810f7e29330ef45da9e261355228` | 2853 × 371 | 498,302 | PASS |
| MICRO 2 Q40 | `word/media/image16.emf`<br>`c8e5b9129639156dbab1b697650a6e61754e71142357533007ce3f6f9a69a28f` | 2853 × 263 | 360,502 | PASS |
| MICRO 2 Q46 | `word/media/image17.emf`<br>`10dbbe7a55f52ef0a9720f9833b8a8fbb57373011190fec4e2d751555dfd1a18` | 2356 × 1903 | 2,457,695 | PASS |
| MICRO 3 Q55 | `word/media/image5.emf`<br>`0d406f0cb019deb61b03b8bd6ef707a085420051f2b39d7e34214578c69a4ca1` | 2727 × 1037 | 4,320,318 | PASS |
| MICRO 3 Q57 | `word/media/image7.emf`<br>`f67220bcb894a58f5828dbbaf7460793b7ca225f57e2130ddc12ca80dfd48eac` | 2830 × 867 | 4,114,272 | PASS |
| MICRO 3 Q60 | `word/media/image13.emf`<br>`4d3e5e3fb7e3864c07a8e60ff51274a359d568a61308c26a81f2db67976eddcd` | 2763 × 1173 | 6,797,139 | PASS |
| MICRO 3 Q63 | `word/media/image16.emf`<br>`dd9fdf5a3d27f59042b152b640c53bcc5c592a7ed04344653571e7dffacfd12c` | 2633 × 929 | 4,723,270 | PASS |
| MICRO 4 Q69 | `word/media/image9.emf`<br>`1c6a831a3f2398b2dc0c55826a1e1a74a682b5ca9c57a83d4797f1344a97972d` | 2857 × 989 | 1,069,186 | PASS |
| MICRO 4 Q70 | `word/media/image13.emf`<br>`3e1af874f514246f887423d0ad91c32896d99d5ab64d23f15ae7631a6a818e19` | 756 × 1857 | 2,482,524 | PASS |
| MICRO 4 Q77 | `word/media/image19.emf`<br>`62a543f7bd6a8d2cfa75964aed24ecb310d41c6e97970ddb69677fe4deacede2` | 2657 × 1549 | 1,562,007 | PASS |

# C. MICRO 4 Q71 image-only stem

The source contains one JPEG stem (`word/media/image11.jpeg`, 39,138 bytes), no visible textual stem, and four textual options. The JPEG SHA256 is `16db20390523151bc52576a2b0fc4de4cbab39d5db27975d21e9047c0b9e7d4a`. Original alt text is preserved verbatim: “Entamoeba coli, smear showing cysts * – Instruments Direct”. No title was supplied, and no OCR, visible placeholder or generated medical description was added.

The parser retains an empty prompt and one ordered stem-media relation. The validator accepts text-only, one/multiple stem images, and text plus images, while rejecting completely empty and whitespace-only stems. Options, answers, marks and taxonomy checks remain enforced. Admin's “Image-only question” is a display/search fallback, never stored as client-authored text.

The real Q71 JPEG and options were previewed locally at both required viewports with no database insertion or upload. The live Admin/Student workflow was verified using synthetic image-only content: save, image before options, answer persistence on refresh, grading and historical image retention after source edits. The real source's rendering capability is established by those shared-component checks; it was not secretly imported for testing.

# D. Complete Microbiology preflight

| Sub-head | Source | Ready | Review | Quarantine | Technical Blockers | Images | Tables |
|---|---:|---:|---:|---:|---:|---:|---:|
| MICRO 1 | 98 | 97 | 0 | 1 | 0 | 22 | 7 |
| MICRO 2 | 102 | 102 | 0 | 0 | 0 | 31 | 8 |
| MICRO 3 | 100 | 100 | 0 | 0 | 0 | 16 | 2 |
| MICRO 4 | 102 | 101 | 0 | 1 | 0 | 22 | 3 |
| MICRO 5 | 101 | 101 | 0 | 0 | 0 | 12 | 3 |
| MICRO 6 | 101 | 98 | 2 | 1 | 0 | 12 | 0 |
| MICRO 7 | 193 | 192 | 0 | 1 | 0 | 1 | 1 |
| TOTAL | 797 | 791 | 2 | 4 | 0 | 116 | 24 |

Counts were independently recomputed from top-level question wrappers. There are 11 EMFs (MICRO 2: four, MICRO 3: four, MICRO 4: three) and one image-only stem. The 116 image occurrences include the 11 source EMFs; derivatives do not inflate that count. All 24 native tables remain attached to their 21 parent questions, with zero false questions. All 31 explicit previous-paper candidates remain in MICRO 7.

Repeated final preflight output is deterministic: SHA256 `88a3d62271a6ca124dcdee850de4dfba0df4f48e5fcc579e25869176096155af`. All 13 original Pathology/Microbiology DOCX hashes still match the earlier inventories. [Full reconciliation](microbiology-preflight.json) and [ordered media inventory](microbiology-media-inventory.json) are retained; complete local candidate payloads remain in `.local-qa/microbiology-preflight-records.json`.

# E. Exact anomalies

**Content review / answer conflicts (2):**

- MICRO 6 Q70: marked C, “Standard plate count”; written answer D, “H₂S strip test”.
- MICRO 6 Q72: marked C, “Plague”; written answer B, “Anthrax”.

**Quarantine / missing correct-option markers (4):**

- MICRO 1 Q34: `Correct Answer:- Qn Cancelled` — cancelled.
- MICRO 4 Q16: `Correct Answer:-Question Cancelled` — cancelled.
- MICRO 6 Q76: written answer C, “Implement control measures”, with no correct-option marker.
- MICRO 7 Q36: written answer B, “IgE”, with no correct-option marker.

The two cancelled records are included in the four quarantines. No keys were inferred or repaired.

**Exact stem/options/answer duplicate groups (3):** MICRO 1 Q19 / MICRO 2 Q1; MICRO 1 Q24 / MICRO 6 Q2; MICRO 2 Q96 / Q97. Only the last pair also has an identical explanation; the first two differ in explanation punctuation. Same-normalized-stem/different-explanation groups are the first two pairs and MICRO 1 Q43 / MICRO 6 Q25; none has a different marked answer.

**Near-duplicate candidates (2):** MICRO 1 Q29 / MICRO 6 Q21 (0.9945 similarity); MICRO 1 Q51 / MICRO 6 Q33 (0.9637). All occurrences are retained, without deduplication or clinical adjudication.

Remaining technical blockers: **none**. Additional malformed-question quarantines: **none**. False-question/parser artifacts detected: **none**. These are source-structure and explicit-answer-label checks, not an independent medical-content review.

# F. Regression and QA

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS; browser QA used the built app on localhost:3006 |
| `pnpm test` | PASS, 38 tests across six files |
| Python parser/regression suite | PASS, 14 tests |
| EMF conversion tests | PASS, 11/11 originals/derivatives, fresh-render determinism, MIME, aspect ratio, cache identity and explicit invalid-input failure |
| EMF visual fidelity | PASS, all 11 compared against actual Word source pages |
| Core media DB acceptance | PASS, 40 assertions |
| Meaningful-stem DB guard | PASS, four assertions |
| Existing core security suite | PASS, 12 assertions, using an existing test and restoring its configuration |
| Private storage capacity | PASS, original-sized synthetic object uploaded and removed |
| Admin/Student desktop and 390 × 844 mobile | PASS, 25 assertions; loaded images, refresh, grading, history and no overflow/runtime errors |
| Real-source local browser previews | PASS, all 11 PNG derivatives plus Q71 JPEG at both viewports, no uploads |
| Native tables / table-image ordering / rich marks | PASS, 33 browser assertions at both sizes; all 24 source tables retained |
| Pathology database regression | PASS, 24 checks of all 966 stored records, original fields/keys/status and eight original media bytes |
| Pathology media browser | PASS, 14 checks including four ordered images and GIF |
| Pathology historical review | PASS at both viewports; existing 10/10 snapshot and images preserved |
| Legacy Pathology parser payloads | PASS, all 968 source records retain approved legacy rich/media payloads |
| Complete seven-file preflight | PASS, 797 reconciled, zero technical blockers |
| Source hashes / Git whitespace check | PASS |

The core database gate used targeted transactional acceptance plus the existing security suite. The original fixture-creating bootstrap suite was not rerun, to honor the prohibition on creating tests and preserve existing fixtures. No new tests or taxonomy were created.

Evidence is in the `media-*-verification.json`, `meaningful-stem-verification.json`, `emf-*-verification.json` and existing Pathology/native-table artifacts. Screenshots and Word PDFs remain local under `.local-qa/`. Source previews never called Supabase.

Supabase advisors still report 21 warnings on pre-existing objects/settings: two anonymous SECURITY DEFINER functions, 18 authenticated SECURITY DEFINER functions, and disabled leaked-password protection. No new private helper was flagged. Unrelated permissions/Auth settings were not changed. Storage authorization follows the existing [Supabase RLS access-control model](https://supabase.com/docs/guides/storage/security/access-control).

# G. Git and environment

- Branch: `codex/microbiology-preflight`.
- Starting SHA: `d75f3685a49b988a24911dec4694bb780e8bb16b`.
- Final SHA: the delivery commit containing this report; the exact hash is included in the final task response.
- QA Supabase: `xstssknlgdraulebdsfd`.
- Production touched: **NO**. No deployment, reset or Pathology re-import.

Forward migrations applied only to QA:

1. `20260910071239_core_media_compatibility.sql`: meaningful image-only authoring, source/display validation and private authorization, EMF original MIME allowance.
2. `20260910073352_core_original_media_capacity.sql`: private original-asset capacity increased from 10 MiB to 32 MiB.
3. `20260910073804_core_meaningful_stem_guard.sql`: deferred final-state validation rejects whitespace-only content without valid stem media.

QA operations used one new generic synthetic question and an existing generic test. Five synthetic original/display/replacement objects and six media acceptance attempts were removed, together with the synthetic question. The additional capacity object was also removed. The original test configuration and relations were restored; existing fixture questions, prior attempts and Pathology remain intact. Additional security/table regression attempts on existing fixtures remain as QA evidence. [Cleanup evidence](media-compatibility-cleanup.json).

No Microbiology taxonomy, questions, tests or real media were written/uploaded. Converted client assets remain local only. No source DOCX is included in the commit.

Implementation changes cover the canonical parser/conversion helper, media metadata utilities, Admin identification/preview, shared private image/gallery/rich rendering, Student empty-text handling, three migrations, focused QA scripts/tests and evidence. Exact changed files are listed below.

- `docs/core-media-compatibility-delivery.md`
- `docs/emf-conversion-verification.json`
- `docs/emf-source-inventory.json`
- `docs/emf-visual-verification.json`
- `docs/meaningful-stem-verification.json`
- `docs/media-advisor-verification.json`
- `docs/media-capacity-verification.json`
- `docs/media-compatibility-browser-verification.json`
- `docs/media-compatibility-cleanup.json`
- `docs/media-compatibility-db-verification.json`
- `docs/media-core-security-verification.json`
- `docs/media-source-browser-verification.json`
- `docs/microbiology-media-inventory.json`
- `docs/microbiology-preflight.json`
- `docs/native-table-browser-verification.json`
- `scripts/convert-emf.ps1`
- `scripts/core-security-existing-qa.mjs`
- `scripts/emf-conversion-qa.py`
- `scripts/emf-inventory.py`
- `scripts/emf-visual-evidence.py`
- `scripts/emf-word-reference.ps1`
- `scripts/meaningful-stem-qa.mjs`
- `scripts/media-capacity-qa.mjs`
- `scripts/media-compatibility-browser-qa.mjs`
- `scripts/media-compatibility-cleanup.mjs`
- `scripts/media-compatibility-fixture.ps1`
- `scripts/media-compatibility-qa.mjs`
- `scripts/media-source-browser-qa.mjs`
- `scripts/media_derivatives.py`
- `scripts/microbiology-preflight.py`
- `scripts/native-table-browser-qa.mjs`
- `scripts/native-table-pathology-history.mjs`
- `scripts/pathology-fidelity-preflight.py`
- `scripts/test_media_compatibility.py`
- `src/components/admin/core-manager.tsx`
- `src/components/learning/private-image.tsx`
- `src/components/learning/question-gallery.tsx`
- `src/components/learning/rich-text.tsx`
- `src/components/student/core-test-engine.tsx`
- `src/lib/media-compatibility.test.tsx`
- `src/lib/question-media.ts`
- `supabase/migrations/20260910071239_core_media_compatibility.sql`
- `supabase/migrations/20260910073352_core_original_media_capacity.sql`
- `supabase/migrations/20260910073804_core_meaningful_stem_guard.sql`

# H. Final readiness

YES — MICROBIOLOGY PREFLIGHT CLEAR, SAFE TO IMPORT

This is readiness only. No automatic import was performed.

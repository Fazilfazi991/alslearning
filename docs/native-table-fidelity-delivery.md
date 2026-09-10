# A. Verdict

CORE NATIVE TABLE FIDELITY — PASS

The original native-table blocker is resolved. The complete seven-file preflight is still blocked by 11 questions with separate media or image-only-stem limitations. Nothing from Microbiology was imported.

# B. Table implementation

The existing JSONB rich-text fields now accept a strictly validated version 2 document with ordered paragraph, table and role-scoped media-reference blocks. Version 1 remains supported. Tables preserve rows, cells, cell-rich-text, header semantics, colspan and rowspan. Explicit before/after grid offsets preserve the omitted trailing column in Mycology Q11. There are no new content columns, raw HTML fields or Microbiology-specific representations.

DOCX traversal follows the question wrapper's direct paragraph/table children. Text in nested educational cells cannot become question boundaries. Paragraph/table/image interleaving is retained through references to the existing ordered private media relations. Table-cell media is covered by synthetic parser tests. The completed Pathology preparation path explicitly retains its legacy media representation so its approved payloads remain identical.

Cell content retains paragraphs, line breaks, approved formatting marks, Unicode and list text. Plain-text projection recursively includes cells for server search and previews; all 24 real source table projections agree with the QA database validator. The renderer uses escaped React text and semantic table/th/td elements, bounded spans and an internal horizontal scrolling region. Arbitrary attributes, URLs and executable markup are rejected.

Admin supports paragraph/cell text edits and a structure-preserving no-op save. Adding/removing rows or columns is deliberately unsupported and documented in the editor. Student stems, options, explanations and historical reviews share the table renderer. Pre-submission payloads exclude explanation tables and solution media; review settings remain snapshotted. Historical table content survives later source edits.

Both 1440px desktop and 390 × 844 mobile passed, with no page-level horizontal overflow or browser errors. Wide tables scroll inside their own region without shrinking text or rearranging cells into cards.

Inventory: 24 tables, 1–21 rows, 2–5 columns; 10 horizontal merged cells; no source vertical merges (synthetic rowspan tested); three empty cells; 262 bold runs. No nested tables, OLE objects, equations, essential shapes or images inside these 24 tables. Source ordering, individual cell features and original Word header metadata are retained in [the inventory](native-table-feature-inventory.json). Header inference accepts explicit Word headers or an entirely bold first row spanning all columns.

# C. Original blocker retest

| Check | Result |
|---|---:|
| Original / corrected native content tables | 24 / 24 |
| Corrected table-affected questions | 21 |
| Discovered / parsed / attached to correct parent / structurally rendered | 24 / 24 / 24 / 24 |
| Legacy descendant-table candidates / actual question wrappers | 821 / 797 |
| False table-as-question candidates before / after | 24 / 0 |

The previous observed General Microbiology failure was 105 records instead of 98. Across all seven files the independent XML inventory separates 797 top-level wrappers and 24 content tables. The corrected parser recalculates the 797 records from wrapper boundaries; it does not preserve an assumed total.

# D. Microbiology preflight

| Sub-head | Corrected Source | Ready | Review | Quarantine | Technical Blockers | Images | Native Tables |
|---|---:|---:|---:|---:|---:|---:|---:|
| MICRO 1 — General Microbiology | 98 | 97 | 0 | 1 | 0 | 22 | 7 |
| MICRO 2 — Bacteriology | 102 | 99 | 0 | 0 | 3 | 31 | 8 |
| MICRO 3 — Mycology | 100 | 96 | 0 | 0 | 4 | 16 | 2 |
| MICRO 4 — Parasitology | 102 | 97 | 0 | 1 | 4 | 22 | 3 |
| MICRO 5 — Virology | 101 | 101 | 0 | 0 | 0 | 12 | 3 |
| MICRO 6 — Applied Microbiology | 101 | 98 | 2 | 1 | 0 | 12 | 0 |
| MICRO 7 — Immunology | 193 | 192 | 0 | 1 | 0 | 1 | 1 |
| TOTAL | 797 | 780 | 2 | 4 | 11 | 116 | 24 |

Every record has one classification and a unique source-SHA/sequence identity. Source indices are one-based top-level question order. Two final full preflight runs produced identical summary bytes (SHA256 `c51f9bda74057c8822e6e7a9d8b3c1cfb0296e2eada83958afff36cc2838972e`). All 13 original Pathology and Microbiology DOCX hashes still match the earlier inventories.

There are 31 explicit previous-paper reference candidates, all in MICRO 7; the other six files have zero. References and years are preserved locally for later canonical source-type mapping; no taxonomy was created. All 797 records have 1 mark and 0 negative marks. There are 116 image occurrences: 61 PNG, 42 JPEG, 2 GIF and 11 EMF; 13 stem and 103 solution images, across 23 multiple-image questions. Six tables occur in stems and 18 in solutions.

Formatting inventory: 796 questions with bold, 44 italic, 11 underline, 91 scientific-Unicode, 149 with bullets, 61 multi-statement stems and six match/combination MCQs. There are no explicit superscript/subscript formatting marks in this source batch; literal scientific Unicode is retained and synthetic tests cover both marks. Longest explanation: MICRO 2 Q23, 1,769 characters including its table. Full results are in [microbiology-preflight.json](microbiology-preflight.json) and [media inventory](microbiology-media-inventory.json). The complete 797 local candidate payloads are retained in `.local-qa/microbiology-preflight-records.json`; this is not an import manifest.

# E. Exact anomalies

**Answer conflicts / content-review items (2):**

- MICRO 6 Q70: marked C, “Standard plate count”; written answer D, “H₂S strip test”.
- MICRO 6 Q72: marked C, “Plague”; written answer B, “Anthrax”.

**Missing correct-option markers (4), all quarantined:**

- MICRO 1 Q34: `Correct Answer:- Qn Cancelled` — cancelled.
- MICRO 4 Q16: `Correct Answer:-Question Cancelled` — cancelled.
- MICRO 6 Q76: solution says `Answer: C) Implement control measures`, but no correct-option marker.
- MICRO 7 Q36: solution says `Correct Answer: B) IgE`, but no correct-option marker.

Cancelled questions are the first two of those four, not four additional records. No answer was inferred or repaired. No additional malformed-record quarantine was found; MICRO 4 Q71 is treated as a technical representation limitation below.

**Exact stem/options/marked-answer duplicate groups (3):**

- MICRO 1 Q19 / MICRO 2 Q1 — explanation punctuation differs.
- MICRO 1 Q24 / MICRO 6 Q2 — explanation punctuation differs.
- MICRO 2 Q96 / MICRO 2 Q97 — explanation also identical.

Same-normalized-stem/different-explanation groups are the first two above and MICRO 1 Q43 / MICRO 6 Q25; none has a different marked answer. Near-duplicate candidates are MICRO 1 Q29 / MICRO 6 Q21 (0.9945 character similarity) and MICRO 1 Q51 / MICRO 6 Q33 (0.9637). Near matching requires token Jaccard ≥0.8 and character similarity ≥0.9. Every source occurrence is retained; no medical equivalence or automatic deduplication is inferred.

**Parser artifacts:** zero remaining false questions, replacement-character or soft-hyphen artifacts detected. The false list warnings in MICRO 1 Q6/Q32 were corrected: Word `numId=0` disables numbering, as specified by [Microsoft's NumberingId documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.numberingid?view=openxml-3.0.1). This preflight checks explicit source structure and answer labels, not independent clinical correctness.

**Remaining technical blockers (11 questions):**

| Question | Exact source object | Limitation |
|---|---|---|
| MICRO 2 Q20 | `word/media/image7.emf` | EMF solution image |
| MICRO 2 Q40 | `word/media/image15.emf`, `image16.emf` | Two EMF solution images |
| MICRO 2 Q46 | `word/media/image17.emf` | EMF solution image |
| MICRO 3 Q55 | `word/media/image5.emf` | EMF solution image |
| MICRO 3 Q57 | `word/media/image7.emf` | EMF solution image |
| MICRO 3 Q60 | `word/media/image13.emf` | EMF solution image |
| MICRO 3 Q63 | `word/media/image16.emf` | EMF solution image |
| MICRO 4 Q69 | `word/media/image9.emf` | EMF solution image |
| MICRO 4 Q70 | `word/media/image13.emf` | EMF solution image |
| MICRO 4 Q77 | `word/media/image19.emf` | EMF solution image |
| MICRO 4 Q71 | Image-only JPEG stem, no text | Canonical required-text validation rejects an empty prompt |

The DOCX declares the 11 EMF occurrences as `image/x-emf`; the current private-media allowlist cannot accept/render them faithfully. No conversion or image substitution was attempted. The image-only stem was visually inspected; no wording was invented. These are new core limitations independent of the now-supported tables.

# F. QA

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS; final browser run used the built app on localhost:3005 |
| `pnpm test` | PASS, 35 tests in five files |
| Python unittest discovery `scripts/test_*py` | PASS, 11 tests: six Pathology, two boundary, three native-table |
| Core DB suite | PASS, 80 assertions |
| Core security suite | PASS, 12 assertions |
| Native table DB acceptance | PASS, 13 assertions; invalid edits roll back, search, no-op, authoring/review protection |
| All real table SQL projections | PASS, 24/24; read-only, no stored Microbiology content |
| Desktop/mobile native-table browser acceptance | PASS, 33 assertions, no console/runtime errors |
| Pathology database regression | PASS, 24 checks of 966 stored questions, keys/options, status and original private media |
| Pathology media browser regression | PASS, 14 checks, eight original images including ordered four-image question and GIF |
| Pathology historical review | PASS at both viewports; original 10/10 attempt, rich text and four images preserved |
| Legacy Pathology preparation payload comparison | PASS, all 968 source records unchanged including quarantined records |
| Full seven-file preflight execution/reconciliation | PASS, deterministic; readiness remains BLOCKED as above |

Evidence: [DB acceptance](native-table-db-verification.json), [all-table projection](native-table-projection-verification.json), [browser acceptance](native-table-browser-verification.json), [Pathology history](native-table-pathology-regression.json), and existing Pathology verification artifacts. Browser screenshots remain in `.local-qa/native-*.png`. Real Microbiology tables were rendered locally; app persistence tests used generic synthetic content only. The real-source unit test requires the local fixture generated by the Python suite and skips that one test when client source fixtures are absent.

Supabase advisors returned 21 warnings on pre-existing objects/configuration: two anonymous SECURITY DEFINER functions, 18 authenticated SECURITY DEFINER functions, and disabled leaked-password protection. No new private table helper was flagged. These are not represented as a clean advisor result; unrelated permissions/Auth settings were not changed. Relevant remediation: [anonymous functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

# G. Environment and Git

- QA: `xstssknlgdraulebdsfd`.
- Production touched: **NO**. No deployment or database reset.
- Branch: `codex/microbiology-preflight`.
- Starting SHA: `51fa995752a36521cafe69657aef2749a032d4de`.
- Final SHA: the delivery commit containing this report; exact hash is included in the final task response.
- Forward migrations applied only to QA: `20260910060858_core_native_tables.sql` and `20260910061431_core_table_grid_offsets.sql`.

Existing JSONB columns needed no schema expansion, but their database validators required a forward extension. Migrations add/replace private recursive validation/plain-text helpers and a deferred media-reference validation trigger. They preserve v1 and existing snapshot/RPC protections; neither migration deletes data.

QA acceptance operations used existing synthetic identities/taxonomy plus one generic table question, one generic test, synthetic attempts and three generated PNG media objects. The generic question and test were archived after browser verification; attempt snapshots/media remain as QA evidence. Existing core suites used their own disposable fixtures. No Microbiology question, media, taxonomy or test was persisted. Pathology was verified without re-import or source changes.

Changed implementation files: `src/lib/rich-text.ts`; shared learning renderer; Admin rich editor/core manager; Student core test engine; canonical DOCX parser; Pathology preparation compatibility flag; Pathology browser origin configuration. Added native-table unit/parser/DB/browser/history/projection QA, table inventory and complete preflight scripts, Vitest alias configuration, two forward migrations and the evidence/report files. Source DOCX files remain outside the commit. Use `git show --stat` on the delivery commit for the complete exact file list.

# H. Final readiness

NO — MICROBIOLOGY IMPORT STILL BLOCKED

Next work requires a separate reusable fidelity decision for EMF media and image-only stems. This batch ends at the corrected preflight.

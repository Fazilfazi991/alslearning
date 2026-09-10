# Microbiology preflight technical stop — 2026-09-10

MICROBIOLOGY PREFLIGHT — FAIL

The initial structural scan confirmed a genuine fidelity blocker: **24 native DOCX content tables across 21 source questions cannot be represented by the current canonical rich-text model**. Per the user's explicit stop condition, the content preflight was stopped before full content classification. No Microbiology questions, taxonomy or media were written to any database or storage. No core repair was attempted.

## Verified structural inventory

These counts identify actual question wrapper tables by their Question/Type rows, separating nested educational tables from questions. Source indices are one-based question-wrapper order within each file, not page numbers or the current parser's incorrect all-table sequence. All 821 native tables reconcile as 797 question wrappers plus 24 content tables; none is unaccounted for in this scan.

| Provisional sub-head | Source records | Confirmed table-blocked records | Remaining classification pending | Image occurrences | Native content tables |
|---|---:|---:|---:|---:|---:|
| MICRO 1 - General Microbiology | 98 | 7 | 91 | 22 | 7 |
| MICRO 2 - Bacteriology | 102 | 7 | 95 | 31 | 8 |
| MICRO 3 - Mycology | 100 | 1 | 99 | 16 | 2 |
| MICRO 4 - Parasitology | 102 | 2 | 100 | 22 | 3 |
| MICRO 5 - Virology | 101 | 3 | 98 | 12 | 3 |
| MICRO 6 - Applied Microbiology | 101 | 0 | 101 | 12 | 0 |
| MICRO 7 - Immunology | 193 | 1 | 192 | 1 | 1 |
| **TOTAL** | **797** | **21** | **776** | **116** | **24** |

For each row, Source records = Confirmed table-blocked records + Remaining classification pending. This deliberately does **not** present the requested final Ready/Review/Quarantine/Technical Blockers table as complete: the 776 pending records have not been assigned those buckets, and the 21 table-bearing records may also have content anomalies. Zero native tables in Applied Microbiology does not establish that file is import-ready. Image counts are embedded DrawingML image occurrences, not a completed unique-file/MIME/role/image-based-table inventory.

## Reproducible blocker

MICRO 1 Q1 contains an editable native table in its solution with columns **Agents**, **Physical methods**, **Chemical methods**, including high-, intermediate- and low-level disinfectant comparisons. Its row/column relationships carry educational meaning. The original table XML and cell matrix are retained in `microbiology-structure-scan.json`.

The existing parser in `scripts/pathology-fidelity-preflight.py`:

- Iterates every descendant `w:tbl` as a question. On General Microbiology it produces 105 records, although only 98 are question wrappers; seven educational tables become false extra question records and shift subsequent identities.
- Reads only direct `w:p` children of question/solution cells. Nested tables are omitted from the parent rich content. The regression test demonstrates that “Quaternary ammonium compounds” exists in Q1's source table but disappears from its parsed explanation.

`src/lib/rich-text.ts` permits only paragraph blocks containing text runs and inline marks. `src/components/learning/rich-text.tsx` renders those runs and line breaks. The database validator in `supabase/migrations/20260910042640_core_content_fidelity.sql` likewise rejects block properties other than `runs`. There is no canonical table node, cell/row/span structure or approved table conversion mechanism. Parser-only flattening would not repair the canonical representation, Admin edit/save, Student review or historical snapshot fidelity.

No table was flattened, screenshotted or converted. This is structural source/code evidence, not a claim that all DOCX pages were visually audited. A future repair must preserve row/column relationships, cell formatting/merges and placement among surrounding content through every authoring, validation, rendering and snapshot boundary, then repeat the complete preflight. It must also correct question-wrapper identity extraction. No repair or import is authorized by this stop report.

## Exact native-table locations

The seven filenames are recorded in full with SHA-256 hashes in the JSON evidence. JSO SIR 7–13 map provisionally to MICRO 1–7; no names were persisted or certified as existing client-approved database taxonomy.

| Source file | Source question indices | Table roles |
|---|---|---|
| JSO SIR 7 — GENERAL MICROBIOLOGY | Q1, Q9, Q12, Q20, Q89, Q90, Q91 | Solutions Q1/Q9/Q20; stems Q12/Q89/Q90/Q91 |
| JSO SIR 8 — BACTERIOLOGY | Q6, Q9, Q23, Q58, Q68, Q78, Q88 | Solutions throughout; Q78 additionally has a stem table |
| JSO SIR 9 — MYCOLOGY | Q11 | Two solution tables |
| JSO SIR 10 — PARASITOLOGY | Q61, Q102 | One solution table at Q61; two at Q102 |
| JSO SIR 11 — VIROLOGY | Q28, Q29, Q59 | Solution tables |
| JSO SIR 12 — Applied Microbiology | None found | — |
| JSO SIR 13 — Immunology | Q192 | Stem table |

Total: six stem tables and 18 solution tables. Several stem tables express matching relationships; their table structure is the blocker. Their presence alone does not make them interactive matching questions.

## Deferred work after the required stop

Ready/Review/Quarantine classifications; cancellation and missing-answer lists; marked/written-answer conflicts; marks distributions; exact and near duplicates; complete scientific-format/list inventories; image MIME/dimensions/roles and image-based-table inspection; text/image/table interleaving assessment; long-record limits and Admin/Student fidelity acceptance; source metadata and taxonomy confirmation. None is reported as zero or passing. The known Parasitology cancellation mentioned by the user has not been adjudicated or assigned a location by this structural scan.

This is a failed, incomplete preflight with a proven stop condition, not a completed import manifest. All source files remain recoverable and unchanged.

## Local gates and regression

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm test` | PASS — 29 unit/import tests |
| `python scripts/test_pathology_preflight.py` | PASS — six original Pathology parser checks |
| `python scripts/test_microbiology_structure.py` | PASS — two structural/determinism tests, including proof of current parser loss |
| Repeated structural scan | Identical complete scan results, including source hashes |
| Source hash verification | All seven Microbiology and six Pathology DOCX hashes unchanged |
| Database/security acceptance imports | Not run; preflight is local only |

The original Pathology test harness initially skipped its six tests because it assumed MOQ contained exactly six DOCX files. It now selects the six approved Pathology sources from the existing baseline manifest. The six tests then ran and passed. This is a test-discovery correction only; the Pathology parser, core application, database and imported content were not changed.

## Git and environment

- Starting SHA: `97cc28da8c674b8ed8743b954fdae13bdb5138e7` — includes the completed approved Pathology import.
- Branch: `codex/microbiology-preflight`.
- Final delivery SHA is supplied in the task response.
- Added: `scripts/microbiology-structure-scan.py`, `scripts/test_microbiology_structure.py`, `docs/microbiology-structure-scan.json`, this report.
- Modified: `scripts/test_pathology_preflight.py` test discovery only.
- Source DOCX files remain untracked and unchanged under `MOQ/`.
- Database access/writes: **none**. Media uploads: **none**. Taxonomy persistence: **none**.
- QA target remains `xstssknlgdraulebdsfd`, but no connection was required.
- Production touched: **NO**. Migrations: **none**. Deployments: **none**. Other subjects: not started.

NO — MICROBIOLOGY IMPORT BLOCKED

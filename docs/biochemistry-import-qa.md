# Biochemistry QA import acceptance — 11 September 2026

## A. Verdict

BIOCHEMISTRY IMPORT — PASS

Imported only into QA `xstssknlgdraulebdsfd` using the existing authenticated Admin and canonical `core_save_question`. Production was untouched. No deployment or push was performed.

## B. Reconciliation

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

713 usable database records plus one recoverable quarantine payload reconcile all 714 sources. Technical blockers: 0. Images and uploads: 0. One existing canonical Biochemistry subject was reused; eight canonical chapters were created. No question-derived topics were invented.

## C. Review items

All five remain Draft and retain the original answer markers and explanations. No scientific correction was made.

| Source | Preserved anomaly |
|---|---|
| BIO 6 Q73 | B marked correct; solution names “B) Peritoneal fluid”, but that named option is A. |
| BIO 6 Q77 | C marked correct; solution additionally states D is also correct. |
| BIO 6 Q135 | A marked correct; solution names “A) < 9”, but that named option is D. |
| BIO 6 Q172 | A marked correct; solution names “Formation of thread over 2 cm long”, which is option B. |
| BIO 6 Q188 | A marked correct; solution names “Sodium citrate”, which is option D. |

Admin Draft filtering located exactly these five. Canonical test authoring rejected each in manual selection; the generated Active bank contained exactly 708 eligible records.

## D. Quarantine

BIO 5 Q31 has no option marked Correct. Its written solution says “Correct Answer: C) Cytoplasm”; that was not used to infer a key. Complete stem, options, solution, marks, AST, filename, hash, sequence, metadata and reason remain in `biochemistry-quarantine.json`, referenced by the import manifest. No normal database question exists for this identity.

## E. Tables

| Source | Role | Rows × columns |
|---|---|---:|
| BIO 3 Q5 | Stem | 4 × 3 |
| BIO 5 Q13 | Stem | 5 × 2 |
| BIO 5 Q34 | Stem | 5 × 2 |
| BIO 5 Q42 | Stem | 5 × 2 |
| BIO 6 Q13 | Stem | 4 × 3 |
| BIO 7 Q47 | Stem | 5 × 2 |
| BIO 8 Q8 | Solution | 5 × 6 |
| BIO 8 Q10 | Solution | 10 × 6 |

All eight persisted canonical table ASTs equal the approved source, including cells, spans, formatting and position. Each was opened in Admin and its editor/preview grid verified. No table was flattened or converted into fake questions. An unchanged Admin save of BIO 8 Q10 preserved the complete canonical payload.

The Student acceptance test exercised matching tables and the long BIO 8 Q10 solution table. Desktop displayed the six-column table readably. At 390 × 844 the wide table scrolled inside its container: approximately 843px content inside 309px, observed scrollLeft 40 after keyboard scrolling. The page itself did not overflow.

## F. Scientific fidelity

Complete source-to-persisted comparison preserved Greek symbols, inequalities, micro/angstrom units, formulas, Unicode subscripts/charges, superscript runs, isotope notation, equations, ratios and scientific units. All source structures retain canonical single_mcq semantics, including assertion/reason, matching-combination and multi-statement stems.

Representative Admin checks covered BIO 1 Q6 beta, BIO 4 Q5 Å, BIO 5 Q35 isotope superscripts, BIO 7 Q46 PaCO₂/HCO₃⁻, and BIO 8 Q30 Σ/√. Student attempt and review exercised these structures, BIO 5 Q28 powers, biochemical equations and long explanations. Superscripts remained raised in formatted previews; no replacement characters or observed notation loss occurred. Source formulas were preserved even where the client's expression is unconventional; none was rewritten.

## G. Source identity

BIO 6 / BIO 7 JSO SIR 19 collision risk: RESOLVED.

The SHA-256 identity hashes a structured tuple containing subject, BIO sub-head, exact filename, source file SHA-256, and source sequence. The deterministic database ID derives from that identity. All 714 identities are unique. The importer verifies the approved preflight hash, full parsed-record hash and every source DOCX hash before authoring, and refuses to overwrite an existing divergent payload.

The manifest records exact filename, source checksum, sequence, displayed number, batch and question ID. Admin source labels retain those traceability fields. Missing/malformed visible numbers at BIO 3 Q39, BIO 7 Q48 and BIO 8 Q57 remain absent; sequence identifies the record without inventing client text.

Raw PSC metadata was retained for BIO 8 Q20 (PSC), Q24 (PSC 063/23), and Q25 (PSC 174/23). No four-digit year or session was inferred.

## H. Duplicates

Two repeated-stem groups and 27 near-duplicate candidate pairs were preserved as separate source records. Repeated stems are BIO 2 Q32/Q40 and BIO 4 Q55/Q77; they are not duplicate importer identities. Import duplicates: 0.

## I. Database and authorization

Direct authenticated reads and read-only QA SQL verified all 713 persisted canonical payloads: text, rich AST, ordering, options, correct markers, explanations, positive/negative marks, taxonomy, source identity and metadata. Eight table structures and zero media records were confirmed for this import.

Biochemistry added 713 questions, 2,852 options and 713 answer keys. Global QA totals after import: 2,533 questions, 10,084 options, 2,540 answer keys and 244 media records. Existing QA fixtures account for totals beyond the three real subjects; global key count is not expected to equal question count because other canonical question types/fixtures exist.

Orphan options: 0. Orphan keys: 0. Duplicate source identities: 0. Malformed BIO taxonomy: 0. Drafts in the Active selection bank: 0. Quarantine exposed as a usable question: 0.

Normal password authentication verified the existing QA Admin's canonical active profile. No new Auth users, parallel roles, service-role authoring bypass, RLS changes or broader grants were introduced. Existing service Auth generateLink support was used only for older QA regression identities, without sending emails or granting authoring access.

## J. Idempotency

The complete deterministic importer ran twice. The second run compared all existing payloads and produced:

| Object | New on second run |
|---|---:|
| Subject | 0 |
| Sub-heads | 0 |
| Questions | 0 |
| Options | 0 |
| Answer keys | 0 |
| Table structures | 0 |
| Import identities | 0 |
| Media uploads | 0 |

713 questions were unchanged. Both run summaries and all 714 source dispositions are in `biochemistry-import-manifest.json`.

## K. End-to-end QA and cleanup

Admin Question Bank → Biochemistry → private QA test → existing QA Student attempt → server grading → result/review → history: PASS.

Only one disposable test was created: **QA ONLY — Biochemistry import acceptance**, ID `11ddb0d2-19ba-510d-9512-340c1160d2f6`. It contains 15 Active questions covering all eight BIO sections. Dedicated private program/batch eligibility used the existing QA Student, with a time-limited enrollment; no new Student or Teacher was created.

The browser attempt visited and answered all 15 questions. Refresh preserved the first answer and attempt state. Submission produced server score 5/15, five correct, ten incorrect, zero unanswered. Result summary, question cards, Your Answer, Correct Answer, marks, explanations and history reload passed. QA option choices were test inputs, not content corrections.

Desktop 1440px and mobile 390 × 844 passed. Mobile document width was 375px including the scrollbar allowance, below the 390px viewport. Formula text wrapped, tables scrolled internally, and the long explanation and review cards remained readable. Screenshots were inspected inline; no separate screenshot artifact is claimed.

Three submitted attempts were retained: two API acceptance runs and one browser run. The first harness run stopped at an outdated response-field assertion; the harness was corrected to inspect canonical persisted grading counts, and the complete 27-check run passed. No application change was needed.

Cleanup archived the single disposable test through canonical authoring. Both API and browser confirmed new attempts denied/Start disabled. All three submitted histories and historical review remain accessible. The real 708 Active/5 Draft bank, taxonomy and one quarantined payload were retained.

## L. Test Builder

The existing database-driven Subject list displayed Pathology, Microbiology and Biochemistry without frontend changes. Biochemistry offered All sections and BIO 1–8. Manual mode showed 708 Active available and 15 selected. Random mode scoped to BIO 6 showed 197 available. An authenticated generated-bank check selected exactly all 708 Active Biochemistry questions, excluding the five Drafts and quarantine. Temporary mode changes reused the one acceptance test; it was restored to its 15-question manual configuration before Student browser QA.

## M. Previous-subject regression

No Pathology or Microbiology reimport occurred. Complete persisted question/option/key/media hashes remained unchanged.

Authenticated Pathology history returned four submitted histories and a ten-question review; all four ordered Q190 media objects were signed and fetched successfully, including GIF. Authenticated Microbiology history returned three submitted histories and an eleven-question review, five native tables, one image-only stem, and fourteen successfully fetched media objects including EMF display derivatives. Source/parser regressions covered normal/rich text, ordered images, GIF, tables, EMF originals/derivatives and image-only content.

These older-subject checks used historical APIs, private media retrieval, persisted hashes and source tests; they were not new browser attempts on those subjects. The unchanged shared renderer was exercised in the Biochemistry browser flow.

## N. Technical gates

| Gate | Result |
|---|---|
| pnpm typecheck | PASS |
| pnpm lint | PASS; repeated after final script additions |
| pnpm test | PASS: 108 Vitest tests and 4 Node importer tests |
| pnpm build | PASS: Next.js 16.3.3 production build |
| Python parser/source suite | PASS: 22 tests, including all-source Biochemistry and prior-subject regressions |
| Biochemistry importer/source identity | PASS: seven new importer tests included above; all 714 identities checked |
| Table/rich-text/scientific notation | PASS: source tests, full persisted AST equality and browser checks |
| Direct database reconciliation | PASS: 14 checks |
| Idempotency | PASS: complete second run, zero new objects |
| Core security/transactional regression | PASS: 27 authenticated checks |
| Pathology and Microbiology | PASS: source tests, unchanged content hashes, historical review and private media retrieval |
| Desktop browser | PASS: 1440px |
| Mobile browser | PASS: 390 × 844 |
| Cleanup/history after archival | PASS |

Security checks include unenrolled/anonymous access denial, Student authoring denial, no pre-submission solutions or answer-key reads, invalid authoring rejection without mutations, forged grading denial, refresh persistence, concurrent idempotent submission, immutable submitted answers, cross-Student review denial and historical snapshot stability after an unchanged source resave.

## O. Git and environment

- Starting SHA: `5baafb97a22668bd7115dbf36636f4a5f7dda49a`.
- Branch: `codex/biochemistry-preflight`.
- Final SHA: the commit containing this report, reported in the completion message; no push.
- Eight new scripts: QA-only client, import model, importer, importer tests, DB verifier, acceptance setup, security verifier and cleanup.
- Eight evidence/report files: import manifest, quarantine payload, DB verification, security verification, prior-subject regression, cleanup verification, browser verification and this report.
- Application/renderer code changes: none. Existing unrelated untracked files and source DOCX files were left untouched.
- QA modified: YES, `xstssknlgdraulebdsfd` only.
- Production modified: NO; `dvmahmkapgtjfqmoottt` untouched.
- Migrations: NO. Auth users created: 0. Deployment: NO. Vercel changes: NO.

Evidence is in the adjacent `biochemistry-*.json` files. The source files and `.local-qa` parsed payloads remain local; the importer requires their approved hashes and the explicit QA project confirmation plus the existing QA fixture password supplied through the environment.

## P. Final status

YES — BIOCHEMISTRY COMPLETE IN QA, READY FOR PRODUCTION IMPORT

Production import remains a separate action and was not performed automatically.

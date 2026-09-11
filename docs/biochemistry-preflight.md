# Biochemistry source preflight

BIOCHEMISTRY PREFLIGHT — PASS

Local-only verification, 11 September 2026. All eight supplied DOCX files were fully parsed using the existing ALS parser without changing it. No import, upload, database connection, taxonomy write, application test creation, push or deployment occurred.

## A. Verdict

714 source occurrences reconcile to 708 structurally ready, 5 content review, 1 quarantine and 0 technical blockers. Review/quarantine records must be held back during a separately authorized import. This is structural and source-consistency acceptance, not scientific adjudication.

## B. Source mapping and integrity

Exact original filenames are retained. Counts use top-level question wrappers independently checked for Question/Type/Marks rows; no page-derived estimates. Every content cell was compared against canonical text and paragraph/table order. Word list bullets were resolved independently from numbering.xml. All source hashes remained unchanged across repeated runs.

| Sub-head | Title | Exact source filename |
|---|---|---|
| BIO 1 | Biochemistry of Major Biomolecules | app friendly format - JSO SIR 15 - Biochemistry of Major Biomolecules.docx |
| BIO 2 | Vitamins and Minerals, Hemoglobin | app friendly format - JSO SIR 16 - Vitamins and Minerals, Hemoglobin.docx |
| BIO 3 | Enzymology, Techniques and Instrumentation, Biostatistics | app friendly format - JSO SIR 17 - Enzymology, Techniques and Instrumentation, Biostatistics.docx |
| BIO 4 | Molecular Biology | app friendly format - JSO SIR 14 -Molecular Biology.docx |
| BIO 5 | Physical Chemistry, General Biochemistry | app friendly format - JSO SIR 18 - Physical Chemistry, General Biochemistry.docx |
| BIO 6 | Clinical Biochemistry | app friendly format - JSO SIR 19 - Clinical biochemistry.docx |
| BIO 7 | Diagnostic Biochemistry | app friendly format - JSO SIR 19 - Diagnostic Biochemistry.docx |
| BIO 8 | Hormones, QC, Toxicology | app friendly format - JSO SIR 20 - HORMONES,QC,TOXICOLOGY.docx |

| Sub-head | Bytes | Cached pages | Document relationships | SHA-256 |
|---|---:|---:|---:|---|
| BIO 1 | 38401 | 8 | 5 | `11b1423f0f4bb6ca9f63656ec3d63e00226b4b6c96383ffae7d3d6e1b17685d8` |
| BIO 2 | 47734 | 12 | 5 | `a07ea0df2229536fca082e76c5de88a243eeb96b89758cf9be126a36c489a79b` |
| BIO 3 | 45105 | 11 | 5 | `8c3c3fcd2a886d900a1cea2a617f3e254fd28936916e285c8f53aa7b499233b5` |
| BIO 4 | 164802 | 1 | 5 | `b9ae909c2faf3b63b38b2a9059359dc4fa5fea7084376d1e89afb9a41383f12a` |
| BIO 5 | 46671 | 11 | 5 | `9c14707ccd518786d7dbf87b0ab7bcdefd50a62d54facc0d157fb7989849ce08` |
| BIO 6 | 160894 | 47 | 6 | `585cf396c088a50c9c391711fb6ab1ed63ba80bebb0cb6f6194532de594f9101` |
| BIO 7 | 75919 | 20 | 6 | `e2eb10f49392bd1b915a5d834b220eb51ccc6a81f638ca69afd62924366e76d9` |
| BIO 8 | 63938 | 17 | 7 | `82e126f998ecd542fb5814f2b1611a1ecc21ef8bbfeeef67ce56f46b37407c26` |

Cached page counts come from docProps/app.xml, are not freshly paginated, and are unreliable (BIO 4 claims one page for 200 records). They played no part in reconciliation. Full relationship targets/types, XML part/tag inventories and source numbering evidence are in biochemistry-preflight.json.

## C. Reconciliation

| Sub-head | Source | Ready | Review | Quarantine | Technical Blockers | Images | Tables |
|---|---:|---:|---:|---:|---:|---:|---:|
| BIO 1 | 32 | 32 | 0 | 0 | 0 | 0 | 0 |
| BIO 2 | 46 | 46 | 0 | 0 | 0 | 0 | 0 |
| BIO 3 | 44 | 44 | 0 | 0 | 0 | 0 | 1 |
| BIO 4 | 200 | 200 | 0 | 0 | 0 | 0 | 0 |
| BIO 5 | 42 | 41 | 0 | 1 | 0 | 0 | 3 |
| BIO 6 | 202 | 197 | 5 | 0 | 0 | 0 | 1 |
| BIO 7 | 85 | 85 | 0 | 0 | 0 | 0 | 1 |
| BIO 8 | 63 | 63 | 0 | 0 | 0 | 0 | 2 |
| TOTAL | 714 | 708 | 5 | 1 | 0 | 0 | 8 |

Every row satisfies Source = Ready + Review + Quarantine + Technical Blockers. The 714 question wrapper tables are not counted as content tables; the package has 722 total native tables, including 8 actual content tables.

## D. Content anomalies

| Source occurrence | Marked option | Exact source discrepancy | Disposition |
|---|---|---|---|
| BIO 5 Q31 | None; all four Incorrect | Solution says `Correct Answer: C) Cytoplasm`. No answer was inferred or added. | Quarantine |
| BIO 6 Q73 | B | `Answer: B) Peritoneal fluid`; Peritoneal fluid is option A. | Review |
| BIO 6 Q77 | C | `Answer: C) Increased number of leukocytes (D is also correct)`; D is not marked Correct. | Review |
| BIO 6 Q135 | A | `Answer: A) < 9`; `< 9` is option D. | Review |
| BIO 6 Q172 | A | `Answer: A) Formation of thread over 2 cm long`; that text is option B. | Review |
| BIO 6 Q188 | A | `Answer: A) Sodium citrate`; Sodium citrate is option D. | Review |

Exact totals: 5 answer-conflict questions; 1 missing correct marker; 0 missing written answers; 0 cancelled/deleted/invalid records; 0 duplicate Correct markers; 0 unusable marks; 0 malformed option structures. Every question has four options and source type multiple_choice; all marks are positive 1, negative 0. All 714 solutions have an explicit answer claim. The six named-answer lines with explanatory parentheticals were inspected; Q77 is the additional-answer conflict. Others retain their source parentheticals without rewriting.

All 32 BIO 1 solutions spell the label “Correct Anaswer”. The audit recognizes this typo but leaves the source text unchanged; it is not a technical blocker. Client wording, units and scientifically questionable content were not corrected.

Numbering: BIO 3 Q39, BIO 7 Q48 and BIO 8 Q57 lack a displayed question number. Their source positions remain 39, 48 and 57. These account for visible-number gaps; no source records are missing. No repeated displayed numbers, malformed Question row labels or unexpected parser-created records were found.

## E. Media and drawings

Images: 0. PNG, JPEG/JPG, GIF, EMF, WMF, SVG, TIFF, BMP and other embedded media: all 0. Derivatives needed: 0. There are no image relationships, image-only stems, images in table cells, OLE/embedded Excel objects, SmartArt, charts, grouped meaningful drawings or text boxes. No source asset was skipped and no final media was uploaded.

The 714 w:pict elements are VML horizontal rules, one between each question, outside the question wrappers. Each contains only an empty rect with Office hr=t; these are decorative export separators, not question diagrams. The audit distinguishes them from meaningful drawings instead of classifying every w:pict as unsupported. Exact XML evidence is retained locally.

## F. Tables, order and analytical question types

| Source question | Location | Rows × columns | Merged cells | Nested content tables | Images |
|---|---|---:|---:|---:|---:|
| BIO 3 Q5 | question | 4 × 3 | 0 | 0 | 0 |
| BIO 5 Q13 | question | 5 × 2 | 0 | 0 | 0 |
| BIO 5 Q34 | question | 5 × 2 | 0 | 0 | 0 |
| BIO 5 Q42 | question | 5 × 2 | 0 | 0 | 0 |
| BIO 6 Q13 | question | 4 × 3 | 0 | 0 | 0 |
| BIO 7 Q47 | question | 5 × 2 | 0 | 0 | 0 |
| BIO 8 Q8 | solution | 5 × 6 | 0 | 0 | 0 |
| BIO 8 Q10 | solution | 10 × 6 | 0 | 0 | 0 |

All eight content tables preserve paragraph → table → paragraph order. Row text, XML hashes and rich-property counts are included per table in the JSON inventory. No merged or nested content tables occur in BIO; existing merged-table handling is covered by regression. Source table headers/cells and their bold formatting remain structured AST content.

| Sub-head | Single MCQ | Genuine multi-select | Assertion/reason | Matching-combination | Multi-statement combination | Table-containing | Image-only |
|---|---:|---:|---:|---:|---:|---:|---:|
| BIO 1 | 32 | 0 | 2 | 0 | 2 | 0 | 0 |
| BIO 2 | 46 | 0 | 5 | 1 | 0 | 0 | 0 |
| BIO 3 | 44 | 0 | 0 | 1 | 1 | 1 | 0 |
| BIO 4 | 200 | 0 | 0 | 0 | 0 | 0 | 0 |
| BIO 5 | 42 | 0 | 2 | 4 | 1 | 3 | 0 |
| BIO 6 | 202 | 0 | 5 | 1 | 1 | 1 | 0 |
| BIO 7 | 85 | 0 | 4 | 1 | 0 | 1 | 0 |
| BIO 8 | 63 | 0 | 0 | 0 | 3 | 2 | 0 |

Analytical categories overlap the canonical single_mcq count. Totals: 714 single MCQ structures, 0 genuine multi-select, 18 assertion/reason, 8 matching-combination, 8 multi-statement combination, 8 table-containing, 0 image-only, 0 table-only, 0 other unsupported structures. Matching questions remain normal MCQs with the supplied combination options. BIO 1 Q28 uses abbreviated A:/R: and is included in assertion/reason. The quarantined question is counted as a single-MCQ source structure, not a valid active record.

## G. Scientific and rich-text fidelity

All 4,284 stem/option/solution documents pass the existing canonical rich-text validator and reproduce parser text exactly. The independent XML comparison also verifies content order and source text, accounting for native bullet labels. JSON snapshot serialization preserves all eight tables. No canonical parser, renderer or validator was changed.

| Sub-head | Bold questions | Direct superscript questions | Direct subscript questions | Unicode superscript questions | Unicode subscript questions |
|---|---:|---:|---:|---:|---:|
| BIO 1 | 32 | 0 | 0 | 0 | 0 |
| BIO 2 | 46 | 0 | 0 | 0 | 0 |
| BIO 3 | 44 | 0 | 0 | 0 | 0 |
| BIO 4 | 200 | 0 | 0 | 1 | 0 |
| BIO 5 | 42 | 2 | 0 | 0 | 0 |
| BIO 6 | 202 | 1 | 0 | 0 | 0 |
| BIO 7 | 85 | 0 | 0 | 2 | 2 |
| BIO 8 | 63 | 0 | 0 | 1 | 0 |

13 direct superscript runs occur in three questions: BIO 5 Q28, BIO 5 Q35 and BIO 6 Q4. All are retained with superscript marks. Direct subscript, italic and underline runs: 0. Across direct formatting and Unicode there are 7 questions with superscript/subscript content. Unicode subscripts and charges in BIO 7 Q45–46 remain literal source characters.

Examples preserved: BIO 1 Q6 β-hydroxybutyrate; BIO 1 Q27 ≥ thresholds; BIO 4 Q4/Q11/Q16 molecular direction arrows and primes; BIO 4 Q5 Å; BIO 5 Q19 Henderson–Hasselbalch slash notation; BIO 5 Q24 π = iMRT; BIO 5 Q28 power notation; BIO 5 Q34/Q35 isotope labels; BIO 7 Q46 PaCO₂/HCO₃⁻; BIO 8 Q30 Σ/√/x̄; BIO 8 Q10 ± and up/down arrows. The source’s baseline/superscript choices and imperfect notation were preserved, not scientifically repaired.

OfficeMath/OMML nodes, equation OLE objects, structured fractions, matrix/root objects and equation images: 0. Existing text/rich-text represents the supplied inline formulas, slash fractions, square-root symbol and isotope notation. Formula candidates are BIO 3 Q31, BIO 5 Q19/Q24, BIO 6 Q38/Q73, BIO 7 Q46 and BIO 8 Q30 (Q38 is a clinical numerical expression, not an equation object). No structured math conversion is needed.

Style audit: the Strong character-style occurrences in BIO 2 Q25 explicitly set bold off; no missing inherited bold was inferred. Dark text colors are ordinary text presentation. Yellow highlights appear only on the export’s “Question” label, not its stem. The VML rules, export page breaks and wrapper formatting are not medical content.

Previous-paper markers: BIO 8 Q20 `( PSC)`, Q24 `(PSC 063/23)`, Q25 `(PSC 174/23)`. Counts BIO 1–7 = 0, BIO 8 = 3. Raw codes 063/23 and 174/23 are preserved; no four-digit year/session is invented. Older source_reference_candidates recognizes four-digit year codes only, so these raw PSC markers are explicitly carried in the preflight metadata and original text for the later subject import mapping.

## H. Duplicates

No records were removed. Zero exact normalized stem/options/key duplicate groups. Two exact normalized-stem groups have different options: BIO 2 Q32/Q40 (generic “Find out the false statement:” with different subject matter) and BIO 4 Q55/Q77 (“Cycloheximide inhibits”, reworded/reordered options). Neither implies an importer identity collision. No exact stem duplication across BIO sub-heads was found.

Near-duplicate detection removes leading displayed numbers, normalizes whitespace/case, then requires token Jaccard ≥0.70 and SequenceMatcher ≥0.85. These are wording candidates, not a claim of exhaustive semantic equivalence. All 27 pairs are retained for content review only, without changing their import classification.

| Pair | Similarity |
|---|---:|
| BIO 1 Q31 / BIO 2 Q13 | 0.9091 |
| BIO 1 Q31 / BIO 2 Q32 | 0.9259 |
| BIO 1 Q31 / BIO 2 Q40 | 0.9259 |
| BIO 2 Q13 / BIO 2 Q32 | 0.9831 |
| BIO 2 Q13 / BIO 2 Q40 | 0.9831 |
| BIO 4 Q53 / BIO 4 Q76 | 0.8667 |
| BIO 4 Q114 / BIO 4 Q117 | 0.8706 |
| BIO 4 Q114 / BIO 4 Q118 | 0.8736 |
| BIO 4 Q114 / BIO 4 Q154 | 0.8750 |
| BIO 4 Q114 / BIO 4 Q157 | 0.8608 |
| BIO 4 Q114 / BIO 4 Q191 | 0.8608 |
| BIO 4 Q117 / BIO 4 Q154 | 0.8889 |
| BIO 4 Q117 / BIO 4 Q157 | 0.9000 |
| BIO 4 Q117 / BIO 4 Q191 | 0.8500 |
| BIO 4 Q118 / BIO 4 Q157 | 0.8537 |
| BIO 4 Q118 / BIO 4 Q191 | 0.8537 |
| BIO 4 Q154 / BIO 4 Q157 | 0.9333 |
| BIO 4 Q154 / BIO 4 Q191 | 0.9067 |
| BIO 4 Q155 / BIO 4 Q156 | 0.9608 |
| BIO 4 Q157 / BIO 4 Q158 | 0.9136 |
| BIO 4 Q157 / BIO 4 Q191 | 0.9459 |
| BIO 4 Q174 / BIO 4 Q195 | 0.8654 |
| BIO 4 Q192 / BIO 4 Q194 | 0.9307 |
| BIO 4 Q192 / BIO 4 Q197 | 0.8519 |
| BIO 5 Q21 / BIO 6 Q44 | 0.8966 |
| BIO 6 Q44 / BIO 7 Q35 | 0.8916 |
| BIO 6 Q114 / BIO 7 Q35 | 0.8649 |

## I. BIO 6 / BIO 7 identity

PASS. The existing identity input is DOCX SHA-256 plus source sequence, not JSO number. BIO 6 and BIO 7 have different file hashes; every corresponding sequence therefore differs. The established deterministic UUID function was run locally over all 714 source keys: 714 distinct IDs, stable on rerun, and zero BIO 6/BIO 7 intersection. The preflight additionally records a hash of subject, BIO sub-head, exact filename, source hash and sequence. The original filenames remain unchanged. This proves collision-free identity inputs; a Biochemistry importer was not created or executed.

## J. Existing pipeline regression

Pathology: all 968 local source records rechecked, original payloads compared, rich text/superscripts, Q190 four-image ordering and GIF, original answer conflict and two missing keys preserved. Microbiology: all 797 boundaries, 24 tables, 116 media identities via existing importer tests, original/derivative relationship, all 11 EMFs, image-only MICRO 4 Q71 and source metadata passed. Existing table tests cover merged cells, reserved label text, interleaving and invalid structures. No re-import of either subject occurred.

## K. Technical gates

| Gate | Result |
|---|---|
| pnpm typecheck | PASS |
| pnpm lint | PASS; no warnings |
| pnpm test | PASS: 101 Vitest + 4 existing importer tests = 105 |
| Python unittest discovery | PASS: 22 tests (8 BIO + 14 existing parser/table/media regressions) |
| node --test scripts/biochemistry-identity-qa.mjs | PASS: 1 test, all 714 identities |
| Fresh EMF conversion regression | PASS: 11/11 original/display pairs, MIME, aspect, hashes, cache and fresh-render determinism; invalid source rejected |
| pnpm build | PASS |

Distinct named automated tests: 128 (105 + 22 + 1), plus the 11-asset EMF conversion verification. The eight BIO Python tests were rerun after analytical metadata refinements. An initial test discovery collision with the Node test filename was fixed by using the explicit identity-qa.mjs runner; final gates pass. No live database or browser acceptance was necessary for this read-only source batch.

## L. Git and environment

Starting SHA: c407c1ef77e1ff4acb478f24f696fe4490ed99cf. Branch: codex/biochemistry-preflight. The final commit SHA is provided in the completion message (this report is included in that commit). Nothing was pushed.

Changed files: scripts/biochemistry-preflight.py; scripts/test_biochemistry_preflight.py; scripts/biochemistry-identity-qa.mjs; src/lib/biochemistry-preflight.test.ts; docs/biochemistry-preflight.json; docs/biochemistry-preflight.md. All are new preflight/test/report files. The shared parser and application code are unchanged.

QA modified: NO. Production modified: NO. No environment configuration, migrations, taxonomy, auth users, question/media records, application tests or deployments were created or changed. Sources are unchanged. Unrelated pre-existing untracked files were left alone.

Local evidence: .local-qa/biochemistry-preflight-records.json contains every full candidate, option marking, rich AST, solution, source identity, classification and metadata. .local-qa/biochemistry-fidelity-evidence.json contains per-cell order/format evidence. .local-qa/biochemistry-drawing-evidence.json contains all decorative VML source XML. These local source artifacts are not uploaded or committed. The committed JSON report includes all source hashes, exact anomalies, table inventories and duplicate locations.

## M. Readiness

YES — BIOCHEMISTRY PREFLIGHT CLEAR, SAFE TO IMPORT

No Biochemistry import was performed. Any later import must retain the five review records as drafts and the one missing-marker record in quarantine.

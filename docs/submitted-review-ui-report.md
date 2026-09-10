# RESULT / ANSWER REVIEW UI — PASS

Date: 2026-09-10. Scope: Student submitted-result and answer-review presentation only.

The former narrow, small-text result document is now a centered 1024px review with a compact score summary, question index, separate question cards, icon/text outcomes, paired response areas, and dedicated explanations. Mobile responses stack, images keep intrinsic proportions without upscaling, and wide tables scroll within their own regions. Opening a result returns to the top; anchor targets clear the sticky header.

## Files and routes

- `src/components/student/core-test-engine.tsx`: mounts the review component; review-only width and arrival scrolling. Taking, saving and submission logic unchanged.
- `src/components/student/submitted-review.tsx`: summary, outcomes, responses, explanations and navigation.
- `src/components/student/submitted-review.module.css`: scoped review typography, spacing, media and tables.
- `src/components/student/review-types.ts`: existing review payload type extracted unchanged.
- `src/components/learning/question-gallery.tsx`: optional label suppression; existing callers retain default behavior.
- `src/components/student/submitted-review.test.tsx`: presentation/privacy/fidelity regressions.
- `scripts/submitted-review-browser-qa.mjs`: read-only historical browser checks and isolated local fixtures.
- `docs/submitted-review-browser-qa.json`: machine-readable browser results.
- `docs/submitted-review-ui-report.md`: this report.

Existing route affected: `/student/exams/[testSlug]`, after opening a submitted result. No routes added. Back links use `/student/exams`; summary, review and question links are page anchors.

Local test routes:

- `http://localhost:3007/student/exams/test-fa0e3cc8-c0f6-5648-bd85-7c5ec01d6d1a` — Pathology
- `http://localhost:3007/student/exams/test-1ac5a167-2333-5b63-a111-afdc41813025` — Microbiology

## Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `pnpm exec vitest run src` | PASS: 44 tests across 7 files |
| `node --test scripts/microbiology-import.test.mjs` | PASS: 4 tests |
| Desktop browser, 1440 × 1000 | PASS |
| Mobile browser, 390 × 844 | PASS |
| Console errors | None |
| Page-level horizontal overflow | None |
| Internal table scroll, image proportions/source order, anchor navigation | PASS |
| Scoped design detector | No findings |

The aggregate `pnpm test` command has a pre-existing runner mismatch: Vitest discovers `scripts/microbiology-import.test.mjs`, which uses `node:test`, and reports “No test suite found” after its four Node tests succeed. Both suites pass under their respective runners above. Test-runner configuration was kept outside this UI batch.

## Content and historical regression

At both sizes, the existing permitted Pathology snapshot renders all 10 questions and 4 images; the existing Microbiology snapshot renders all 11 questions, 14 images and 5 native tables. Entire question cards were captured and inspected, including long explanations, source bullets, rich emphasis and superscripts. Unit regression additionally verifies subscript, merged cells and text/table/media ordering.

MICRO 4 Q71 retains its empty source prompt and one stem image. The empty rich paragraph is not rendered as a text gap. The sequence is question header, original image, responses and explanation. Source alt text and neutral existing media fallbacks remain intact.

EMF display derivatives remain PNGs using the existing private media component. Original assets and their metadata are unchanged. The four-image PATHO 1 Q190 gallery, including its GIF, was checked using exact local source content and browser-only RPC/storage interception. Q190 remains a draft; no Student access or publication was granted. Correct, incorrect, unanswered and hidden-review states also use isolated browser fixtures, with no persisted test or attempt creation.

Source option labels are retained when they are part of the supplied option content. The review payload does not supply the original shuffled option-letter mapping, so the UI does not invent letters from array positions. No source explanation, medical wording, caption or answer key was rewritten. Empty explanation documents do not produce empty section headings.

Screenshots are local under `.local-qa/submitted-review/`, including desktop/mobile summary images and every question card. Card-only captures hide the surrounding sticky shell for inspection; viewport summary captures retain it.

## Security and scope

No review RPC, RLS, storage authorization, signing behavior or snapshot logic changed. Correct-answer displays and derived response counts use only the permitted review payload. Hidden scores and per-question marks remain hidden when results are disabled; no score is reconstructed from answer marks. Withheld answers or explanations produce no replacement content or new fetches. Private full-size links retain their existing expiring signed URLs.

No database migrations, application-data writes, imports, source-content edits, new tests in the database, deployments or production actions. Browser checks sign in only to existing approved QA accounts. Existing manual QA access is retained. Unrelated `MOQ/` and `docs/production-release-blocker.md` were excluded from this change.

Starting commit: `519b70fc4c3587e6cc3d80e38e6c5e4fe7073ba5` on `codex/microbiology-preflight`.

# ADMIN QUESTION BANK PERFORMANCE — PASS

The application fix is live on Production, SHA `0eeb79dab2e3feb5acae31330318ac07d692f4ad`. Starting Production SHA: `7b8a540ae8bd60e75588d39d5171769c0d18c815`; previous deployment: `dpl_C7P81b9cwDyBuGyTNbF8Vpc8QFg8`. Work branch: `codex/question-bank-performance`.

## Measured root cause

The old Admin route calls `loadCoreData`, which downloads every question, nested options and answer keys, full rich stem/explanation documents, and media metadata in five **sequential** 500-row requests. It also waits for tests, learning content, teacher-bank RPC and academic metadata before rendering controls. Search, filters, counts and pagination then run against the complete bank in the browser.

Normal authenticated Production Admin API measurement: **36,054 ms**, **2,472 questions**, **6,120,859 bytes** of decoded JSON. Individual batches: 6,748 / 6,468 / 8,043 / 6,548 / 5,634 ms. Options-only for 500 questions took 5,141 ms. These component probes are separate requests, not additive browser timings.

Continuously observed Chrome reload: shell **2,489 ms**, list and filters **30,891 ms**. The observation loop used one-second DOM samples. Timings include automation overhead. Existing in-memory interactions after the download: subject 184 ms, section 116 ms, status 108 ms, next page 1,212 ms, search 128 ms, detail 2,951 ms.

Browser control exposes DOM and console inspection but no Network/HAR or Performance trace. Attempted developer-tools access did not expose those panels; Performance API was unavailable in its read-only evaluation scope. Separate hydration time, browser request waterfall and duplicate-request counts are **not measured**. Do not describe the API decomposition as a browser network trace.

## Implemented change

- Admin-only list requests 25 rows with explicit lightweight columns; no options, keys, AST, explanation or media relation joins.
- Database filters: subject, dependent section, status, source, review flag and search. Search preserves stem/source/year/taxonomy and image-only fallback coverage. User punctuation is quoted; LIKE wildcards are escaped.
- Search debounce 300 ms; filter changes reset pagination. URL filters/page survive reload and browser Back.
- Exact HEAD count loads independently; next-page navigation reuses the count for unchanged filters. Errors remain distinct from empty results.
- The existing server-validated identity is reused; each database request still runs with the authenticated session and existing RLS. Academic metadata cache is keyed by user and expires after 60 seconds.
- Full canonical question detail is fetched only when opened. The existing editor/save RPC is retained. No content changes were submitted.
- Teacher Question Bank and other CoreManager modes remain on their existing path. Only the hierarchy helper is exported for reuse.

## Database evidence

Read-only authenticated-role `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` captured in `question-bank-query-plans-before.json`. Representative full joined 500-row query: **981.079 ms** database execution; 25-row thin query: **297.328 ms**. The former scans question_options repeatedly because its question_id lacks an index. Removing bulk options from initial load eliminates that repeated work; one-question detail measurements in QA are 213–242 ms including network.

Index migration required for this release: **NO**. No schema, functions, grants or RLS changes have been made. Existing exact count still scans authorized matching rows; it is asynchronous and does not block the list. Exact counts and offset depth remain database work that can grow with scale. Browser payload/memory/rendering stays bounded to 25 rows at 5,000 or 10,000 questions (tests include page 399). No synthetic rows were inserted for scale testing.

## QA Preview

Preview: https://alslearning-3brjzav3u-faziils-projects.vercel.app

Deployment `dpl_4iLmfh1jEvbz6ioFxBuJy7cSNY8S`: **READY**, Git SHA above, QA project `xstssknlgdraulebdsfd`. Production target remains `dvmahmkapgtjfqmoottt`. Preview environment URL checked from Vercel and QA storage host confirmed in rendered media.

Chrome first navigation: shell 2,693 ms, filters 3,503 ms, list/count 3,953 ms. Interactions: subject 581 ms, section 494 ms, status 458 ms, search 711 ms, next page 2,535 ms, first detail open 3,841 ms. These are actual automation wall-clock observations, not fabricated sub-second values. The 30-second wait is eliminated in this Preview; some operations remain above the engineering target.

QA API first page: 25 rows / **17,294 bytes**, 757 ms on the latest run. Complete measurements and assertions: `question-bank-api-qa-after.json`.

Desktop 1440: document width 1425; mobile 390 × 844: document width 375. Filters, compact rows and edit controls inspected visually; no page overflow. Mobile full-image links remain available.

Verified without saving:

- Pathology Q190: four ordered solution images all loaded, including GIF; correct option and original conflicting explanation retained.
- MICRO 4 Q71: text remains empty, source image loads, source alt text retained, list labels it Image-only question.
- Microbiology EMF: PNG derivative loads at 2830 × 867, source EMF/display PNG metadata visible.
- Microbiology native table: six rows rendered in editor and formatted preview.
- Biochemistry isotope superscripts, PaCO₂/HCO₃⁻, native matching table and sigma/square-root formula preserved in the lazy editor at mobile width.
- API checks preserve four options and answer-key relationships for all sampled records.
- Active counts 961 / 791 / 708 and Draft counts 5 / 2 / 5 match exactly.
- QA Student and anonymous list/detail requests denied. Admin succeeds. Teacher application path and database permissions unchanged.

Chrome reconnected on 2026-09-11. Remaining QA navigation checks completed: BIO 8 Q10 renders the complete 10 × 6 explanation table in both editor and preview, with no page overflow; existing Biochemistry test opens with 15 selections and 708 Active available questions; Recorded Classes displays its five existing records. Draft filters show Pathology 5, Microbiology 2 and Biochemistry 5. Empty search explicitly shows no matching questions; subject/status/search survive reload. Existing QA Student signs in normally and sees the portal and legitimate empty assessment list (its tests are archived); direct Admin Question Bank navigation redirects to Student Home. Anonymous access shows the Admin login form. No content or test was saved.

Fresh QA and Production content fingerprints are exactly equal to the before baseline after these checks. Production Admin session remains available. Production environment was read into an ignored local file and independently asserted to target dvmahmkapgtjfqmoottt.

## Local gates and content safety

`pnpm typecheck`: PASS. `pnpm lint`: PASS. `pnpm test`: **173 passed** (169 Vitest + 4 Node). `pnpm build`: PASS. Build includes all existing application routes.

QA has 2,533 total question rows including existing fixtures; Production has 2,472. Complete questions/options/answer keys/media/subjects/chapters fingerprints and quarantine manifest hashes are equal before/after QA. This covers text, explanations, rich tables, source identities and statuses. Questions changed 0; options 0; answers 0; explanations 0; media 0; tables 0.

No imports, taxonomy edits, new tests/users, Recorded Classes edits or database migration. CLI uploads failed; Git Preview deployment succeeded. The tested SHA was then fast-forwarded to main for a new Production build using Production environment variables; the QA Preview was not promoted.

## Production release and live verification

Deployment **dpl_GwDLLt5QKhrQoXRwqRzgfaw2HoTR**, **READY**, target **production**, SHA **0eeb79dab2e3feb5acae31330318ac07d692f4ad**, alias https://alslearning.vercel.app. Production Supabase **dvmahmkapgtjfqmoottt**; QA **xstssknlgdraulebdsfd**.

Normal signed-in Admin Chrome observations (wall clock including browser automation):

| Operation | Before ms | Production after ms |
|---|---:|---:|
| Useful shell | 2489 | 3026 |
| Academic filters ready | 30891 | 3916 |
| First list and exact count | 30891 | 4071 |
| Subject | 184 | 814 |
| Section | 116 | 619 |
| Status | 108 | 751 |
| Search | 128 | 930 |
| Next page | 1212 | 3476 |
| First detail open | 2951 | 3878 |

Before-filter actions operated on an already downloaded bank; after-filter actions query the server. Mobile next-page operation: 2031 ms. Browser Back restored the exact prior page and filters, but the automation call took **10058 ms**; this is not claimed as a fast Back result or isolated application rendering time. No browser network trace is available to separate control overhead. First-list latency is reduced about **87%**; the primary 30-second wait is eliminated. The ideal 2–3-second list and 1-second interaction targets are not universally met.

Authenticated Production API: first page 1336 ms / **25 rows / 17294 decoded JSON bytes**, next page 743 ms, exact HEAD count 831 ms, individual ordinary details 393–502 ms. Payload falls from **6120859 bytes / 2472 rows** to **17294 bytes / 25 rows** (about 99.7% smaller question-list payload; excludes separate small hierarchy/count responses and HTTP compression). See `question-bank-api-production-after.json`.

Live subject filters, dependent sections, all three Draft counts, active Biochemistry count, search, pagination and lazy detail verified. MICRO 4 Q71 remains text-empty and displays its original 200 × 133 image after expanding its existing preview; signed image host is Production Supabase. No save action performed.

Desktop 1440 and mobile 390 × 844: **PASS**, visually inspected; document widths 1425 and 375 respectively, no horizontal page overflow. Mobile pagination and edit preview work. Viewport restored afterward.

## Final content and authorization checks

`question-bank-content-after-production.json` is deeply equal to `question-bank-content-before.json` for both projects, including full canonical content and quarantine manifests. Production remains Pathology **966 (961 Active / 5 Draft)**, Microbiology **793 (791 / 2)**, Biochemistry **713 (708 / 5)**, total **2472**.

Questions changed: **0**. Options: **0**. Answers: **0**. Explanations: **0**. Media: **0**. Tables: **0**. Source identities/statuses: **0**.

Policy/function/role-grant/RLS inventory hashes exactly match the original baseline in both projects (`question-bank-security-after.json`). QA has 75 policies / 47 functions; Production 75 / 46. Admin normal list/detail succeeds; Student and anonymous list/detail API checks deny access, browser Student redirects away and anonymous sees login; Teacher code path and authorization inventory are unchanged. No new endpoint, service-role bypass, grant or policy introduced. The fingerprint script hashes the entire query result, matching the original baseline serialization.

Regression: existing question editor and canonical detail **PASS** (read-only inspection, no content saved); Test Builder **PASS**; Recorded Classes **PASS**; Student portal **PASS** (existing fixture has no currently active tests); Auth **PASS**. This batch did not create or submit Student attempts.

YES — ADMIN QUESTION BANK PERFORMANCE FIXED

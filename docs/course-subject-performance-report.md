# STUDENT COURSE SUBJECT SWITCH PERFORMANCE — PASS

## Root cause and baseline

The subject links performed Next Server Component navigation with prefetch disabled. Every selection repeated `getStudentCourse`: enrollment, program/subject mapping, three separate recording COUNT requests, selected-subject recording metadata and study resources. `courseAccess` only cached within a server request, so it did not reuse data between clicks. Student profile authorization was also repeated. Chapter names were joined into the recording request, not loaded separately.

Live baseline browser-control wall-clock readings: Biochemistry → Microbiology **3377ms**, Microbiology → Pathology **3012ms**, Pathology → Biochemistry **3538ms**. These include automation overhead. Chrome control exposed no network tracing capability, so a complete live baseline wire-request total is unavailable. Code inspection establishes **7 course data queries** per navigation (1 enrollment, 1 mapping, 4 recorded_classes including three counts, 1 learning_content), plus authorization profile resolution. There is one subject-route navigation; no server action. Thumbnail request counts depend on browser cache. No separate topic/chapter query or Question Bank query exists. These query counts are code-derived, not represented as a captured live HAR.

## Fix

The server still validates the Student and active program before returning anything. It loads all lightweight Published recordings and active study-resource metadata for the program's mapped subject IDs using explicit `in(subject_id, ...)` filters and the existing session/RLS. One recording query replaces four; counts derive from the returned rows. No privileged client, RLS change or global/shared cache was added.

The client retains that authorized payload for the page session. Subject filtering is synchronous. Native `history.replaceState` updates URL selection and Next `useSearchParams` without router navigation, refresh, server actions, or refetching authentication/enrollment/content. Modified clicks retain ordinary link behavior. Reloading a URL still validates access on the server. Thumbnail images remain lazy, with fixed placeholders, and do not gate content rendering. Player implementation is unchanged.

## Measured after performance

The optimized application build was measured in a separate headless Chrome against QA at localhost:3018. A click-capture listener and MutationObserver measured time until the selected pill and matching content were committed to the DOM. This excludes browser-control transport/settling overhead and is **not a claim of physical display paint timing or a live Production trace**. The identical application commit was visually checked in QA Preview and subsequently Production.

| Transition | 390 × 844 | 1440px |
|---|---:|---:|
| Biochemistry → Microbiology | 3.4ms | 5.3ms |
| Microbiology → Pathology | 2.8ms | 2.3ms |
| Pathology → Biochemistry | 2.3ms | 2.9ms |
| Biochemistry → Microbiology again | 6.6ms | 3.1ms |
| Microbiology → Biochemistry again | 1.7ms | 2.5ms |

Every switch is below 200ms. Captured requests during five switches at each viewport: **0 application route/data requests, 0 Supabase requests, 0 Question Bank requests**. There were 3 lazy thumbnail request events and 5 browser favicon request events. Therefore total network events are not claimed to be zero. Revisited recording text is immediately available, and thumbnail loading does not block it. No player iframe appears on Courses.

Initial optimized QA Courses useful render: **1341ms**. Initial HTML response including embedded component payload: **34,236 uncompressed bytes**; this excludes separate JS/CSS/image assets and is not compressed transfer size. The earlier QA Preview useful render was 3508ms including automation overhead, so these are not directly comparable measurements. The loader now needs four course-data requests initially rather than seven, and adds only three small recording records to its payload.

## Security and regression

- Actual QA and Production counts: Biochemistry 1, Microbiology 2, Pathology 1. Draft Hemostasis excluded.
- Expired enrollment is rejected before fetching subjects/content in server tests. Invalid subject selection cannot expand the mapped scope. Existing Published filters and RLS remain authoritative before delivery to the browser.
- QA Preview and Production normal Student sessions work. No new accounts or enrollment mutations.
- QA Courses → canonical player, Previous recording and Next recording verified. Existing YouTube embed initializes. Playback implementation unchanged; live playback passed in the immediately preceding batch.
- Dashboard still shows four authorized recordings. Classes and bottom navigation unchanged; the preceding live regression remains applicable. No test or results code changed.
- Mobile and desktop screenshots inspected: PASS. Repeated selection, selected/content matching, no whole-page blank state, zero Courses iframes, and no horizontal overflow verified. Live Production mobile repeated switches and desktop selection verified.
- Database and security fingerprints exactly match the prior baseline in both QA and Production: questions, options, answers, media, recordings, enrollments, program mappings, resources and policy/function inventory. No database writes or migrations.

## Automated gates

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm test`: **194 PASS** (190 Vitest + 4 Node).
- `pnpm build`: PASS.
- Browser performance assertions: PASS at both viewports. The reusable harness is `scripts/course-subject-performance-qa.mjs`, requiring the existing QA fixture file and `PLAYWRIGHT_MODULE` pointing to the installed Playwright index.mjs. It uses an ordinary QA Student password sign-in and does not create users or content.
- Raw evidence: `course-subject-performance-browser.json` and `student-courses-data-after-subject-performance.json`.

## Deployment

Starting Production application: `48bcebcfbddc2110e078dd4e46fcbe4c28e43e97`.
Starting local documentation HEAD: `0d069bb5821822ce32c852c7722c1d35fed74956`.
Final deployed application: `57f7de07f4b1cd37897e0d5e07debcf06d4feb06`.
Branch: `codex/course-subject-performance`.

QA Preview: https://alslearning-2a5a71flo-faziils-projects.vercel.app — `dpl_ARDLcysgCb8B233uiuTfd2wYEHwR`, READY, QA `xstssknlgdraulebdsfd`.

Production: https://alslearning.vercel.app — `dpl_HZCgrbVkNSi2iWXzfiUSbdGX3rX3`, READY, target `dvmahmkapgtjfqmoottt`. Main was fast-forwarded only after QA performance/browser checks passed. Production was rebuilt using its own environment, not aliased to the QA build.

YES — COURSE SUBJECT SWITCHING IS NOW INSTANT

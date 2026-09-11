# Student Courses and Dashboard mobile UX — live acceptance pending

## Root cause and change

The former program detail page called `getCourseDetail`, which read only `learning_content` and ignored `recorded_classes`. Its subject pills were static spans. The false empty state came from checking only the empty learning-content array. The Courses index also downloaded the full shared dashboard payload just to list enrollments.

Courses now uses a dedicated request-local, Student-authenticated loader: active enrollment/program, mapped subjects, exact Published recording counts, selected-subject lightweight recording metadata and active study resources. Only an enrolled program can be opened. Subject links preserve selection in the URL, filter database reads, and do not fetch the Dashboard or Question Bank. Single-program students see the subject hub directly at `/student/courses`; existing program URLs work too. Multi-program students retain a program chooser.

Cards reuse `RecordingThumbnail` and link to `/student/recorded-classes/{id}`. No duplicate player or database record exists. No iframe loads on the Courses list. Topic labels and optional subtopic remain visible. A generic empty state appears only when both selected-subject recordings and resources are empty. Query errors render a retry state instead of false zero content.

## Data and security

Direct before/after QA and Production database checks confirm:

| Subject | Published recordings |
|---|---:|
| Pathology | 1 |
| Microbiology | 2 |
| Biochemistry | 1 |
| Total | 4 |

Carbohydrates II, Donor selection, Influenza Parainfluenza Mumps RSV and Trematodes I appear in the QA subject hub. Hemostasis remains Draft and is excluded from counts and lists. Its direct QA Student URL displays “Recording unavailable.”

Queries retain the normal Student session and existing RLS. Expired/future/cancelled enrollment cases are tested; arbitrary requested subjects cannot expand the mapped subject scope. No RLS changes, migrations, enrollment changes, imports, question edits or recording data changes. Full hashes of questions/options/answers/media/recordings/enrollments/program mappings/learning content and policy/function inventory match the before baseline in both projects. Evidence: `student-courses-data-before.json`, `student-courses-data-after-qa.json`, `student-courses-data-after-production.json`.

## Mobile and desktop

The program summary retains Enrolled program, name and access expiry in a **104 px** mobile block, removing the old placeholder paragraph.

The dashboard previously supported three metrics. One inexpensive authorized HEAD count adds Recorded classes, yielding **four real metrics**, not six invented numbers. Mobile is **two columns × two rows**, with **12 px gaps**, **22 px icons**, **24 px numbers**, and measured **173 × 111 px** tiles at 390 × 844. Two of the requested six potential slots are intentionally absent. At 1440 px the four metrics occupy one row, approximately **269 × 119 px** per tile. Loading skeletons follow the same compact layout.

390 × 844: **QA PASS**. 1440 px: **QA PASS**. Actual screenshots inspected. Page scroll width equals viewport width, subject pills scroll inside their own row, and bottom navigation remains clear and unchanged. The viewport override was reset after QA.

## Performance

QA Preview browser wall-clock measurements including automation overhead:

| Operation | Time |
|---|---:|
| Dashboard useful content | 2942 ms |
| Courses useful content | 3508 ms |
| Subject switch to Pathology | 5068 ms |

The subject-switch figure includes the browser locator wait and is not an isolated database or rendering measurement. Production timings remain pending the real Student login. No browser network/hydration trace is claimed. Courses Question Bank calls are **0 by loader inspection and instrumented regression tests**; no questions/test-question/attempt-history query exists in its loader.

## Regression and gates

- Dashboard, Courses: QA visual/data PASS.
- Classes: existing Live Classes screen renders its legitimate empty scheduled-session state.
- Canonical recording player: Courses link opens Donor selection; YouTube playback advanced to 15 seconds.
- Exams and Progress/history: existing QA fixture has no tests/attempts; both pages render correct empty states. Existing submitted-review automated tests pass. Live Production results/history still need the real Student session.
- Auth: existing QA Student password authentication, authenticated navigation and logout work; no new accounts or password changes. Direct Draft access denied.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS. Generated `.local-qa` artifacts now excluded from lint; application source remains checked.
- `pnpm test`: **193 passed** (189 Vitest + 4 Node), including 20 new tests.
- `pnpm build`: PASS.
- Impeccable detector: no findings.

## Deployment

Starting Production SHA: `0eeb79dab2e3feb5acae31330318ac07d692f4ad`.

Application SHA: `48bcebcfbddc2110e078dd4e46fcbe4c28e43e97`.

Branch: `codex/student-courses-mobile`.

QA Preview: https://alslearning-j4q867w3f-faziils-projects.vercel.app — `dpl_3xthyBtQq2jQY2uZkBDfzPme7KyG`, READY, QA `xstssknlgdraulebdsfd`.

Production build: `dpl_D1oNFLaUWXwKCZBhNZ1kpD3b4mnQ`, **READY**, alias https://alslearning.vercel.app, Production target `dvmahmkapgtjfqmoottt`, triggered by fast-forwarding main only after QA passed. Built with Production environment; QA Preview was not aliased to Production.

Final live acceptance is pending normal sign-in as the existing Production Student. The Chrome login tab is open with the email prefilled; no password was requested in chat or invented.

# ALS manual-test staging release — 1 October 2026

## Later credential-only checkpoint

**Final superseding checkpoint:** [Cloudflare containment](ALS-CLOUDFLARE-CONTAINMENT-2026-10-01.md) and [Step 2 unattended shutdown](ALS-STAGING-STEP2-SHUTDOWN-2026-10-01.md) both passed. Exact old SFU/TURN resources are deleted and reject old authority with HTTP 404. Current accepted-source configuration deployment is **`01a0f778-4b3f-71fb-8713-f555234cb137`**, Completed, all media flags false, cron paused. Actual microphone publication was proven on the replacement app, browser abandoned, scheduled run/request 45 reconciled the explicitly expired provider resource and closed stale DB state, and 46 completed the class. Zero active media, unchanged healthy fixture, all 22 academic checks pass, exact Student expiry/results/watch history preserved. No R2/Supabase credential change, Production action or application-source edit. Earlier checkpoints below remain historical.

The subsequent [Cloudflare replacement checkpoint](ALS-CLOUDFLARE-CONTAINMENT-2026-10-01.md) supersedes the deployment ID below: current accepted source is running configuration-only Hostinger deployment `01a0f728-aa16-71a3-bf3c-1f80f55d6708`, with verified replacement staging SFU/TURN references. All 25 saved hosted values match; R2/Supabase/expiry are unchanged and all media flags remain false. Academic checks and three genuine role sign-ins pass. Exact old-resource deletion awaits the browser policy's action-time confirmation; Step 2 is prepared but not yet executed. The resources remain intact until that confirmation.

The separately approved [1 October Step 1 credential report](ALS-STAGING-CREDENTIALS-STEP1-2026-10-01.md) records the R2 replacement, subsequent staging Supabase key replacement/revocation, and current configuration-only redeploy `01a0f6f4-ce72-706a-8c2b-7c125a8d11dd` (Completed / Current, 14:16 Dubai), using this same application source/ZIP. The exposed Supabase key now returns HTTP 401; its replacement and protected hosted cleanup read pass. Academic expiry and data were preserved; live/replay remain blocked. The release observations below are the earlier academic handoff history.

## Deployment

- Protected site: https://darkgreen-camel-484366.hostingersite.com/
- Application source: `a267b969b6c6e355d183db585f3dac9a9f8d0c07` (local commit; no push/merge).
- Final ZIP SHA-256: `2a104e65e331be9a44318ce7ba685fddc740210fa7d87f4f16be22a426629979`.
- Hostinger deployment: `01a0f664-630a-7332-b9ba-a81d95a13d55`, current/completed at 11:39 Dubai on 1 October; installation audit zero vulnerabilities, npm install, npm run build, Node 22, Next.js 16.3.8, standalone startup.
- First academic candidate: source `646acedb94694eb1f639009a0d5e2985ad467809`, ZIP `9f8677db61cadb67affab2b867726cf38980b880f9fe3a27d88213cd82dc2115`, deployment `01a0f63a-9e35-7136-ae81-81a5912321cf`. Replaced by patched final candidate.
- The first Hostinger installation surfaced GHSA-vcvr-r3jv-pc5j. No `next/og`/`ImageResponse` use exists in ALS source, so the documented vulnerable path was not found. Patched Next and its ESLint config to 16.3.8; clean npm install and npm ci reported zero vulnerabilities. [Maintainer advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j).

## Implemented changes

- Removed redundant Student portal/route header labels and duplicate nested Logout rendering. Desktop Teacher uses sidebar Logout; mobile menus carry one account action; standalone Teacher classroom and lesson player have aligned actions.
- Student dashboard uses distinct eligible programs, eligible future scheduled classes, distinct submitted tests, separate in-progress Resume, startable unsubmitted tests, latest score-visible earned/possible marks, real native playback intervals and weekly activity.
- Watch tracking counts advancing native playback while visible/focused, batches 15-second intervals, rejects seeks/stalls/paused time, authorizes content in SQL, bounds deltas, deduplicates retries and deducts overlapping tabs. Resume position and completion remain separate; no new video checkpoints/completion threshold.
- Teacher dashboard/courses/materials/assessments show scoped data; Students distinguishes separate program enrollment rows and effective profile/enrollment/program/batch access, supports search/pagination and Dubai expiry display.
- Question Bank differentiates loading/error/no assignment/no permission/ready, permits an empty new draft to open, supports canonical preview/save, nonrestrictive defaults, Clear filters and exact saved question discovery. Author and transactional options/key remain server-owned.
- Classroom removes presentation selector and public motion/POC controls, uses clear scheduled/completed/unavailable states, optional camera, share/stop, mic on/muted, leave/end actions and collapsed diagnostics. Native chooser starts in the actual click gesture. Device failures have retry guidance; decoded frame status distinguishes reception from local preview. Recording requires Teacher screen plus mic, excludes remote Student tracks, and preserves existing private storage/review path.
- Cleanup reads retry only the exact transient PGRST303/JWT-issued-in-future failure (bounded 500/1500 ms delays). Writes and provider actions are not retried. Historical incident remains documented as an inferred gateway-token timing issue, not proven host clock skew or a verified root-cause cure.

## Database and persistent fixtures

Verified only Supabase `als-live-staging` / `slghshcdaijbcjfoqerq`, organization `oenarbsvxrmnsvugjdrz`. Secure snapshot retained: 46 public tables and existing migration history, taken before changes at 06:02 UTC; not represented as a complete Auth/private-schema dump. Prior application ZIP retained.

Preserved accepted 43 migrations including `20260928075559` and the five-FK batch deletion safeguard. Applied only three forward migrations after rollback-only local acceptance:

1. `20261001060000_engaged_playback_watch_intervals` — idempotency, overlap, bounded delta and Teacher denial PASS.
2. `20261001063000_student_catalog_visible_scores` — hidden-score catalog/history denial PASS.
3. `20261001070000_teacher_roster_effective_access` — sixteen access cases, search, pagination, unassigned Teacher isolation and Student denial PASS.

Management API generated its own migration version timestamps; names identify these new migrations. No reset, production copy, question bank reimport or accepted migration replay.

Pack `als-manual-demo-v1`: two populated programs, three mapped subjects/chapters/topics, six private materials (five active/one draft), eighteen synthetic questions (fifteen active/three draft), five assessment states (four active/one draft), three academic classes (two scheduled/one historical completed), four additional synthetic identities. Genuine Admin/Teacher and both primary Students reused. The extra roster is in Diagnostic Foundations; max-two classroom batch remains for primary Students. At handoff, the two designated scheduled classes were explicitly moved to 2 and 3 October, 08:00–08:10 UTC (12:00–12:10 Dubai); they remain scheduled and media-blocked, with no provider operation. This was a separately audited one-time update, not a seed reset. PDF is a readable one-page synthetic guide, image renders and 45-second native video is genuinely playable. Existing CRE enrollment is preserved, with no invented curriculum.

Student 1 synthetic seeded result: canonical submission `36339b58-64e7-40cc-8f12-8ebc76bf6ba1`, 6/6; this is demo history, not observed human viewing. Twenty-two authenticated backend fixture/security checks passed. Rerun before hosted authoring: 68 skipped, zero created/updated. Final preservation rerun: 68 skipped, zero created/updated. Exact edited draft hash, new Teacher question, submitted attempt hash and 44.013 seconds of actual watch time were unchanged after rerun (authenticated acceptance readback at 07:14 UTC).

## Hosted acceptance

- Primary Student 1 Chrome session: populated dashboard; 3 active programs including separate unconfigured CRE, initially 1/4 tests and 6/6 visible marks; private PDF rendered; native video played 45 seconds and persisted 44.013 seconds. Refreshed dashboard showed Under 1 min and real weekly activity.
- Teacher Chrome session: Add draft -> preview -> save -> refresh -> exact reopen -> edit -> activate -> select in canonical assessment -> save bounded one-question test PASS.
- New question title: `Synthetic hosted acceptance (edited): Which check comes before sample processing?`.
- New test `3b5f2e11-2230-4195-8be5-c5ea03855ed5`: Synthetic Hosted Teacher Authoring Acceptance. Student 1 actual hosted answer/submission -> server result 1/1, 100%, persisted history PASS. It is separate from the seeded graded result and remains synthetic acceptance data.
- Teacher roster: seven scoped enrollment rows; expired fixture clearly expired; both primary Students active in two independent demo programs. Search Student 2 returns two rows PASS.
- Student 2 hosted dashboard: 2 eligible programs, 0/5 submitted tests, 3 startable tests, no invented watch/result history. Private colour diagram actually rendered through the course/lesson route.
- Student/Teacher/Admin 390px viewport layouts visually inspected; no page-level overflow. Teacher Add question opened with Enter; Tab reached the form. Browser viewport checks are not physical phone acceptance or a complete accessibility audit.
- One Logout in desktop/mobile role screens and completed standalone classroom. Each role signed out to login; protected role routes redirected to login. Teacher Back plus reload remained at login.
- Paused native Home/End seek changed resume position without increasing elapsed watch time. Student 1 dashboard after real submission: 2/5 completed, 1 startable pending, 7/7 visible marks, Under 1 min actual watch time.
- Admin enrollment rows distinguish stored enrollment status from Access expired/Access until and show exact date/time in Asia/Dubai. Separate Program save guidance remains intact.

## Academic and media availability

Primary academic window: **2026-10-01T07:40:22.181Z through 2026-10-08T07:40:22.181Z**, exactly seven days. Dubai expiry: **8 October 2026, 11:40:22.181 (UTC+04:00)**. Five existing active primary enrollment rows were renewed explicitly; separate Program rows and negative cases were retained. Original enrollment IDs are preserved. Explicit renewal command and protected local policy are documented in the manual guide; routine cleanup scripts no longer restore the primary accounts to expired 29 September rows. Separate expired/unenrolled/unassigned negatives remain denied.

**No media manual window has been opened.** Current conservative credential guard is `2026-10-01T00:00:00Z`; Cloudflare shows expiry date 1 October without an exact hour. Owner explicitly chose to keep affected tests blocked and declined renewal. Final staging readback: 46 migrations, zero live classes, zero open media connections and zero active capture/upload segments. Media/recording flags remain off; cleanup cron remains paused; new provider sessions/uploads were not created. Actual unattended closure of established SFU tracks remains unverified. Seven-day academic access does not imply media availability.

Historical recording registry is imported into staging ownership, `validating`, unpublished. It retains genuine historical object/segment references and validation provenance; no new upload/review/publication/Student replay is claimed. Fresh Worker digest, Admin playback review/publication, short hosted recording, signed-link renewal and received screen-frame acceptance are BLOCKED. Prior owner audio/text confirmation is retained separately and is not new hosted capture acceptance. Physical phone/OS permission acceptance NOT RUN.

## Checks and scope

- Actual npm 10.9.3: clean install / npm ci, lint, typecheck, full applicable tests and production build PASS on patched candidate.
- Vitest: 50 files / 295 tests PASS, 3 fixture-gated suites / 13 tests SKIPPED (Biochemistry, Pathology, native table source fixtures absent). No fake fixture or import was introduced.
- Original Microbiology fixture SHA-256 `a1a1ee4e1fb7faa896aa04285b90aee3111e657c582a87bb85c4442eff078a50`; all four import tests PASS; no database import.
- Allowlisted ZIP includes app source, npm lock, required public assets and build inputs; excludes .env, secrets, local QA, node_modules, recordings and unrelated design exports. Source/diff/private-file scan PASS; final ZIP: 1,306,050 bytes, no secret-pattern or denied-entry match.
- Production ALS and the cleaning site were not modified or enabled. No purchases/new providers, Git push/force-push/main merge, database reset or long capture.

## Readiness

- HOSTED UI AND DEMO DATA: READY for academic testing; media-dependent journeys remain separately blocked.
- TEACHER QUESTION AUTHORING: READY; actual hosted creation/edit/use/server grading PASS.
- OWNER MANUAL LIVE TESTING: BLOCKED by credential guard and unverified unattended closure.
- RECORDING AND REPLAY: BLOCKED; historical fixture remains validating/unpublished.
- PHYSICAL DEVICE VERIFICATION: NOT RUN.
- PRODUCTION RELEASE: NOT ENABLED.

## Output-handling incident

During this session a Hostinger form snapshot included secret field values, and a browser PDF tab title included a signed link in tool output. This was disclosed to the owner. Subsequent snapshots were sanitized; values were excluded from screenshots, these reports, Git and the deployment ZIP. No credential was renewed or replaced. Any credential response requires separate owner review/authorization; this report does not claim the earlier tool output was secret-free.

## Hosted screenshots

These show synthetic staging accounts and omit secret fields and signed URLs.

- [Student desktop](evidence/als-manual-20261001/student-desktop.png)
- [Student 390px](evidence/als-manual-20261001/student-mobile.png)
- [Student private image](evidence/als-manual-20261001/student-image.png)
- [Teacher roster with renewed expiry](evidence/als-manual-20261001/teacher-roster-desktop.png)
- [Teacher Question Bank](evidence/als-manual-20261001/teacher-question-bank-desktop.png)
- [Teacher keyboard editor at 390px](evidence/als-manual-20261001/teacher-question-mobile.png)
- [Admin enrollments desktop](evidence/als-manual-20261001/admin-enrollments-desktop.png)
- [Admin enrollments at 390px](evidence/als-manual-20261001/admin-enrollments-mobile.png)
- [Expired access at 390px](evidence/als-manual-20261001/admin-expired-mobile.png)
- [Completed classroom](evidence/als-manual-20261001/classroom-completed.png)

See [ALS-MANUAL-TEST-GUIDE.md](ALS-MANUAL-TEST-GUIDE.md) for click-by-click journeys and secure credential access.

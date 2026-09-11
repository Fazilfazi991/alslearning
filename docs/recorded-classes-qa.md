# Recorded Classes QA — 11 September 2026

RECORDED CLASSES QA — PASS

## Architecture and taxonomy

`public.recorded_classes` stores on-demand recordings, with `subject_id → subjects.id` and `chapter_id → chapters.id`. ALS uses `chapters` for canonical academic sections. The existing `topics` table is a lower hierarchy level and was not repurposed. `topic_label` preserves the client's display name; nullable `subtopic` supplies the optional video-only grouping. No Subjects, Chapters or Topics were created or renamed for the import.

The existing `learning_content` model is program-specific and includes learning-progress/checkpoint relationships. The new subject-level library does not change those workflows. `class_recordings` remains exclusively attached to Live Classes. Exact watch-percentage tracking was not introduced.

Provider fields are generic (`provider`, `provider_video_id`); only YouTube is implemented. Original inputs are kept in `private.recorded_class_sources`, accessible only to Admins. Student `select *` cannot return Studio URLs. Preview and playback use canonical IDs and `youtube-nocookie.com` with the YouTube IFrame API for errors and readiness.

| Client Topic | Existing canonical Chapter | Mapping rationale |
|---|---|---|
| Biochemistry of Major Biomolecules | BIO 1 — Biochemistry of Major Biomolecules | Same name with canonical prefix |
| Clinical Haematology | PATHO 1 - Haemopoiesis, Anaemia, Leukemia, Hemostasis | This specific Hemostasis recording maps to the section explicitly containing Hemostasis; not a blanket mapping of all clinical haematology |
| Blood Banking and Transfusion Medicine | PATHO 6 - Blood Banking | Recording concerns donor selection/blood banking |
| Virology | MICRO 5 - Virology | Same name with canonical prefix |
| Parasitology | MICRO 4 - Parasitology | Same name with canonical prefix |

CARBOHYDRATES remains recording metadata, not a new Question Bank node.

## Admin

`/admin/recorded-classes`: compact paginated list, Subject/Topic/status filters, title search, create/edit, preview and archive. Forms scope Topics dynamically and reset Topic selection when Subject changes. Subject/topic consistency is also enforced in PostgreSQL. Drafts may omit links; Published recordings require a structurally valid ID. Missing-link records display “Video link pending.”

The UI and idempotent client import both use the atomic `save_recorded_class` RPC. Existing records are preserved on repeated imports using unique `import_key` values. Only Admins can author this subject-wide library. Existing Teacher content permissions are program/assignment scoped; they were not extended to this broader subject-wide publication scope. Optional Teacher attribution is supported without granting authoring rights.

## Student

My Courses links to Recorded Classes. The library derives Subjects from authorized published rows, groups them by Topic and optional Sub-topic, and displays compact thumbnails and duration when available. Empty groups are omitted. Each recording has a focused player, breadcrumb, description when present, and ordered Previous/Next within its Subject.

Loading, no-content, invalid/deleted/inaccessible recording, expired access, thumbnail failure, player failure and network retry states are covered. Direct Draft URLs return the same safe unavailable message as inaccessible/deleted recordings.

## Client content

| Subject | Topic | Sub-topic | Title | Video ID | Status |
|---|---|---|---|---|---|
| Biochemistry | Biochemistry of Major Biomolecules | CARBOHYDRATES | Carbohydrates II | xNBduyugQSc | Published |
| Pathology | Clinical Haematology | — | Hemostasis | — | Draft / Link pending |
| Pathology | Blood Banking and Transfusion Medicine | — | Donor selection | pprnhTi86pA | Published |
| Microbiology | Virology | — | Influenza Parainfluenza Mumps RSV | sgbJTyco26g | Published |
| Microbiology | Parasitology | — | Trematodes I | -oF7W3AvhmU | Published |

All four IDs parsed successfully, returned YouTube metadata, and played in the actual privacy-enhanced embed with player state 1 and elapsed time advancing beyond two seconds. Each was published through the Admin UI after playback verification. Student mobile playback was additionally observed beyond four seconds at width 390, with document width also 390. Duration metadata was recorded from the player; ALS titles remain exactly as supplied. No YouTube account settings were changed.

HEMOSTASIS VIDEO LINK PROVIDED: NO

HEMOSTASIS STUDENT VISIBLE: NO

## Security and database

Both new tables have RLS. Student access requires Published status plus existing `private.enrolled` rules through `program_subjects`: active Student, active Subject/Chapter/program, current enrollment, valid batch and access dates. Program-specific Chapters additionally require matching program access. Anonymous access, Teacher and Student writes, cross-subject reads, expired/future enrollment, drafts and archived recordings are denied.

The access helper lives in the non-exposed private schema, uses caller identity and an empty search path. Public save/source RPCs use SECURITY INVOKER. Admin source access is independently protected by RLS. Supabase security advisor found no findings for the added objects; existing unrelated project findings remain unchanged.

QA modified: YES — `xstssknlgdraulebdsfd`.

Production modified by this task: NO. No production deployment or content changes were performed.

Migrations: YES — `20260911095204_recorded_classes.sql`.

The forward migration first replayed transactionally against QA and rolled back, then applied to QA with migration history. All 26 migrations also replayed successfully into a fresh isolated PostgreSQL 17 database using the repository's Supabase provider shim. The disposable database was removed afterward. This verifies SQL history, not a local recreation of every hosted Supabase service.

## Responsive QA and performance

- Desktop 1440px: PASS.
- Mobile 390 × 844: PASS.
- Admin list, create/edit form, URL validation, filters, statuses, Student groups/thumbnails/player and Previous/Next: PASS; no document horizontal overflow.
- Admin navigation to populated content: approximately 1.76s desktop / 2.07s mobile in the isolated local QA server. Recording list query: approximately 290ms for one page of 30 or fewer rows.
- Student navigation to library content: approximately 1.44s in the completed regression run (another run measured 2.02s).
- No Question Bank eager loading. Admin requests only recordings, Subjects, Chapters and active Teacher attribution options. Development Strict Mode repeated metadata effects; recording queries remained paginated.
- These are local development measurements over remote QA, not production performance benchmarks. The existing Courses page showed one approximately 30-second outlier in its existing broad portal loader; Recorded Classes does not call that loader.

## Tests and reproduction

- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `pnpm test`: PASS — 137 Vitest tests and four Node import tests, including 29 recording unit cases.
- `pnpm build`: PASS, including both new dynamic route trees.
- Database QA: 21 assertions passed, including repeated import, authoring and RLS cases.
- Browser regression: 29 assertions passed in a complete run; 15 supplementary checks cover thumbnails, failed playback, network recovery and login enforcement.
- Clean migration replay: all 26 passed.

`scripts/recorded-classes-qa.mjs` uses only the hard-bound QA project and creates dedicated QA identities; it imports via the canonical RPC, provisions its own test enrollment and writes private local browser state files. Run with `node --env-file=.env.local scripts/recorded-classes-qa.mjs`. `--setup` imports without the full regression. `--cleanup-browser` removes only the disposable recording created by this task's browser test. No disposable recordings remain in the library; the final count is five.

`scripts/recorded-classes-browser-qa.mjs` uses the bundled Playwright runtime and a QA-configured local server on port 3012. Set `PLAYWRIGHT_ENTRY` if the bundled runtime differs; optionally set `RECORDED_QA_CDP` to attach to a dedicated browser. It plays and publishes only the client recordings, then tests a disposable recording. Run cleanup afterward.

`scripts/recorded-classes-replay.mjs` accepts `ALS_TEST_PSQL` and `ALS_TEST_PGPORT`, connects only to loopback and creates/removes its own disposable database. Structured results are in `docs/recorded-classes-qa.json`; screenshots and private test state are under ignored `.local-qa/`.

## Git and release

Starting SHA: `7fb77790d31d5d8585b7256b27de9c6805191bf1`.

Branch: `codex/recorded-classes`. The shared workspace received the unrelated `7fbb057` Biochemistry assignment commit during this task; it was left intact. Only recording-related files are included in the feature commit. The completion message records that final commit SHA. Pre-existing untracked files were not staged.

Changes cover the forward migration, recording domain/parser and unit tests, server access loader, Admin manager/navigation, Student library/player/Courses entry, thumbnail/player components, QA/import/replay scripts and this report. Push status: not pushed. Browser verification used QA and an isolated local server; no Vercel deployment was needed.

YES — RECORDED CLASSES READY FOR PRODUCTION REVIEW

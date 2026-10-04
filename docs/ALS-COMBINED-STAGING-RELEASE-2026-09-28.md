# ALS combined Hostinger staging release ledger

## Scope and source

This ledger records the one protected staging candidate combining the native Hostinger classroom branch with the locally verified platform fixes. The target is the existing `redacted-staging-project` Supabase project `redacted-staging-project` and the existing Hostinger app at `https://redacted-staging.invalid/`. ALS Production, Vercel, the paused unrelated Supabase project, and Git remotes are outside this release and have not been changed.

| Item | Identity and result |
| --- | --- |
| Hostinger input | `codex/hostinger-staging` at `[REDACTED_PRIVATE_ID]`; currently hosted source is the earlier code revision `0f1a642…`, deployment `[REDACTED_PRIVATE_ID]`. The intervening commit is documentation only. Its uncommitted deployment document was left untouched. |
| Platform input | `codex/platform-gap-audit` at `[REDACTED_PRIVATE_ID]`; locally tested code commit `[REDACTED_PRIVATE_ID]`. |
| Integration | Separate local worktree and branch `codex/als-staging-integration`, HEAD `[REDACTED_PRIVATE_ID]` before this ledger. Documented platform commits `87bb311`, `64675c8`, `2b65b18`, `ad7ccf7`, `da71cc0`, `1fb0cf4`, `a1dbe0f`, `172c410`, `be4b2b3`, `3f5a6de` were cherry-picked in order without Git conflicts. A follow-up integration commit wires the live-classes error boundary to installed Next.js `retry`. |
| Source package | Ignored npm-compatible ZIP `.local-qa/combined-candidate-acab47d/als-hostinger-staging-source.zip`, SHA-256 `[REDACTED_PRIVATE_ID]`, 257 allowlisted entries. A secret/private-fixture scan and byte-for-byte archive/source comparison passed. |
| Prior app package | Ignored rollback ZIP `.local-qa/rollback-current-hostinger/als-hostinger-staging-source.zip`, SHA-256 `[REDACTED_PRIVATE_ID]`; it is the exact prior deployed source. Any app rollback retains the safe database restriction. |

## Combined local verification

At the integration code HEAD, Vitest passed 45 files with 3 skipped: 276 tests passed and 13 skipped. ESLint, Next type generation plus TypeScript, Next 16.3.3 Webpack production build, recording hash Worker bundle test, and `git diff --check` passed. The separate `scripts/microbiology-import.test.mjs` could not run because the ignored, client-derived `.local-qa/microbiology-preflight-records.json` fixture is absent from this worktree; its result is not counted as a pass.

## Private staging baseline and migration gate

The exact staging dashboard showed a Healthy Free/Nano project. Read-only SQL Editor exports are private under this worktree's ignored `.local-qa/` and excluded from the source ZIP. They cover all rows in `batches`, `batch_faculty`, `enrollments`, `content_batch_access`, `test_batches`, and `live_sessions`; their columns, RLS table flags, policies and table grants; all migration history rows including statements; all five direct batch FKs; and a quiet-state/Cron snapshot. This is a scoped logical export, not a full physical database or R2 backup. The restore plan is to retain the original app ZIP and affected row/schema evidence, investigate any discrepancy against these exports, and review a forward corrective migration that preserves referenced-batch deletion denial. Routine restoration of the old CASCADE/SET NULL actions is excluded.

| Private export | SHA-256 | Summary |
| --- | --- | --- |
| `staging-batch-data-snapshot-export.csv` | `[REDACTED_PRIVATE_ID]` | 1 batch, 1 faculty assignment, 2 enrollments, 5 live sessions, 0 content batch mappings, 0 test batch mappings. |
| `staging-batch-schema-access-export.csv` | `[REDACTED_PRIVATE_ID]` | 55 columns, 12 policies, 6 table flags, 80 grants. |
| `staging-batch-fk-catalog-export.csv` | `[REDACTED_PRIVATE_ID]` | Exactly the five expected direct FKs. Old actions: CASCADE on faculty/content/test, SET NULL on enrollment/live session. All validated, nondeferrable, with exact expected names and columns. |
| `staging-migration-history-snapshot-export.csv` | `[REDACTED_PRIVATE_ID]` | 42 entries. Each recorded name and statement exactly matches its local file after line-ending normalization. Safeguard is absent. |
| `staging-quiet-catalog-export.csv` | `[REDACTED_PRIVATE_ID]` | All eight live/open/unfinished counters zero; cleanup Cron job 1 retained and paused. |

The project-specific Management API token required by the existing migration runner is unavailable; the owner confirmed no token file. The connected Supabase app cannot access this project. The exact staging SQL Editor passed a harmless rollback-only multi-statement probe (`probe_ok=true`). The proposed one-run SQL Editor fallback retains the reviewed migration's transaction, schema guard, 5-second lock timeout and five ALTERs, and places catalog assertion plus migration-history insert before the same COMMIT. The original migration source SHA-256 is `[REDACTED_PRIVATE_ID]`; the prepared execution SQL SHA-256 is `[REDACTED_PRIVATE_ID]`. No migration has been run at this ledger checkpoint.

## Hosted rollout and acceptance

The execution below completed on 30 September 2026. The app retained its 25 environment keys, protected staging origin, and disabled live class/recording/POC gates. The prior test cutoff and application credential deadline were already past; they were not extended. The cleanup job remained paused. No new live class, recording, R2 object, or provider publication was made during this combined release.

| Gate | Current verdict |
| --- | --- |
| Platform safeguard, local database | PASS on the prior disposable synthetic upgrade/fresh replay and acceptance harness. |
| Platform safeguard, exact staging | **PASS.** Migration history, all five FKs, unchanged scoped rows and access configuration, and authenticated Admin FK denial independently verified. |
| Combined application, hosted | **PASS for deployment and focused academic/authentication checks.** New source deployed to the existing protected app; exact journeys are below. |
| Live classroom | Prior hosted Student audio reception was on an older candidate. On this candidate, assigned Teacher sees completed classes and disabled normal entry. New media, screen sharing, human audibility, recording/replay, and provider-track cleanup remain open. |
| Physical devices | Not run on this combined candidate. |
| Production safeguard/release | Not applied and not authorized. |

### Database execution and preservation

- SQL Editor in the authenticated dashboard for **exact project `redacted-staging-project`** was the sole execution route. The connected Supabase app could not access this organization. Before submission, the read-only quiet check at **2026-09-30 09:24:18 UTC** showed zero live/open/unfinished counters, Cron job 1 inactive, 42 prior migration entries, the safeguard absent, and all five old FK definitions. Hostinger's three live/recording/POC gates were visibly `false`.
- The prepared one-transaction SQL matched the reviewed source and prepared hashes above. Supabase's editor normalized the wrapper's LF to CRLF; the migration source embedded for history already used CRLF. It was submitted once. The result returned, then independent catalog and history exports proved the committed outcome: version `20260928075559`, exact migration statement as the 43rd entry, and exactly five validated, nondeferrable `ON DELETE RESTRICT` FKs with their original names.
- `.local-qa/compare-post-migration.ps1` passed: the six scoped tables retained 1 batch, 1 faculty assignment, 2 enrollments, 0 content mappings, 0 test mappings, and 5 classes; 55 columns, 12 policies, 6 RLS/owner flags, 80 grants, and all 42 prior history entries were unchanged. Existing null-enrollment scope remained unchanged. Private after exports are ignored and local; SHA-256: data `[REDACTED_PRIVATE_ID]`, schema/access `[REDACTED_PRIVATE_ID]`, FK catalog `[REDACTED_PRIVATE_ID]`, history `[REDACTED_PRIVATE_ID]`.
- A signed-in synthetic Admin's direct Data API deletion of the referenced batch returned SQLSTATE `23503` naming `batch_faculty_batch_id_fkey`; the batch, faculty assignment, two enrollments, and five class references remained. A signed-in assigned Teacher could read that batch, but its delete was denied or affected zero rows without a FK error. This distinguishes authorization from integrity enforcement. The deliberately destructive pre-fix probe was not run on staging.

### Hostinger deployment and hosted academic checks

- Source revision **`[REDACTED_PRIVATE_ID]`** was redeployed from the reviewed 257-entry ZIP SHA-256 **`[REDACTED_PRIVATE_ID]`** to the existing Hostinger app. Deployment **`[REDACTED_PRIVATE_ID]`** became Current/Completed at 2026-09-30 13:43 dashboard time. npm installed 448 packages; Next.js 16.3.3 Webpack compiled, TypeScript finished, 29/29 static pages generated, and the app restarted. Root `./`, npm build, `.next`, and Node 22 were preserved. A transient `Server is not running` log appeared during restart at 13:43:25, followed by `Ready` at 13:43:26; the protected site and authenticated journeys subsequently worked. Hostinger currently shows that one runtime error, not zero.
- Anonymous `/` redirects 307 to the same-origin staging gate, which returns 200 with `noindex`/`no-store`. Separate synthetic Admin, Teacher, and Student password sessions reached `/admin`, `/teacher`, and `/student`. Cross-role navigation redirected to the signed-in role. Teacher logout returned to `/login`, and revisiting `/teacher` stayed at login.
- Admin `Programs & Syllabus` showed the referenced batch's Delete action disabled with the archive explanation. The Admin saved a second Program enrollment for synthetic Student 1 (CRE Crash Course); a direct read showed **two distinct enrollment IDs and Program IDs**. Suspending and reactivating only the CRE row left the original classroom enrollment unchanged. The Student initially saw one eligible Program because the original classroom enrollment had expired. Temporarily removing that expiry showed both Programs in Courses and a dashboard count of two. Archiving the classroom batch hid only that Program; restoring it to Upcoming still withheld access; explicitly setting Active restored both. The original classroom expiry was restored byte-equivalently afterward, and the Student count returned to one. The new synthetic CRE enrollment remains active as staging QA evidence.
- The Teacher dashboard showed one assigned subject, two assigned Students, and only the synthetic classroom Program. Its completed classes were visible, while the page reported normal entry disabled, Realtime configured, recording not enabled. The public recording hash Worker was fetched through the real staging gate: hosted bytes matched the local bundle SHA-256 `[REDACTED_PRIVATE_ID]` and executed ordered `a`/`bc` chunks to the expected SHA-256 digest.
- The reported “unable to give multiple programs” behavior corresponded to the old single-Program enrollment form. The deployed form states that each enrollment grants one Program and offers a separate Save/Add another program path. The hosted two-row create/edit/course check above confirms that workflow; the original client's second-save error was not reproduced or claimed as reproduced.

### Classroom scope and final safe state

- The scoped R2 credential accepted a read-only object-list request at **2026-09-30 10:01:32 UTC**; no credential was renewed. This confirms validity at that time, not hosted recording/upload. The app's prior live test cutoff and application credential deadline remained expired, and live/recording flags stayed disabled. A fresh bounded media window was not opened. Actual teaching-screen selection/readability, human audibility, hosted capture/upload/recovery, publication/replay/seek/renewal, provider-track scheduler closure, and physical Android/iPhone tests remain unverified on this combined candidate. The local Student retry error-boundary test passed in the candidate suite; a hosted injected-failure retry was not run.
- The final exact-project SQL check at **2026-09-30 10:08:22 UTC** found zero live classes, open connections, publications, subscriptions, attendance intervals, unfinished recordings/segments, and unacknowledged parts; zero active cleanup jobs; five restrictive batch FKs; one safeguard history row; and the synthetic batch Active. The ignored final CSV has SHA-256 `[REDACTED_PRIVATE_ID]`. Production, Vercel, other Supabase projects, Git remotes, and provider credentials were not changed.

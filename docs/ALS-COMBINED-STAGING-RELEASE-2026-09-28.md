# ALS combined Hostinger staging release ledger

## Scope and source

This ledger records the one protected staging candidate combining the native Hostinger classroom branch with the locally verified platform fixes. The target is the existing `als-live-staging` Supabase project `slghshcdaijbcjfoqerq` and the existing Hostinger app at `https://darkgreen-camel-484366.hostingersite.com/`. ALS Production, Vercel, the paused unrelated Supabase project, and Git remotes are outside this release and have not been changed.

| Item | Identity and result |
| --- | --- |
| Hostinger input | `codex/hostinger-staging` at `ee33640af6267140d7fd1fe455c3522c22f97d74`; currently hosted source is the earlier code revision `0f1a642…`, deployment `01a0e83d-3f87-706a-b096-d0b82f7d283e`. The intervening commit is documentation only. Its uncommitted deployment document was left untouched. |
| Platform input | `codex/platform-gap-audit` at `3f5a6ded8f8f54aeb289e7eefdabd10e3a45bd32`; locally tested code commit `be4b2b30302c3bfb9cbadad787f8a2b8f0d8aaa2`. |
| Integration | Separate local worktree and branch `codex/als-staging-integration`, HEAD `acab47d0336587d825a8dbd7ecc2a4b18677de1b` before this ledger. Documented platform commits `87bb311`, `64675c8`, `2b65b18`, `ad7ccf7`, `da71cc0`, `1fb0cf4`, `a1dbe0f`, `172c410`, `be4b2b3`, `3f5a6de` were cherry-picked in order without Git conflicts. A follow-up integration commit wires the live-classes error boundary to installed Next.js `retry`. |
| Source package | Ignored npm-compatible ZIP `.local-qa/combined-candidate-acab47d/als-hostinger-staging-source.zip`, SHA-256 `cb8ff7062df1f87182e0e9a3ebc6392d385abd16cd48d616a9b048f27f2a1eee`, 257 allowlisted entries. A secret/private-fixture scan and byte-for-byte archive/source comparison passed. |
| Prior app package | Ignored rollback ZIP `.local-qa/rollback-current-hostinger/als-hostinger-staging-source.zip`, SHA-256 `2cbf9d37f34592ad53e92c32764b04bd254e75c93a473bf1053285fc5ceeb47b`; it is the exact prior deployed source. Any app rollback retains the safe database restriction. |

## Combined local verification

At the integration code HEAD, Vitest passed 45 files with 3 skipped: 276 tests passed and 13 skipped. ESLint, Next type generation plus TypeScript, Next 16.3.3 Webpack production build, recording hash Worker bundle test, and `git diff --check` passed. The separate `scripts/microbiology-import.test.mjs` could not run because the ignored, client-derived `.local-qa/microbiology-preflight-records.json` fixture is absent from this worktree; its result is not counted as a pass.

## Private staging baseline and migration gate

The exact staging dashboard showed a Healthy Free/Nano project. Read-only SQL Editor exports are private under this worktree's ignored `.local-qa/` and excluded from the source ZIP. They cover all rows in `batches`, `batch_faculty`, `enrollments`, `content_batch_access`, `test_batches`, and `live_sessions`; their columns, RLS table flags, policies and table grants; all migration history rows including statements; all five direct batch FKs; and a quiet-state/Cron snapshot. This is a scoped logical export, not a full physical database or R2 backup. The restore plan is to retain the original app ZIP and affected row/schema evidence, investigate any discrepancy against these exports, and review a forward corrective migration that preserves referenced-batch deletion denial. Routine restoration of the old CASCADE/SET NULL actions is excluded.

| Private export | SHA-256 | Summary |
| --- | --- | --- |
| `staging-batch-data-snapshot-export.csv` | `45bd40f54c8193481b3889a558c8b8846e625261cdc5b846dfa32b26c742b6e5` | 1 batch, 1 faculty assignment, 2 enrollments, 5 live sessions, 0 content batch mappings, 0 test batch mappings. |
| `staging-batch-schema-access-export.csv` | `6ceabd420664a6389512cc0f20bdc0cf4bc8b28c5db913303ece3981b8e6ff84` | 55 columns, 12 policies, 6 table flags, 80 grants. |
| `staging-batch-fk-catalog-export.csv` | `6458d285b9e68e2066e869c740c498953ede8ad11f2e0a29eddb5b38aa721da8` | Exactly the five expected direct FKs. Old actions: CASCADE on faculty/content/test, SET NULL on enrollment/live session. All validated, nondeferrable, with exact expected names and columns. |
| `staging-migration-history-snapshot-export.csv` | `345f4239c318dafe0cd37719e0134a1288f6015d08c6742c5044b6c9837499ff` | 42 entries. Each recorded name and statement exactly matches its local file after line-ending normalization. Safeguard is absent. |
| `staging-quiet-catalog-export.csv` | `d3deee1cbed09f5ff4cb594b29b6fa2a388c8b9c527d6fa2101bf1a898138413` | All eight live/open/unfinished counters zero; cleanup Cron job 1 retained and paused. |

The project-specific Management API token required by the existing migration runner is unavailable; the owner confirmed no token file. The connected Supabase app cannot access this project. The exact staging SQL Editor passed a harmless rollback-only multi-statement probe (`probe_ok=true`). The proposed one-run SQL Editor fallback retains the reviewed migration's transaction, schema guard, 5-second lock timeout and five ALTERs, and places catalog assertion plus migration-history insert before the same COMMIT. The original migration source SHA-256 is `319343926a561b9b63feb634138eea9e4e481c8e3dad66e0a489c1442561f223`; the prepared execution SQL SHA-256 is `09a7e12882319f6c2e7d4a8320011ae2dd350e08bee5c6e50ff17051db5df5a8`. No migration has been run at this ledger checkpoint.

## Hosted rollout and acceptance

Pending the fresh quiet-state gate and exact migration result. The existing app still has 25 environment keys with the staging access gate enabled, live class/recording/POC gates disabled, an expired test cutoff, and no active media. The cleanup job remains paused; its later controlled provider-close verification is a separate gate. No new recording or R2 object has been made for this integration. Hosted academic, classroom, and physical-device results will be entered here from actual checks, without carrying local passes forward as hosted passes.

| Gate | Current verdict |
| --- | --- |
| Platform safeguard, local database | PASS on the prior disposable synthetic upgrade/fresh replay and acceptance harness. |
| Platform safeguard, exact staging | Pending migration and post-change verification. |
| Combined application, hosted | Pending deployment and focused regression. |
| Live classroom | Prior hosted Student audio reception passed; screen sharing, complete audibility, recording/replay, and unattended provider cleanup remain open. Live entry disabled. |
| Physical devices | Not run on this combined candidate. |
| Production safeguard/release | Not applied and not authorized. |

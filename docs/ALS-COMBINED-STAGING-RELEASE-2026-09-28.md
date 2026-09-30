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

Pending the fresh quiet-state gate and exact migration result. The existing app still has 25 environment keys with the staging access gate enabled, live class/recording/POC gates disabled, an expired test cutoff, and no active media. The cleanup job remains paused; its later controlled provider-close verification is a separate gate. No new recording or R2 object has been made for this integration. Hosted academic, classroom, and physical-device results will be entered here from actual checks, without carrying local passes forward as hosted passes.

| Gate | Current verdict |
| --- | --- |
| Platform safeguard, local database | PASS on the prior disposable synthetic upgrade/fresh replay and acceptance harness. |
| Platform safeguard, exact staging | Pending migration and post-change verification. |
| Combined application, hosted | Pending deployment and focused regression. |
| Live classroom | Prior hosted Student audio reception passed; screen sharing, complete audibility, recording/replay, and unattended provider cleanup remain open. Live entry disabled. |
| Physical devices | Not run on this combined candidate. |
| Production safeguard/release | Not applied and not authorized. |

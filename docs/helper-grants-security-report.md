# PRODUCTION SECURITY COMPATIBILITY — FAIL

2026-09-11. The least-privilege helper migration passes QA. Production setup is **not authorized to proceed under this batch's conditional gate**, because the clean migration replay fails at an earlier platform prerequisite. The aggregate test command also retains its previously reported runner mismatch.

## Root cause and migration

Old QA has PUBLIC and named anon/authenticated/service_role execute grants on five public access helpers. New production defaults give new public functions no API-role execute grants. Four helpers lacked explicit authenticated grants; `teacher_has_assignment(uuid,uuid,uuid,text)` already had one but still had unnecessary broad grants.

Created with Supabase CLI 2.117.0:
`20260911020155_explicit_core_helper_function_grants.sql`.

For the five exact function signatures below, the migration revokes EXECUTE from PUBLIC, anon and service_role, and grants EXECUTE to authenticated. postgres owner execution remains. It does not alter bodies, owners, security modes, search_path, RLS policies, tables or mutation RPC privileges.

| Function | Used by | anon EXECUTE | authenticated EXECUTE | Privileged role | Security mode |
|---|---|---|---|---|---|
| `public.is_admin()` | Admin policies and access-helper chains | NO | YES | postgres YES; service_role NO | INVOKER |
| `public.is_teacher()` | Private content/question media uploads | NO | YES | postgres YES; service_role NO | INVOKER |
| `public.has_program_access(uuid)` | Program, chapter and topic access | NO | YES | postgres YES; service_role NO | DEFINER |
| `public.teacher_has_assignment(uuid,uuid,uuid,text)` | Teacher scope and authoring | NO | YES | postgres YES; service_role NO | DEFINER |
| `public.can_join_live(uuid)` | Live message/attachment policies and presence RPCs | NO | YES | postgres YES; service_role NO | INVOKER |

These are **observed QA post-migration privileges**. All five are owned by postgres, return boolean, are STABLE, and have empty search_path. Production does not yet contain these functions. The complete inventory of 39 canonical functions plus the separate platform helper is in `helper-grants-function-inventory.md`, including six already-explicit private access helpers, eleven owner-only helpers and every existing mutation/review RPC.

Historical migrations modified: **NO**.

## Exact verification results

| Gate | Result |
|---|---|
| QA function privileges, modes, owners, search_path, policy/body and unrelated-grant comparison | PASS — 270 assertions |
| QA core DB tests | PASS — 80 assertions |
| QA core security tests | PASS — 12 assertions |
| Explicit anonymous/Student/Teacher mutation and helper denial checks | PASS — 15 assertions |
| Pathology regression | PASS — 24 assertions, all 966 question payloads, 3,864 options, 966 keys and 8 original assets verified |
| Microbiology regression | PASS — all 793 complete question payloads compared to approved source |
| Local conditional PostgreSQL replay with QA platform helper supplied | PASS — 23 migrations and 229 privilege/schema assertions |
| Local clean replay matching production's missing platform helper | FAIL — migration 2; details below |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — zero errors/warnings on final run |
| `pnpm build` | PASS |
| `pnpm test` | FAIL — existing Vitest/Node test-runner mismatch; 44 Vitest tests pass, but Vitest reports no suite for the Node test file |
| `pnpm exec vitest run src` | PASS — 44 tests across 7 files |
| `node --test scripts/microbiology-import.test.mjs` | PASS — 4 tests |

The Node test-runner issue was present before this batch. No unrelated test configuration or UI files were changed. The conditional replay is not evidence that unmodified fresh production can migrate: it explicitly supplies an object that production lacks. It uses PostgreSQL 17.11, production's restrictive default grants, and a minimal local auth/storage SQL provider fixture; it does not emulate the Supabase HTTP services. Real HTTP/RLS/storage behavior was tested on QA.

## Security regression details

Admin authoring, taxonomy and reorder operations passed. Assigned Teacher access passed; wrong-program and unassigned-batch mutation, revoked permissions and test-only Teacher answer-key reads remained denied. Eligible Student test/content/media access passed. Future, expired, suspended, inactive, wrong-program and wrong-batch access remained denied.

Direct score/status/expiry/submission/count mutations were denied. Grading remained server-controlled, including negative/unanswered scoring and concurrent submissions. Answer refresh and historical snapshots survived source edits. Cross-student history/review access was denied. Stem media was permitted during an eligible attempt; solution media remained denied before submission and permitted after allowed review. Actual private PDF retrieval succeeded. Anonymous protected table access and helper/mutation calls were denied. None of the regression fixtures uses imported subject content for mutation.

No sensitive RPC became newly executable by an unauthorized role. Public mutation RPC EXECUTE grants remain exactly as before; their shared authenticated entry point still enforces Admin/Teacher/Student authorization internally. The retired checkpoint RPC remains denied to authenticated. All eleven owner-only helpers remain denied to anon, authenticated and service_role. No service_role/helper grant was added.

## Production preflight and exact production changes

Target: `dvmahmkapgtjfqmoottt`, distinct from QA `xstssknlgdraulebdsfd`.

`20260905052130_harden_academic_rls.sql`, line 2, unconditionally executes:

```sql
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
```

QA has this platform-provided event-trigger function. None of the 22 historical ALS migrations creates it. Direct production catalog reads return NULL for `to_regprocedure('public.rls_auto_enable()')`. Clean local replay reproduces PostgreSQL's error: `function public.rls_auto_enable() does not exist`.

The new helper-grant migration occurs after this failure. Resolving an earlier prerequisite by backdating a migration, rewriting historical SQL or silently installing a production placeholder is outside this batch. A separately reviewed fresh-install compatibility repair is required. This batch does not waive the user's clean-sequence gate.

- Production migration history before: **0**.
- Production migrations applied: **0**.
- Production migration history after: **0**.
- Pending: **23**, including the new grant migration.
- Production public application tables: **0**.
- Production Auth users: **0**.
- Actual production Admin/Teacher/Student/anon application-policy tests: **not run**, because the application schema is absent.
- Production function privilege table: **not applicable yet**, functions absent.
- Production changes: **none; read-only management/catalog/history inspection only**.

QA history is now 23 migrations (22 before). New synthetic QA fixtures from the existing regression suites are retained under the unique prefix recorded in `.local-qa/helper-grants/core-qa-results-after.json`. The original `core-qa-results.json` fixture index was restored; existing QA users, fixtures and both imported subjects were preserved.

## Reproduction and artifacts

- `scripts/helper-grants-lib.mjs`: exact canonical signatures and privilege/mode assertions.
- `scripts/helper-grants-apply-qa.mjs`: guarded QA-only atomic SQL/history application.
- `scripts/helper-grants-verify.mjs`: actual catalog assertions and before/after comparison.
- `scripts/helper-grants-role-regression.mjs`: rejected calls and anonymous access tests.
- `scripts/helper-grants-local-replay.mjs`: isolated local fresh/conditional chain replay.
- `scripts/fixtures/helper-grants-provider.sql`: minimal local SQL provider fixture.
- `scripts/helper-grants-production-preflight.mjs`: read-only prerequisite/history check; exits nonzero on the observed blocker.

Evidence is under `.local-qa/helper-grants/`. No keys or tokens are included in the committed reports. Verification scripts use the existing management token from the local environment without printing it. Production preflight and QA mutation paths are separate and explicitly target-guarded.

## Git and scope

- Starting SHA: `e6fe8d3b3baf4ed25f32f0f680a5f4cae365ee60`.
- Branch: `codex/production-helper-grants`.
- Final SHA: reported with the completion message; this report is part of that commit.
- Files changed: the one new migration, seven new test/verification/support files listed above, this report and the full function inventory. No historical migration, UI/product, environment or import source changed.
- No push or production-branch promotion.

Pathology imported: **NO**. Microbiology imported: **NO**. Vercel changed: **NO**. Deployment triggered: **NO**.

NO — PRODUCTION DATABASE SECURITY STILL BLOCKED

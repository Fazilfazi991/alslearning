# MIGRATION CHAIN PORTABILITY — PASS

2026-09-11. All 23 repository migrations now replay from zero ALS schema without
the optional legacy helper. All 23 have been applied to production and verified.
This report supersedes the stop state in `migration-portability-review.md`.

## Approved repair and origin

The user explicitly approved the proposed historical repair after the previous
report. `20260905052130_harden_academic_rls.sql` now wraps its revoke in
`if to_regprocedure('public.rls_auto_enable()') is not null then ... end if`.
Historical migration modified: **YES, only this approved conditional revoke**.
No bootstrap or extra migration was added. No function body, policy or grant
semantics were changed for a database where the optional helper already exists.

The exact QA definition and dependencies remain recorded in
`migration-portability-inspection.json`. It is an optional public-table auto-RLS
event-trigger pattern documented by Supabase, not required ALS infrastructure.
The original installer/time is unknown. QA has the function and `ensure_rls`;
fresh production does not. ALS explicitly enables RLS in its migrations, so
copying this unrelated privileged helper into production was unnecessary.
Production still has neither that function nor its event trigger.

## Clean replay and schema

- Starting state: zero ALS application tables/functions in a disposable local
  PostgreSQL 17.11 database. Minimal auth/storage provider SQL is test infrastructure.
- Migrations attempted: **23**. Completed: **23**, in repository order.
- Manual ALS prerequisites required: **NONE**. No manually pre-created
  `rls_auto_enable()`, skipped migration, reset, or one-off prerequisite SQL.
- **230 privilege/schema assertions plus 35 authorization assertions passed**.
- Optional-helper compatibility replay: **23 migrations, 230 + 35 assertions**.
- All 34 application tables have RLS: 33 public and one private.
- Live QA and production match clean replay: **328 columns, 53 indexes,
  155 constraints**, and all application/storage policies.
- These comparisons cover the academic schema, question/media/rich-table fields,
  attempt snapshots, FKs and transactional RPC signatures and grants.

## QA compatibility and history

QA: `xstssknlgdraulebdsfd`. Migration history **23 before / 23 after**; all versions
match the repository. No fabricated history entries, deletion or replay of the
entire historical migration occurred. The approved conditional block was executed
twice transactionally on QA; full catalog before/after comparison was identical.
The existing applied historical SQL remains an honest record of the earlier
execution; its version is not rewritten to pretend the new text ran originally.

Pathology and Microbiology are preserved. Regression suites created new isolated
synthetic QA fixtures and retained them for inspection. Their index is saved at
`.local-qa/helper-grants/portability-core-after.json`; the original
`core-qa-results.json` was restored. The additional 35 authorization probes always
roll back their accounts and data. No existing fixture or imported payload changed.

## Production application and execution incident

Production: `dvmahmkapgtjfqmoottt`. History **0 before / 23 applied / 23 after**.
The CLI recorded the original repository versions, in order, using standard
`supabase db push`. No manual migration-ledger edits were used.

An initial ordinary connection failed password authentication. Management access
provided a supported temporary CLI login credential (300-second TTL), without
changing the permanent database password or persisting the credential. The first
CLI dry run correctly listed all 23 migrations with no seeds or custom roles.

**Execution incident:** a second invocation intended as a dry run contained an
ampersand in the connection URL (`options` parameter). Windows command-wrapper
parsing split the command and discarded the trailing dry-run flag. The CLI applied
all 23 migrations, then the shell returned an error for the split `options`
fragment. All required pre-application gates had passed and production application
was authorized, but the invocation did not execute in its intended dry-run mode.

The actual migration ledger was read immediately; the apply command was **not
retried**. The wrapper now rejects shell metacharacters in the URL and places
control flags before the URL. The zero-history guard prevents accidental reruns
on this already-migrated project. The erroneous invocation's evidence remains in
`.local-qa/helper-grants/production-cli-dry-run.json`: its requested-mode label is
not evidence of actual dry-run behavior. Actual production history and checks are
the source of truth. No vault, seed-file, or deployment operation ran.

## Actual production security

**234 schema/privilege/history assertions and 35 authorization probes passed.**
All probes used a transaction and rolled back; zero disposable accounts remain.
Admin access works. Assigned Teacher content/test access works; wrong program,
unassigned batch and unauthorized authoring are denied. Eligible Student access
works; wrong program/batch, future, expired, suspended and inactive access are
denied. Direct attempt insertion and score/status/submission mutation are denied.
Anonymous protected data is inaccessible through privileges or RLS.

| Exact public helper | anon | authenticated | service_role | postgres | Mode |
|---|---|---|---|---|---|
| `is_admin()` | NO | YES | NO | YES | INVOKER |
| `is_teacher()` | NO | YES | NO | YES | INVOKER |
| `has_program_access(uuid)` | NO | YES | NO | YES | DEFINER |
| `teacher_has_assignment(uuid,uuid,uuid,text)` | NO | YES | NO | YES | DEFINER |
| `can_join_live(uuid)` | NO | YES | NO | YES | INVOKER |

All five are postgres-owned, STABLE, boolean-returning, with empty search_path.
The six private access helpers retain authenticated/owner execution; the eleven
internal helpers retain owner-only execution. All 39 canonical functions are
inventoried with actual role privileges and modes in
`production-portability-verification.json`. No sensitive RPC received a new
unauthorized grant; authenticated RPC entry points enforce their internal checks.
The retired checkpoint RPC remains inaccessible to authenticated.

The production Supabase security advisor reported **0 errors, 18 warnings and
2 informational findings**. The warnings are the 16 deliberately authenticated
transactional/read RPCs plus the two public DEFINER access helpers. Their privilege
and authorization behavior is verified; changing their mode or revoking intended
execution would break the approved architecture. The informational findings are
RLS-without-policy on private snapshots (owner-only) and retired checkpoint
responses (denied). No blanket grant or RLS weakening was introduced to remove
these findings.

Production role probes run against actual PostgreSQL policies with transaction-local
JWT claims. QA additionally exercised real Supabase Auth/REST/private-storage
flows. A deployed production browser flow is outside this database-only batch.

## Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS; newly added scripts also passed targeted lint |
| `pnpm test` | PASS: 44 Vitest tests + 4 Node tests; no suppressed tests |
| `pnpm build` | PASS |
| Clean full migration replay | PASS: 23 migrations, 230 + 35 assertions |
| Existing-helper replay | PASS: 23 migrations, 230 + 35 assertions |
| QA privilege/body/policy regression | PASS: 270 assertions |
| QA schema/privilege/history comparison | PASS: 234 assertions |
| QA core DB suite | PASS: 80 assertions |
| QA core security suite | PASS: 12 assertions |
| Explicit role/RPC regression | PASS: 15 assertions |
| Rollback authorization probes | PASS: 35 on each of local, QA and production |
| Pathology regression | PASS: 24 assertions; 966 complete questions and original media |
| Microbiology regression | PASS: all 793 complete source payloads unchanged |
| Production schema/privilege/history | PASS: 234 assertions |

## Exact production changes

- Applied all 23 migrations; created their canonical schema/functions/policies,
  indexes/constraints, Auth profile triggers and migration history.
- The foundation migration's existing metadata inserts created **4 entrance exams,
  3 subject records (Biochemistry, Microbiology, Pathology), and 4 programs**
  (DHS Long Term, DME Long Term, MSc MLT Entrance, CRE Crash Course).
  These are built-in migration metadata, not subject question imports.
- Created **3 private buckets**: learning-content, class-recordings, question-media.
- Temporary CLI login credentials were created through the supported management
  endpoint and expire after 300 seconds. Permanent database password unchanged.
- Final counts: **0 Auth users, questions, learning-content records, tests,
  attempts, question-media rows and uploaded storage objects**.
- Production rollback probes left no fixtures. No production helper bootstrap.

Pathology imported: **NO**. Microbiology imported: **NO**.
Vercel changed: **NO**. Deployment triggered: **NO**.
QA and production targets remained distinct; local application environment is QA.

## Git and evidence

Approved grant baseline: `9f2198fc31ea0cdc7e1e299f9bb0d87dcad17334`.
This continuation started from `e4cd94a959f2f7860ef8bafa368ee28c5c6885b4` (the approved
proposal/test-runner commit). Branch: `codex/migration-portability-review`.
Final SHA is in the completion message. No push or production-branch promotion.
Changed files comprise the approved historical conditional, replay/preflight and
authorization/schema/CLI verification scripts, this report and machine-readable
production evidence. No product/UI/environment changes.

`production-portability-verification.json` contains exact migration order/hashes,
actual production function privileges, policies, schema counts and authorization
assertions. Detailed transient execution evidence is in `.local-qa/helper-grants/`.

YES — PRODUCTION DATABASE READY FOR CONTENT IMPORT

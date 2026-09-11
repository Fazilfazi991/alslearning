# MIGRATION CHAIN PORTABILITY — FAIL

HISTORICAL MIGRATION REPAIR REQUIRED

## Finding and proposed repair

The only repository reference to `public.rls_auto_enable()` is line 2 of
`supabase/migrations/20260905052130_harden_academic_rls.sql`. Its comment explicitly
describes an unrelated privileged helper reported by advisors. The statement
revokes API access; it does not call the helper or enable RLS.

Proposed diff ONLY; the historical file has **not** been changed:

```diff
 -- Remove API access to an unrelated privileged helper reported by advisors.
-revoke all on function public.rls_auto_enable() from public, anon, authenticated;
+do $$
+begin
+  if to_regprocedure('public.rls_auto_enable()') is not null then
+    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
+  end if;
+end $$;
```

This preserves the revocation when the optional object exists and skips only that
revocation when absent. It adds no grants, changes no RLS policy, and creates no
function or event trigger. Approval to modify this applied historical file is
required by section 5 of the user's task, not by an additional skill requirement.

An earlier bootstrap is inappropriate: this is optional legacy environment
infrastructure, not required ALS infrastructure. Installing it merely to revoke
its permissions would add a privileged DDL event trigger without an application
requirement. ALS migration 1 explicitly enables RLS on its foundation tables;
later migrations explicitly enable it on added tables, including private snapshots.
All 34 current QA application tables (public plus private) have RLS enabled.

## Exact QA object

The full live definition, ACL, dependency catalog, event-trigger metadata, table
RLS inventory and both migration histories are captured in
`migration-portability-inspection.json` (no credentials).

- Signature: `public.rls_auto_enable()`, returns `event_trigger`.
- Owner: postgres; language: plpgsql; SECURITY DEFINER; VOLATILE.
- search_path: pg_catalog.
- EXECUTE: postgres and service_role only; PUBLIC, anon and authenticated denied.
- Event trigger: `ensure_rls`, `ddl_command_end`, enabled `O` (origin/local).
- Tags: CREATE TABLE, CREATE TABLE AS, SELECT INTO.
- It reads `pg_event_trigger_ddl_commands()`, filters table/partitioned-table
  creation in public, and executes ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
  System, temporary and other schemas are excluded. Its exception handler logs
  failures without rethrowing; it is not an adequate replacement for explicit RLS.
- Catalog dependencies: public schema, plpgsql language; `ensure_rls` depends on it.
  No fixed application table reference exists; targets come from DDL metadata.
- No extension-membership dependency was found. No ALS migration creates it.

The definition matches the Supabase-documented optional auto-RLS pattern:
https://supabase.com/docs/guides/database/postgres/event-triggers
It is not proven to be an automatically installed platform object. QA's original
creator and creation time cannot be established from the catalog or repository;
PostgreSQL does not record that timestamp in pg_proc. The earlier report's
"platform-provided" attribution was too strong. Fresh production has neither the
function nor the trigger. Supabase documents postgres event-trigger support via
Supautils; no trigger creation was attempted or is proposed here.

## Stop boundary and verification

Historical migration modified: **NO**. Bootstrap created: **NO**.
No new migration exists, and neither database was modified in this batch.
QA migration history: **23 before / 23 after**. Production: **0 before / 0 applied /
0 after**, with **23 pending**. No QA content, fixtures or grants changed.

The previously reproduced clean replay remains blocked at migration 2 (one
completed, second failed). It has not been rerun as a claimed successful repair.
The prior conditional replay with a manually supplied QA object does not meet the
clean-replay requirement. Manual prerequisites required: unresolved with current
repository; no prerequisite was supplied in this batch.

Fresh live QA verification: **270 privilege/schema assertions passed**, including
unchanged function definitions, policies and unrelated grants against the approved
baseline. Five public helper grants remain authenticated-only plus owner execution;
private owner-only helpers and sensitive RPC restrictions remain unchanged.
Core DB/security and subject regressions were not rerun: no database repair was
applied. Prior batch results remain documented separately, not claimed as new tests.
Production table/function/security verification is blocked: application objects
remain absent. Production was inspected read-only only.

## Test-runner repair

The original `pnpm test` invoked Vitest, which discovered a Node-native test file.
Vitest now excludes only that file in addition to its standard exclusions, and
the canonical script runs it explicitly with Node after Vitest succeeds. No tests
were removed or suppressed, and no application behavior changed.

Technical gate results and final commit SHA are reported in the completion message.
Starting SHA: `9f2198fc31ea0cdc7e1e299f9bb0d87dcad17334`.
Branch: `codex/migration-portability-review`.
Files changed: package.json, vitest.config.mts, this report and the inspection JSON.
No push, production promotion, environment changes, or deployment.

Pathology imported: **NO**. Microbiology imported: **NO**.
Vercel changed: **NO**. Deployment triggered: **NO**.

NO — PRODUCTION DATABASE MIGRATION CHAIN STILL BLOCKED

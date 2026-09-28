# Batch deletion database safeguard: local acceptance record

## Boundary and verdict

This report covers the isolated `codex/platform-gap-audit` branch. The migration and test harness are **prepared but have not been executed against a database**. Database enforcement is therefore **NOT VERIFIED**, and the P0 gap must remain open for release acceptance. No hosted or shared local database was changed.

The only running local Supabase stacks observed during this work were `als_live_class_qa_20260924` (owned by the live-class team) and `IncomeNow` (a different project). Neither is an acceptable target. The live team is actively testing its Hostinger candidate, so another stack was not started during its measurements. `psql` and `supabase` were not on PATH; a one-off Supabase CLI 2.118.0 was used solely to create the migration file through `supabase migration new`. No package or lockfile was changed.

## Source reproduction and safeguard

The foundation migration `20260905044506_academic_platform_foundation.sql` defines five direct `public.batches(id)` references:

| Referencing table | Original `ON DELETE` | Access effect if batch deleted | Prepared action |
| --- | --- | --- | --- |
| `batch_faculty` | CASCADE | Assignment row lost | RESTRICT |
| `enrollments` | SET NULL | Scoped enrollment can become program-wide | RESTRICT |
| `content_batch_access` | CASCADE | Last batch mapping can disappear, making content program-wide | RESTRICT |
| `test_batches` | CASCADE | Last batch mapping can disappear, making a test program-wide | RESTRICT |
| `live_sessions` | SET NULL | Class can lose its batch scope | RESTRICT |

The access consequence follows from `private.enrolled`, `private.content_access`, and `private.test_access` in `20260910030225_core_pipeline_guards.sql`. This is a source-level reproduction of the pre-fix path, **not** an observed production deletion or exposure. The application-side `deleteAcademicEntity` rejects every batch deletion; the Admin UI keeps its Delete action disabled. The new migration changes only those five foreign-key delete actions, retains their names, and leaves nullable batch columns and pre-existing `NULL` rows alone. It begins a transaction, acquires locks, verifies the exact existing catalog layout and old actions, then swaps to nondeferrable `RESTRICT` constraints. An unexpected sixth reference or changed schema aborts the migration. PostgreSQL enforces the resulting restriction for direct authorized SQL/API deletion as well as application calls; this is the proposed invariant, pending database execution.

`batches.program_id` already has `ON DELETE RESTRICT`, so deleting a parent Program cannot silently cascade through an existing batch. Explicit deletion of content or tests can still remove their own mapping rows under the existing policy; this migration does not redesign those parent deletions. An operator with privileged DDL/TRUNCATE authority can bypass ordinary application safeguards and remains outside this application migration. The migration does not modify RLS, grants, helper functions, or test/material access predicates. Same-program `NULL`-batch enrollment uniqueness is a separate, unapproved policy and is unchanged.

## Prepared acceptance and actual outcome

The rollback-only integrity harness is `supabase/tests/restrict_referenced_batch_deletion.sql`; a separate concurrency harness is `scripts/batch-deletion-concurrency-qa.ps1`. Each requires an explicitly identified disposable local database named `als_batch_guard_<digits>` with only synthetic identities/data. The SQL file refuses other database names before fixture insertion. The concurrency script also requires a loopback host and explicit port, a unique `als-batch-guard:<GUID>` database-comment marker, and synthetic unreferenced Batch/Teacher IDs. It checks two rollback races and commits one synthetic faculty link to prove a waiting deletion fails; that exact link is then removed, with fallback cleanup on error. Neither file is a substitute for an authenticated RLS or browser test. The PowerShell harness parsed with zero syntax errors; it was not executed.

| Required check | Prepared evidence | Actual database result |
| --- | --- | --- |
| Fresh full migration replay and synthetic pre-fix upgrade | Forward-only migration plus SQL harness | **NOT RUN** — dedicated full local stack unavailable during live media testing |
| Five references, each independently; combined dependencies; all four batch statuses | Privileged SQL assertions | **NOT RUN** |
| Referencing rows intact, enrollment batch IDs unchanged, existing `NULL` enrollment preserved; unused batch deletable | Privileged SQL row assertions and transaction rollback | **NOT RUN** |
| Parent Program path and content/test parent deletion behavior | Privileged SQL assertions | **NOT RUN** |
| Direct authorized delete, canonical procedures, Admin/Teacher/Student permissions, wrong-batch and eligible access | Requires authenticated local Admin, Teacher, and Student accounts and Data API/RLS checks | **NOT RUN** |
| Concurrent insert versus batch delete, committed outcome and lock observation | Two writer psql sessions plus a read-only observer in the concurrency harness | **NOT RUN** |
| Grants and policies | SQL catalog inventory; migration itself changes neither | **NOT RUN** |

## Coordinated local test slot

The release owner should reserve a time after live-class media measurements, then create a **new** disposable Supabase stack with distinct project ID and ports. Confirm Docker container identity, loopback port, database name, synthetic fixture namespace, and the absence of hosted connection strings before every mutation. Run a fresh replay and an upgrade from a synthetic pre-fix database; capture catalog output, SQLSTATE/constraint names, row counts before/after, and access-query results. Execute the privileged integrity harness against the dedicated migrated clone, then run authenticated Data API/RLS tests using distinct synthetic Admin, Teacher, and Student accounts. Finally run the two-session concurrency harness. A passing mock, source review, or unexecuted harness must not be recorded as database acceptance.

Keep the local Admin UI/repository batch-delete block in place after migration. Schedule the hosted migration only when the live-class release owner has stabilized the candidate and related fixtures are idle. No hosted migration or production rollout is authorized by this report.

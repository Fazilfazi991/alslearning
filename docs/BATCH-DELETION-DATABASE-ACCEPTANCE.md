# Batch deletion safeguard: executed local acceptance

## Verdict and boundary

**LOCALLY DATABASE-VERIFIED** on `codex/platform-gap-audit`, tested code commit `be4b2b30302c3bfb9cbadad787f8a2b8f0d8aaa2`. The safeguard was applied to one new disposable local Supabase stack with synthetic data. Hosted ALS migration, combined classroom testing, and production acceptance are **NOT RUN**; the deployed P0 release gate remains open. No hosted or other project's database was changed.

The original five direct `public.batches(id)` references used `ON DELETE CASCADE` (`batch_faculty`, `content_batch_access`, `test_batches`) or `ON DELETE SET NULL` (`enrollments`, `live_sessions`). The rollback-only pre-fix probe demonstrated that deleting a synthetic referenced batch dropped mappings and nulled the scoped enrollment/class batch IDs while content and test parent rows survived. It logged `pre-fix batch deletion broadening reproduced`, rolled back, and confirmed synthetic cleanup. This is observed local synthetic behavior, **not** evidence of a production deletion or exposure. The application already blocks every batch deletion; the migration independently protects referenced batches at the database layer.

## Target and execution

The live-class coordinator acknowledged a quiet local test window. The new Compose project was `als_batch_guard_202609280921`, with DB container `supabase_db_als_batch_guard_202609280921`, loopback Data API `127.0.0.1:56321`, DB port `56322`, and a unique `als-batch-guard:<test GUID>:als_batch_guard_202609280921` comment on its local `postgres` database. Before mutations, the SQL harnesses checked the exact comment, guard project and marker; Docker checks confirmed full container ID/name, Compose label, health, port and network. A missing marker, wrong marker, and wrong project were independently refused before fixture writes. The Auth harness then proved its first synthetic Auth user existed in that marked database and PostgREST returned the same profile, tying SQL, Auth and Data API to one target. The `postgres` name alone never authorizes execution.

Resource checks showed about 2.18–2.46 GiB free RAM and 84.3 GiB free disk. The pinned temporary CLI was `supabase@2.118.0`; the database image was `public.ecr.aws/supabase/postgres:17.6.1.171`, and PostgREST image version was 16.3. CLI help was checked before starting only DB, Auth, Data API and required dependencies. All required health checks passed. `psql` ran inside the identified DB container. No project package/lockfile or shared browser was changed. Compact evidence is retained in ignored `.local-qa/batch-guard-202609280921/evidence/`; CLI status logs can contain local tokens and should not be pasted into public issues.

Execution order:

1. Started the isolated project with pinned `pnpm.cmd dlx supabase@2.118.0 start`, 42 historical pre-guard migrations and seed disabled; checked Docker identity, health, port and DB comment.
2. Ran `supabase/tests/reproduce_batch_deletion_pre_fix.sql` through guarded `psql -X -v ON_ERROR_STOP=1`, supplying `guard_project` and `guard_marker`. Evidence: `pre-fix-probe.log`, `pre-fix-missing-marker.log`, `pre-fix-wrong-marker.log`, `post-wrong-project.log`.
3. Inserted a synthetic preservation fixture and applied `20260928075559_restrict_referenced_batch_deletion.sql` with `pnpm.cmd dlx supabase@2.118.0 migration up --local`. Evidence: `upgrade-fixture.log`, `fixture-counts-before.txt`, `migration-up.log`.
4. Ran guarded rollback-only `supabase/tests/restrict_referenced_batch_deletion.sql` and `scripts/batch-deletion-concurrency-qa.ps1`. Evidence: `post-upgrade-probe.log`, `concurrency-trace.log`.
5. Ran `pnpm.cmd dlx supabase@2.118.0 db reset --local` only on this project, replayed all 43 migrations with seed disabled, re-marked/reverified the restarted container, and reran the post-fix SQL harness. This fresh replay is separate from the upgrade path. Evidence: `fresh-reset.log`, `post-fresh-replay-probe.log`.
6. Ran `node scripts/batch-guard-auth-qa.mjs` with distinct synthetic Admin, Teacher, Student and wrong-batch Student identities, then used a separate Codex in-app browser for Admin/Student journeys. The first Auth run hit `42501` inserting a content fixture directly as Admin; fixture setup was corrected to use the local service role, without changing grants, and the rerun passed.

The migration retains its locked transaction and exact-schema guard. An unexpected direct batch FK or changed old delete action causes an error/rollback. Both SQL probes roll back and check cleanup.

## Results

| Check | Executed outcome |
| --- | --- |
| Pre-fix reproduction | **PASS.** Scoped enrollment/class `batch_id` became `NULL`; content/test batch mappings disappeared while parent rows survived; all synthetic changes rolled back. |
| Synthetic upgrade | **PASS.** Batch, faculty link, scoped enrollment, content/test mappings and class retained their identifiers/references. The existing `NULL` enrollment remained. Fixture counts stayed `1:1:1:1:1:1:1`. |
| Fresh replay | **PASS.** All 43 migrations replayed from scratch; the post-fix SQL probe passed again. |
| Five independent FKs | **PASS.** Each referenced-batch deletion raised its expected named FK violation and left parent/child rows intact. Catalog showed all five as delete action `r` (RESTRICT), validated `true`, deferrable `false` (`fk-catalog-post-upgrade.txt`). |
| Combined/status/parent paths | **PASS.** Combined dependencies survived rejected deletion; referenced Upcoming, Active, Completed and Archived batches were protected. An unreferenced batch remained deletable at the DB layer, consistent with the separate application-wide block. Program-to-batch restriction held; content/test parent deletion kept its existing mapping cleanup. |
| Grants/policies | **PASS.** Public grants/RLS/policy snapshots before and after upgrade had identical SHA-256 `6F8BEF2F02D935E6391D4D1095F69AD79C34B5C45A9C360A8939FA6327E9C7CF`. |
| Authenticated Admin delete | **PASS.** Direct otherwise-authorized Data API deletion failed with SQLSTATE `23503`, constraint `batch_faculty_batch_id_fkey`; row state was unchanged. This proves FK enforcement separately from the UI block. |
| Teacher/Student authorization and access | **PASS.** Their direct deletion attempts were denied or changed zero rows through authorization/RLS; those responses were **not** counted as FK evidence. Wrong-batch Student could not read protected content; eligible Student could. |

The independently verified constraints were `batch_faculty_batch_id_fkey`, `enrollments_batch_id_fkey`, `content_batch_access_batch_id_fkey`, `test_batches_batch_id_fkey`, and `live_sessions_batch_id_fkey`. The privileged post-fix harness checks that no rejected deletion nulls a reference or drops a mapping. Authenticated API checks supply the separate RLS evidence.

## Concurrency and browser outcomes

The guarded concurrency script used bounded waits and captured both lock directions. Race 1: delete waited for an uncommitted faculty link; insert rolled back, delete completed and rolled back, final batch:link `1:0`. Race 2: faculty insert waited for an uncommitted deletion; delete rolled back, insert completed and rolled back, final `1:0`. Race 3: delete waited for the link to commit, then failed on `batch_faculty_batch_id_fkey`, leaving `1:1`. The exact synthetic link was removed, final `1:0`, with five restrictive constraints intact. Independent review found no remaining concurrency fixture rows.

In the separate local browser, Admin saved Program B for a Student with Program A, then edited only B. SQL showed two enrollment rows, two distinct Program IDs and two distinct row IDs; A remained active and B became suspended. Student Courses displayed both eligible Programs before the edit. Admin archived a batch and restored it to Upcoming; Student content stayed hidden until an explicit Active edit, when it reappeared. The Vercel screenshot did not show an error message, and its unknown second-save failure was **not reproduced**.

The actual local Student dashboard showed two Active programs and zero Upcoming classes, Available tests and Recorded classes. Mixed nonzero class/test/recording states passed focused component tests but were **not** browser/database fixture-tested. A controlled temporary local `SELECT` revocation on `enrollments` showed the Courses error card. After the grant was restored, the old `reset()` button did not refetch; changing the boundary to Next 16 `retry()` recovered both course links without reload. The grant was verified restored. This was a viewport check, not a physical-device test. No fault-injection endpoint was added.

## Cleanup and release checklist

The executor used project-filtered `supabase stop --project-id als_batch_guard_202609280921`. Docker and port checks showed no target containers/listeners. The sole test-owned volume `supabase_db_als_batch_guard_202609280921` was removed after exact label/name/no-container-use verification. Ignored evidence remains; the browser fixture JSON now points to a removed local stack. Live-class QA and IncomeNow stacks/volumes were untouched.

Release owner: compare the final live-class migration list and branch; integrate the ordered commits in `docs/PLATFORM-COMPLETION-HANDOFF.md`; run full gates on the combined candidate; schedule an approved quiet hosted migration window because six tables are locked and replacement FKs validated; prepare the normal staging backup/rollback path; apply the migration in staging; repeat direct FK, authenticated RLS, enrollment/restore, Student counts/retry, and classroom/media checks on that combined revision; then decide production rollout. Keep the application-wide Delete block. Same-Program/`NULL`-batch uniqueness remains an ALS business decision and was not altered.

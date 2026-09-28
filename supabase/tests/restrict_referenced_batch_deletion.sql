-- Run with psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p <dedicated-port>
-- -d als_batch_guard_<digits> -U postgres -v guard_marker=<lowercase-GUID>
-- -f this-file.
-- Provision COMMENT ON DATABASE als_batch_guard_<digits> IS
-- 'als-batch-guard:<lowercase-GUID>' first. Inspect Docker container identity and port
-- mapping out of band. All synthetic rows roll back.
-- One setup path: replay migrations in a dedicated disposable local Supabase
-- stack, quiesce its connections, then clone its migrated postgres database
-- from a maintenance connection with CREATE DATABASE als_batch_guard_123
-- TEMPLATE postgres. Connect only to that clone. Never use a linked database.
-- Privileged integrity test only: Admin/Teacher/Student RLS and application
-- journeys require separate local Supabase accounts and are not asserted here.
-- An absent psql guard_marker variable is a SQL error before any fixture write.
select set_config('als_batch_guard.expected_marker', :'guard_marker', false);
select set_config(
  'als_batch_guard.fixture_label',
  'batch-guard-' || replace(gen_random_uuid()::text, '-', ''),
  false
);
begin;

do $$
declare
  marker text := current_setting('als_batch_guard.expected_marker', true);
begin
  if current_database() !~ '^als_batch_guard_[0-9]+$' then
    raise exception 'Refusing batch guard test outside an isolated local database';
  end if;
  if marker is null or marker !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
     or shobj_description(
       (select oid from pg_database where datname = current_database()),
       'pg_database'
     ) is distinct from 'als-batch-guard:' || lower(marker) then
    raise exception 'Disposable database comment marker missing or mismatched';
  end if;
end $$;

do $$
declare
  ref record;
  actual_count integer;
begin
  select count(*) into actual_count from pg_constraint
  where contype = 'f' and confrelid = 'public.batches'::regclass;
  if actual_count <> 5 then
    raise exception 'Expected five direct batch foreign keys, found %', actual_count;
  end if;

  for ref in
    select * from (values
      ('batch_faculty'), ('enrollments'), ('content_batch_access'),
      ('test_batches'), ('live_sessions')
    ) as expected(table_name)
  loop
    if not exists (
      select 1 from pg_constraint c
      join pg_attribute child_column
        on child_column.attrelid = c.conrelid and child_column.attname = 'batch_id'
      join pg_attribute parent_column
        on parent_column.attrelid = c.confrelid and parent_column.attname = 'id'
      where c.contype = 'f'
        and c.conname = ref.table_name || '_batch_id_fkey'
        and c.conrelid = format('public.%I', ref.table_name)::regclass
        and c.confrelid = 'public.batches'::regclass
        and c.conkey = array[child_column.attnum]::smallint[]
        and c.confkey = array[parent_column.attnum]::smallint[]
        and c.confdeltype = 'r'
        and not c.condeferrable
        and c.convalidated
    ) then
      raise exception 'Batch restriction missing on public.%', ref.table_name;
    end if;
  end loop;
end $$;

create function pg_temp.expect_batch_delete_restricted(target uuid, expected_fk text)
returns void language plpgsql as $$
declare
  observed_fk text;
begin
  begin
    delete from public.batches where id = target;
    raise exception 'Referenced batch deletion unexpectedly succeeded: %', expected_fk;
  exception when foreign_key_violation then
    get stacked diagnostics observed_fk = constraint_name;
    if observed_fk is distinct from expected_fk then
      raise exception 'Expected foreign key %, received %', expected_fk, observed_fk;
    end if;
  end;
  if not exists (select 1 from public.batches where id = target) then
    raise exception 'Referenced batch was lost after rejected deletion';
  end if;
end $$;

do $$
declare
  label text := current_setting('als_batch_guard.fixture_label');
  student uuid := gen_random_uuid();
  teacher uuid := gen_random_uuid();
  program uuid := gen_random_uuid();
  target uuid := gen_random_uuid();
  unused uuid := gen_random_uuid();
  content uuid := gen_random_uuid();
  test uuid := gen_random_uuid();
  scoped_enrollment uuid := gen_random_uuid();
  unscoped_enrollment uuid := gen_random_uuid();
  session uuid := gen_random_uuid();
  status_value public.batch_status;
  status_batch uuid;
  observed_fk text;
begin
  insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
  values
    (student, label || '-student@example.invalid', '{"role":"student"}'::jsonb, '{}'::jsonb),
    (teacher, label || '-teacher@example.invalid', '{"role":"teacher"}'::jsonb, '{}'::jsonb);
  if not exists (select 1 from public.profiles where id = student)
     or not exists (select 1 from public.profiles where id = teacher) then
    raise exception 'Synthetic auth profile trigger did not create profiles';
  end if;

  insert into public.programs(id, slug, name, status)
  values (program, label || '-program', 'Disposable batch guard program', 'active');
  insert into public.batches(id, program_id, slug, name, status)
  values
    (target, program, label || '-target', 'Referenced batch', 'upcoming'),
    (unused, program, label || '-unused', 'Unused batch', 'upcoming');
  begin
    delete from public.programs where id = program;
    raise exception 'Program deletion unexpectedly removed its batch';
  exception when foreign_key_violation then
    get stacked diagnostics observed_fk = constraint_name;
    if observed_fk is distinct from 'batches_program_id_fkey' then
      raise exception 'Expected batches_program_id_fkey, received %', observed_fk;
    end if;
  end;
  delete from public.batches where id = unused;
  if exists (select 1 from public.batches where id = unused) then
    raise exception 'Unused batch deletion did not succeed';
  end if;

  insert into public.enrollments(id, student_id, program_id, batch_id)
  values (unscoped_enrollment, student, program, null);

  insert into public.batch_faculty(batch_id, faculty_id) values (target, teacher);
  perform pg_temp.expect_batch_delete_restricted(target, 'batch_faculty_batch_id_fkey');
  delete from public.batch_faculty where batch_id = target and faculty_id = teacher;

  insert into public.enrollments(id, student_id, program_id, batch_id)
  values (scoped_enrollment, student, program, target);
  perform pg_temp.expect_batch_delete_restricted(target, 'enrollments_batch_id_fkey');
  delete from public.enrollments where id = scoped_enrollment;

  insert into public.learning_content(id, program_id, kind, slug, title, status)
  values (content, program, 'note', label || '-content', 'Disposable content', 'active');
  insert into public.content_batch_access(content_id, batch_id) values (content, target);
  perform pg_temp.expect_batch_delete_restricted(target, 'content_batch_access_batch_id_fkey');
  delete from public.learning_content where id = content;
  if exists (select 1 from public.content_batch_access where content_id = content) then
    raise exception 'Content deletion did not cascade its batch mapping';
  end if;
  insert into public.learning_content(id, program_id, kind, slug, title, status)
  values (content, program, 'note', label || '-content', 'Disposable content', 'active');

  insert into public.tests(id, program_id, slug, title, type, question_count, duration_minutes, status)
  values (test, program, label || '-test', 'Disposable test', 'mock', 1, 5, 'active');
  insert into public.test_batches(test_id, batch_id) values (test, target);
  perform pg_temp.expect_batch_delete_restricted(target, 'test_batches_batch_id_fkey');
  delete from public.tests where id = test;
  if exists (select 1 from public.test_batches where test_id = test) then
    raise exception 'Test deletion did not cascade its batch mapping';
  end if;
  insert into public.tests(id, program_id, slug, title, type, question_count, duration_minutes, status)
  values (test, program, label || '-test', 'Disposable test', 'mock', 1, 5, 'active');

  insert into public.live_sessions(id, program_id, batch_id, faculty_id, title)
  values (session, program, target, teacher, 'Disposable class');
  perform pg_temp.expect_batch_delete_restricted(target, 'live_sessions_batch_id_fkey');

  -- All five dependencies together must remain intact after a rejected delete.
  insert into public.batch_faculty(batch_id, faculty_id) values (target, teacher);
  insert into public.enrollments(id, student_id, program_id, batch_id)
  values (scoped_enrollment, student, program, target);
  insert into public.content_batch_access(content_id, batch_id) values (content, target);
  insert into public.test_batches(test_id, batch_id) values (test, target);
  begin
    delete from public.batches where id = target;
    raise exception 'Batch deletion unexpectedly succeeded with combined dependencies';
  exception when foreign_key_violation then null;
  end;
  if not exists (select 1 from public.batch_faculty where batch_id = target)
     or not exists (select 1 from public.enrollments where id = scoped_enrollment and batch_id = target)
     or not exists (select 1 from public.content_batch_access where content_id = content and batch_id = target)
     or not exists (select 1 from public.test_batches where test_id = test and batch_id = target)
     or not exists (select 1 from public.live_sessions where id = session and batch_id = target) then
    raise exception 'Rejected combined deletion changed a dependent row';
  end if;

  delete from public.batch_faculty where batch_id = target and faculty_id = teacher;
  delete from public.enrollments where id = scoped_enrollment;
  delete from public.content_batch_access where content_id = content and batch_id = target;
  delete from public.test_batches where test_id = test and batch_id = target;
  delete from public.live_sessions where id = session;

  for status_value in
    select unnest(array['upcoming'::public.batch_status, 'active'::public.batch_status,
      'completed'::public.batch_status, 'archived'::public.batch_status])
  loop
    status_batch := gen_random_uuid();
    insert into public.batches(id, program_id, slug, name, status)
    values (status_batch, program, label || '-status-' || status_value::text,
      'Status deletion probe', status_value);
    insert into public.batch_faculty(batch_id, faculty_id) values (status_batch, teacher);
    perform pg_temp.expect_batch_delete_restricted(status_batch, 'batch_faculty_batch_id_fkey');
    delete from public.batch_faculty where batch_id = status_batch and faculty_id = teacher;
    delete from public.batches where id = status_batch;
  end loop;

  if not exists (
    select 1 from public.enrollments
    where id = unscoped_enrollment and batch_id is null
  ) then
    raise exception 'Existing program-wide enrollment was altered';
  end if;
  delete from public.batches where id = target;
  if exists (select 1 from public.batches where id = target) then
    raise exception 'Unreferenced batch deletion did not succeed';
  end if;
end $$;

-- Read-only security inventory; the migration changes neither grants nor RLS.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
  ('batches', 'batch_faculty', 'enrollments', 'content_batch_access', 'test_batches', 'live_sessions')
order by c.relname;

select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in
  ('batches', 'batch_faculty', 'enrollments', 'content_batch_access', 'test_batches', 'live_sessions')
order by tablename, policyname;

select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in
  ('batches', 'batch_faculty', 'enrollments', 'content_batch_access', 'test_batches', 'live_sessions')
order by table_name, grantee, privilege_type;

select 'referenced batch deletion checks passed' as result;
rollback;

do $$
begin
  if exists (
    select 1 from public.programs
    where slug = current_setting('als_batch_guard.fixture_label') || '-program'
  ) then
    raise exception 'Synthetic batch guard fixture survived rollback';
  end if;
end $$;

-- Privileged integrity reproduction for the schema BEFORE the restrictive FK
-- migration. Run with psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1
-- -p <dedicated-port> -d als_batch_guard_<digits> -U postgres
-- -v guard_marker=<lowercase-GUID> -f this-file. Provision COMMENT ON DATABASE
-- als_batch_guard_<digits> IS 'als-batch-guard:<lowercase-GUID>' first; inspect Docker
-- container identity and port mapping out of band. The disposable local DB
-- must exclude 20260928075559_restrict_referenced_batch_deletion.sql.
-- This checks referential outcomes, not Admin/Teacher/Student RLS or an
-- authenticated application journey. All synthetic rows roll back.
-- An absent psql guard_marker variable is a SQL error before any fixture write.
select set_config('als_batch_guard.expected_marker', :'guard_marker', false);
select set_config(
  'als_batch_guard.pre_fix_label',
  'batch-pre-fix-' || replace(gen_random_uuid()::text, '-', ''),
  false
);
begin;

do $$
declare
  marker text := current_setting('als_batch_guard.expected_marker', true);
begin
  if current_database() !~ '^als_batch_guard_[0-9]+$' then
    raise exception 'Refusing pre-fix probe outside an isolated local database';
  end if;
  if marker is null or marker !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
     or shobj_description(
       (select oid from pg_database where datname = current_database()),
       'pg_database'
     ) is distinct from 'als-batch-guard:' || lower(marker) then
    raise exception 'Disposable database comment marker missing or mismatched';
  end if;
end $$;

-- Verify the exact vulnerable schema before writing any fixture rows.
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
      ('batch_faculty', 'c'::"char"),
      ('enrollments', 'n'::"char"),
      ('content_batch_access', 'c'::"char"),
      ('test_batches', 'c'::"char"),
      ('live_sessions', 'n'::"char")
    ) as expected(table_name, delete_action)
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
        and c.confdeltype = ref.delete_action
        and not c.condeferrable
        and c.convalidated
    ) then
      raise exception 'Expected original batch foreign key missing on public.%', ref.table_name;
    end if;
  end loop;
end $$;

do $$
declare
  label text := current_setting('als_batch_guard.pre_fix_label');
  student uuid := gen_random_uuid();
  teacher uuid := gen_random_uuid();
  program uuid := gen_random_uuid();
  target uuid := gen_random_uuid();
  content uuid := gen_random_uuid();
  test uuid := gen_random_uuid();
  enrollment uuid := gen_random_uuid();
  session uuid := gen_random_uuid();
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
  values (program, label || '-program', 'Disposable pre-fix program', 'active');
  insert into public.batches(id, program_id, slug, name, status)
  values (target, program, label || '-batch', 'Upcoming scoped batch', 'upcoming');
  insert into public.batch_faculty(batch_id, faculty_id) values (target, teacher);
  insert into public.enrollments(id, student_id, program_id, batch_id, status)
  values (enrollment, student, program, target, 'active');
  insert into public.learning_content(id, program_id, kind, slug, title, status)
  values (content, program, 'note', label || '-content', 'Scoped content', 'active');
  insert into public.content_batch_access(content_id, batch_id) values (content, target);
  insert into public.tests(id, program_id, slug, title, type, question_count, duration_minutes, status)
  values (test, program, label || '-test', 'Scoped test', 'mock', 1, 5, 'active');
  insert into public.test_batches(test_id, batch_id) values (test, target);
  insert into public.live_sessions(id, program_id, batch_id, faculty_id, title)
  values (session, program, target, teacher, 'Scoped class');

  delete from public.batches where id = target;

  if exists (select 1 from public.batches where id = target) then
    raise exception 'Pre-fix batch deletion did not occur';
  end if;
  if not exists (
    select 1 from public.enrollments
    where id = enrollment and student_id = student and program_id = program
      and batch_id is null and status = 'active'
  ) then
    raise exception 'Scoped enrollment did not become program-wide';
  end if;
  if not exists (
    select 1 from public.live_sessions
    where id = session and program_id = program and batch_id is null
  ) then
    raise exception 'Scoped live session did not lose its batch';
  end if;
  if exists (select 1 from public.batch_faculty where batch_id = target)
     or exists (select 1 from public.content_batch_access where content_id = content)
     or exists (select 1 from public.test_batches where test_id = test) then
    raise exception 'Pre-fix batch deletion did not cascade all batch mappings';
  end if;
  if not exists (select 1 from public.learning_content where id = content and program_id = program)
     or not exists (select 1 from public.tests where id = test and program_id = program) then
    raise exception 'Content or test parent row did not survive batch deletion';
  end if;
  -- The active enrollment now has NULL batch_id and both active parent rows
  -- have zero batch mappings: the relational inputs for program-wide access.
end $$;

select 'pre-fix batch deletion broadening reproduced' as result;
rollback;

do $$
begin
  if exists (
    select 1 from public.programs
    where slug = current_setting('als_batch_guard.pre_fix_label') || '-program'
  ) then
    raise exception 'Synthetic pre-fix fixture survived rollback';
  end if;
end $$;

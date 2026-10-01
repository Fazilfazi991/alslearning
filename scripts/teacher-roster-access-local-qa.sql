-- Privileged, rollback-only acceptance for core_teacher_students effective access.
-- Run only against the existing dedicated ALS local QA container. Verify its
-- exact full Docker container ID, Compose project label, health, and the
-- 127.0.0.1:55322 -> 5432 mapping out of band. Read system_identifier from
-- that verified container before supplying it below. Example in psql, inside
-- a transaction started by the operator:
-- psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55322 -d postgres -U postgres \
--   -v guard_project=als_live_class_qa_20260924 \
--   -v guard_system_id=<verified-pg-system-identifier> \
--   -c 'BEGIN' -f scripts/teacher-roster-access-local-qa.sql -c 'ROLLBACK'
-- BEGIN must precede this file in the same psql session; ROLLBACK the
-- outer transaction afterward. This file also rolls back its own fixtures to
-- a SAVEPOINT, preserving other work in the outer transaction. Never run
-- against a linked or hosted database. Missing variables fail before writes.
select set_config('als_teacher_roster.guard_project', :'guard_project', true);
select set_config('als_teacher_roster.guard_system_id', :'guard_system_id', true);

do $$
declare
  project_id text := current_setting('als_teacher_roster.guard_project', true);
  system_id text := current_setting('als_teacher_roster.guard_system_id', true);
begin
  if project_id is distinct from 'als_live_class_qa_20260924'
     or current_database() <> 'postgres'
     or current_user <> 'postgres' then
    raise exception 'Refusing Teacher roster QA outside dedicated ALS local QA database';
  end if;
  if system_id is null or system_id !~ '^[0-9]{10,20}$'
     or (select system_identifier::text from pg_control_system())
       is distinct from system_id then
    raise exception 'Verified ALS local QA PostgreSQL system ID missing or mismatched';
  end if;
  if to_regprocedure('public.core_teacher_students(integer,integer,text)') is null then
    raise exception 'Teacher roster RPC is missing';
  end if;
end $$;
savepoint teacher_roster_qa_fixture;

do $$
declare
  label text := 'teacher-roster-' || replace(gen_random_uuid()::text, '-', '');
  teacher_id uuid := gen_random_uuid();
  other_teacher_id uuid := gen_random_uuid();
  active_program uuid := gen_random_uuid();
  draft_program uuid := gen_random_uuid();
  archived_program uuid := gen_random_uuid();
  program_id uuid;
  student_id uuid;
  active_student_id uuid;
  batch_id uuid;
  enrollment_id uuid;
  expected jsonb := '{}'::jsonb;
  expected_status text;
  batch_status public.batch_status;
begin
  insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
  values
    (teacher_id, label || '-teacher@example.invalid', '{"role":"teacher"}', '{"full_name":"Roster Teacher"}'),
    (other_teacher_id, label || '-other@example.invalid', '{"role":"teacher"}', '{"full_name":"Other Teacher"}');

  insert into public.programs(id, slug, name, status) values
    (active_program, label || '-active', label || ' Active Program', 'active'),
    (draft_program, label || '-draft', label || ' Draft Program', 'draft'),
    (archived_program, label || '-archived', label || ' Archived Program', 'archived');
  insert into public.faculty_assignments(faculty_id, program_id)
  values (teacher_id, active_program), (teacher_id, draft_program),
    (teacher_id, archived_program);

  -- One synthetic Student per row makes every enrollment and search result
  -- distinct while exercising the same one-row-per-program contract.
  for i in 1..16 loop
    student_id := gen_random_uuid();
    enrollment_id := gen_random_uuid();
    program_id := case i when 11 then draft_program
      when 15 then archived_program else active_program end;
    batch_id := null;
    batch_status := 'active';
    expected_status := case i
      when 3 then 'upcoming' when 4 then 'expired'
      when 5 then 'upcoming' when 6 then 'completed'
      when 7 then 'archived' when 8 then 'upcoming'
      when 9 then 'expired' when 10 then 'expired'
      when 11 then 'program_inactive' when 12 then 'suspended'
      when 13 then 'cancelled' when 14 then 'completed'
      when 15 then 'program_inactive' when 16 then 'student_inactive'
      else 'active' end;

    insert into auth.users(id, email, raw_app_meta_data, raw_user_meta_data)
    values (student_id,
      label || '-case-' || lpad(i::text, 2, '0') || '@example.invalid',
      '{"role":"student"}',
      jsonb_build_object('full_name', label || '-case-' || lpad(i::text, 2, '0')));
    if i = 1 then active_student_id := student_id; end if;
    if i = 16 then
      update public.profiles set is_active = false where id = student_id;
    end if;

    if i in (2, 5, 6, 7, 8, 9, 10) then
      batch_id := gen_random_uuid();
      batch_status := case i when 5 then 'upcoming'::public.batch_status
        when 6 then 'completed'::public.batch_status
        when 7 then 'archived'::public.batch_status
        else 'active'::public.batch_status end;
      insert into public.batches(id, program_id, slug, name, status,
        access_starts_at, access_expires_at, access_valid_until)
      values (batch_id, active_program, label || '-batch-' || i,
        'Roster batch ' || i, batch_status,
        case when i = 8 then now() + interval '1 day' else now() - interval '3 days' end,
        case when i = 9 then now() - interval '1 day' else null end,
        case when i = 10 then current_date - 1 else null end);
      insert into public.batch_faculty(batch_id, faculty_id)
      values (batch_id, teacher_id);
    end if;

    insert into public.enrollments(id, student_id, program_id, batch_id,
      status, access_starts_at, access_expires_at)
    values (enrollment_id, student_id, program_id, batch_id,
      case i when 12 then 'suspended'::public.enrollment_status
        when 13 then 'cancelled'::public.enrollment_status
        when 14 then 'completed'::public.enrollment_status
        else 'active'::public.enrollment_status end,
      case when i = 3 then now() + interval '1 day'
        else now() - interval '3 days' end,
      case when i = 4 then now() - interval '1 day' else null end);
    perform set_config('request.jwt.claim.sub', student_id::text, true);
    if coalesce(private.enrolled(program_id, batch_id), false)
       is distinct from (expected_status = 'active') then
      raise exception 'Student eligibility disagrees with expected roster state for case %', i;
    end if;
    expected := expected || jsonb_build_object(enrollment_id::text, expected_status);
  end loop;

  perform set_config('als_teacher_roster.teacher_id', teacher_id::text, true);
  perform set_config('als_teacher_roster.other_teacher_id', other_teacher_id::text, true);
  perform set_config('als_teacher_roster.student_id', active_student_id::text, true);
  perform set_config('als_teacher_roster.expected', expected::text, true);
  perform set_config('als_teacher_roster.search', label || '-case-01', true);
end $$;

select set_config('request.jwt.claim.sub',
  current_setting('als_teacher_roster.teacher_id'), true);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', current_setting('als_teacher_roster.teacher_id'),
  'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  roster jsonb := public.core_teacher_students(0, 50, '');
  actual jsonb;
  expected jsonb := current_setting('als_teacher_roster.expected')::jsonb;
  matched jsonb;
  first_page jsonb;
  second_page jsonb;
begin
  select coalesce(jsonb_object_agg(item.value->>'id', item.value->>'status'), '{}'::jsonb)
    into actual from jsonb_array_elements(roster->'rows') as item(value);
  if (roster->>'total')::integer <> 16 or actual is distinct from expected then
    raise exception 'Effective roster mismatch: expected %, got %', expected, actual;
  end if;

  matched := public.core_teacher_students(0, 25,
    current_setting('als_teacher_roster.search'));
  if (matched->>'total')::integer <> 1
     or jsonb_array_length(matched->'rows') <> 1 then
    raise exception 'Teacher roster search did not isolate one Student: %', matched;
  end if;
  first_page := public.core_teacher_students(0, 7, '');
  second_page := public.core_teacher_students(1, 7, '');
  if (first_page->>'total')::integer <> 16
     or jsonb_array_length(first_page->'rows') <> 7
     or jsonb_array_length(second_page->'rows') <> 7
     or exists (
       select 1 from jsonb_array_elements(first_page->'rows') as a(value)
       join jsonb_array_elements(second_page->'rows') as b(value)
         on a.value->>'id' = b.value->>'id'
     ) then
    raise exception 'Teacher roster pagination overlapped or lost rows';
  end if;
  raise notice 'Teacher effective roster: 16 statuses, search and pagination PASS';
end $$;

reset role;
select set_config('request.jwt.claim.sub',
  current_setting('als_teacher_roster.other_teacher_id'), true);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', current_setting('als_teacher_roster.other_teacher_id'),
  'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare roster jsonb := public.core_teacher_students(0, 50, '');
begin
  if (roster->>'total')::integer <> 0 or jsonb_array_length(roster->'rows') <> 0 then
    raise exception 'Unassigned Teacher saw roster rows: %', roster;
  end if;
  raise notice 'Unassigned Teacher roster isolation PASS';
end $$;

reset role;
select set_config('request.jwt.claim.sub',
  current_setting('als_teacher_roster.student_id'), true);
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', current_setting('als_teacher_roster.student_id'),
  'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.core_teacher_students(0, 25, '');
    raise exception 'Student unexpectedly called Teacher roster RPC';
  exception when others then
    if sqlerrm <> 'Teacher roster access denied' then
      raise;
    end if;
  end;
  raise notice 'Student roster denial PASS';
end $$;

reset role;
rollback to savepoint teacher_roster_qa_fixture;
release savepoint teacher_roster_qa_fixture;

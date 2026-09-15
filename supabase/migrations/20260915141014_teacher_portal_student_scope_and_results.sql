-- Teacher roster and result reads stay behind scoped RPCs. No new table grants
-- or broad profile/enrollment RLS paths are needed.
create function private.teacher_student_scope(target_student uuid, target_program uuid, target_batch uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and coalesce(private.active_role(), '') = 'teacher'
    and exists (
      select 1 from public.enrollments e
      where e.student_id = target_student and e.program_id = target_program
        and e.batch_id is not distinct from target_batch
    )
    and exists (
      select 1 from public.faculty_assignments f
      where f.faculty_id = (select auth.uid()) and f.program_id = target_program
    )
    and (target_batch is null or exists (
      select 1 from public.batch_faculty bf
      where bf.faculty_id = (select auth.uid()) and bf.batch_id = target_batch
    ))
$$;
revoke all on function private.teacher_student_scope(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create function public.core_teacher_students(page_number integer default 0,
  page_size integer default 25, search_text text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or coalesce(private.active_role(), '') <> 'teacher'
  then raise exception 'Teacher roster access denied'; end if;

  with scoped as (
    select e.id, e.student_id, e.status, e.access_starts_at,
      e.access_expires_at, p.full_name, p.email, pr.name as program_name,
      b.name as batch_name
    from public.enrollments e
    join public.profiles p on p.id = e.student_id and p.role = 'student'
    join public.programs pr on pr.id = e.program_id
    left join public.batches b on b.id = e.batch_id
    where private.teacher_student_scope(e.student_id, e.program_id, e.batch_id)
      and (btrim(coalesce(search_text, '')) = '' or
        coalesce(p.full_name, '') ilike '%' || btrim(search_text) || '%' or
        p.email ilike '%' || btrim(search_text) || '%' or
        pr.name ilike '%' || btrim(search_text) || '%')
  ), page_rows as (
    select * from scoped order by coalesce(full_name, email), id
    offset greatest(coalesce(page_number, 0), 0) * least(greatest(coalesce(page_size, 25), 1), 50)
    limit least(greatest(coalesce(page_size, 25), 1), 50)
  )
  select jsonb_build_object(
    'total', (select count(*) from scoped),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'student_id', student_id, 'name', coalesce(full_name, email),
      'email', email, 'program', program_name, 'batch', batch_name,
      'status', case when status <> 'active' then status::text
        when access_starts_at > now() then 'upcoming'
        when access_expires_at <= now() then 'expired' else 'active' end,
      'expires_at', access_expires_at
    ) order by coalesce(full_name, email), id) from page_rows), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.core_teacher_students(integer, integer, text)
  from public, anon, service_role;
grant execute on function public.core_teacher_students(integer, integer, text)
  to authenticated;

-- Admin still sees the full test result. A Teacher sees attempts only when the
-- test itself is authorized and the Student's enrollment is in Teacher scope.
create or replace function public.core_admin_test_results(target_test uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with allowed as (
    select a.* from public.test_attempts a
    join public.tests t on t.id = a.test_id
    where a.test_id = target_test
      and (public.is_admin() or exists (
        select 1 from public.enrollments e
        where e.student_id = a.student_id and e.program_id = t.program_id
          and private.teacher_student_scope(e.student_id, e.program_id, e.batch_id)
          and (not exists (select 1 from public.test_batches tb where tb.test_id = t.id)
            or exists (select 1 from public.test_batches tb
              where tb.test_id = t.id and tb.batch_id = e.batch_id))
      ))
  )
  select case when not private.test_access(target_test, true) then null
    else jsonb_build_object(
      'attempt_count', (select count(*) from allowed),
      'average_score', (select round(avg(a.score), 2) from allowed a
        where a.status <> 'in_progress'),
      'attempts', coalesce((select jsonb_agg(jsonb_build_object(
        'student', coalesce(p.full_name, p.email, 'Student'),
        'attempt_number', (select count(*) from public.test_attempts prior
          where prior.test_id = a.test_id and prior.student_id = a.student_id
            and prior.started_at <= a.started_at),
        'started_at', a.started_at, 'submitted_at', a.submitted_at,
        'score', a.score, 'correct', a.correct_count,
        'incorrect', a.incorrect_count, 'unanswered', a.unanswered_count,
        'status', a.status) order by a.started_at desc)
        from allowed a join public.profiles p on p.id = a.student_id), '[]'::jsonb)
    ) end
$$;
revoke all on function public.core_admin_test_results(uuid)
  from public, anon, service_role;
grant execute on function public.core_admin_test_results(uuid) to authenticated;

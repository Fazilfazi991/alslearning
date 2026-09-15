-- DHS Long Term is deliberately exam-neutral (programs.exam_id NULL), while
-- Teacher assignments can target JSO. Keep exact program and mapped Subject
-- checks; accept only this nullable exam relationship.
create or replace function public.has_program_access(target_program uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or private.enrolled(target_program) or (
    coalesce(private.active_role(), '') = 'teacher'
    and exists (
      select 1 from public.programs p
      join public.faculty_assignments f on f.faculty_id = (select auth.uid())
      where p.id = target_program
        and (f.program_id is null or f.program_id = p.id)
        and (f.exam_id is null or p.exam_id is null or f.exam_id = p.exam_id)
        and (f.subject_id is null or exists (
          select 1 from public.program_subjects ps
          where ps.program_id = p.id and ps.subject_id = f.subject_id
        ))
    )
  )
$$;
revoke all on function public.has_program_access(uuid)
  from public, anon, service_role;
grant execute on function public.has_program_access(uuid) to authenticated;

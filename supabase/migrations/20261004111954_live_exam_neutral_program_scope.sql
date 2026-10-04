-- Match the established nullable-exam program access rule for live scheduling.
-- DHS Long Term is deliberately exam-neutral; its explicit program/subject
-- Teacher assignments remain valid even when an assignment names JSO.
create or replace function public.teacher_has_live_assignment(target_program uuid,target_subject uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.programs p where p.id=target_program
    and (target_subject is null or exists(select 1 from public.program_subjects ps
      where ps.program_id=p.id and ps.subject_id=target_subject))
    and (public.is_admin() or (coalesce(private.active_role(),'')='teacher' and exists(
      select 1 from public.faculty_assignments f where f.faculty_id=(select auth.uid())
        and (f.program_id is null or f.program_id=p.id)
        and (f.exam_id is null or p.exam_id is null or f.exam_id=p.exam_id)
        and (f.subject_id is null or f.subject_id=target_subject)))))
$$;
revoke all on function public.teacher_has_live_assignment(uuid,uuid) from public,anon,service_role;
grant execute on function public.teacher_has_live_assignment(uuid,uuid) to authenticated;

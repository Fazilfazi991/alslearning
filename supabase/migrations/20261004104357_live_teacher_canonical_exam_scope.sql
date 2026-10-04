-- Live sessions store program/subject, so derive their exam from the program.
-- Keep the generic academic assignment predicate unchanged.
create function public.teacher_has_live_assignment(target_program uuid,target_subject uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.programs p where p.id=target_program
    and public.teacher_has_assignment(p.exam_id,target_program,target_subject,null))
$$;
revoke all on function public.teacher_has_live_assignment(uuid,uuid) from public,anon,service_role;
grant execute on function public.teacher_has_live_assignment(uuid,uuid) to authenticated;

drop policy live_sessions_authorized_insert on public.live_sessions;
create policy live_sessions_authorized_insert on public.live_sessions for insert to authenticated
with check(public.is_admin() or (faculty_id=(select auth.uid())
  and public.teacher_has_live_assignment(program_id,subject_id)));

create or replace function public.can_join_live(target_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.live_sessions s
    join public.profiles p on p.id=(select auth.uid()) and p.is_active
    where s.id=target_session and (
      p.role='admin'
      or (p.role='teacher' and s.faculty_id=p.id
        and (s.program_id is null or public.teacher_has_live_assignment(s.program_id,s.subject_id)))
      or (p.role='student' and s.status<>'cancelled'
        and private.enrolled(s.program_id,s.batch_id)
        and not exists(select 1 from public.live_participants lp
          where lp.session_id=s.id and lp.user_id=p.id and lp.removed_at is not null))
    ))
$$;

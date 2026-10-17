-- INSERT RETURNING evaluates SELECT RLS before a STABLE lookup can see the
-- newly inserted row. Staff ownership is available directly on the row.
drop policy live_sessions_scoped_read on public.live_sessions;
create policy live_sessions_scoped_read on public.live_sessions for select to authenticated using(
  public.is_admin() or (faculty_id=(select auth.uid()) and private.active_role()='teacher'
    and public.teacher_has_live_assignment(program_id,subject_id))
  or public.live_class_eligibility(id,'view'));

-- History is the effective membership boundary; future enrollment starts and
-- closed assignments never confer current live access.
create function private.live_current_enrolled(target_program uuid,target_batch uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.enrolled(target_program,target_batch) and target_batch is not null and exists(
  select 1 from public.enrollments e join public.student_batch_history h on h.enrollment_id=e.id
  where e.student_id=(select auth.uid()) and e.program_id=target_program and e.batch_id=target_batch and e.status='active'
    and h.batch_id=target_batch and h.effective_at<=now() and (h.ended_at is null or h.ended_at>now()))
$$;
revoke all on function private.live_current_enrolled(uuid,uuid) from public,anon,authenticated;
create or replace function private.live_class_scope(target_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.live_sessions s join public.profiles p on p.id=(select auth.uid()) and p.is_active
 where s.id=target_session and (p.role='admin' or (p.role='teacher' and s.faculty_id=p.id and public.teacher_has_live_assignment(s.program_id,s.subject_id))
 or (p.role='student' and s.status<>'cancelled'
   and not exists(select 1 from public.live_participants lp where lp.session_id=s.id and lp.user_id=p.id and lp.removed_at is not null)
   and (private.live_current_enrolled(s.program_id,s.batch_id) or (s.status='completed'
     and private.enrolled(s.program_id) and exists(select 1 from public.student_batch_history h
       where h.student_id=p.id and h.program_id=s.program_id and h.batch_id=s.batch_id
       and h.effective_at<=coalesce(s.started_at,s.starts_at,s.created_at)
       and (h.ended_at is null or h.ended_at>coalesce(s.started_at,s.starts_at,s.created_at))))))))
$$;
create or replace function public.live_class_eligibility(target_session uuid,operation text default 'view') returns boolean
language sql stable security definer set search_path='' as $$
 select operation in ('view','connect','playback') and private.live_class_scope(target_session)
   and exists(select 1 from public.live_sessions s where s.id=target_session
     and case operation when 'connect' then public.live_class_state(s.status,s.join_opens_at,s.ended_at)='live'
       and (private.active_role()<>'student' or private.live_current_enrolled(s.program_id,s.batch_id))
       when 'playback' then s.status<>'cancelled' else true end)
$$;

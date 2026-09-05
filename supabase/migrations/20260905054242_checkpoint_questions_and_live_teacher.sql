drop policy if exists questions_scoped_read on public.questions;
create policy questions_scoped_read on public.questions for select to authenticated using(
  public.teacher_has_assignment(exam_id,program_id,subject_id,'questions')
  or exists(select 1 from public.test_questions tq join public.tests t on t.id=tq.test_id where tq.question_id=questions.id and t.status='active' and public.has_program_access(t.program_id))
  or exists(select 1 from public.video_checkpoints vc join public.learning_content c on c.id=vc.video_id where vc.question_id=questions.id and c.status='active' and public.has_program_access(c.program_id))
);

do $$ declare op text; begin foreach op in array array['insert','update','delete'] loop execute format('drop policy if exists %I on public.live_sessions','live_sessions_admin_'||op);end loop;end $$;
create policy live_sessions_authorized_insert on public.live_sessions for insert to authenticated with check(public.is_admin() or (faculty_id=(select auth.uid()) and public.teacher_has_assignment(null,program_id,subject_id,null)));
create policy live_sessions_authorized_update on public.live_sessions for update to authenticated using(public.is_admin() or faculty_id=(select auth.uid())) with check(public.is_admin() or faculty_id=(select auth.uid()));
create policy live_sessions_authorized_delete on public.live_sessions for delete to authenticated using(public.is_admin() or faculty_id=(select auth.uid()));

do $$ declare op text; begin foreach op in array array['insert','update','delete'] loop execute format('drop policy if exists %I on public.live_questions','live_questions_admin_'||op);end loop;end $$;
create policy live_questions_teacher_insert on public.live_questions for insert to authenticated with check(public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));
create policy live_questions_teacher_update on public.live_questions for update to authenticated using(public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))) with check(public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));
create policy live_questions_teacher_delete on public.live_questions for delete to authenticated using(public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));

drop policy if exists live_participants_admin_update on public.live_participants;
create policy live_participants_teacher_update on public.live_participants for update to authenticated using(public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))) with check(public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));

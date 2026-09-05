-- Remove API access to an unrelated privileged helper reported by advisors.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- ALL policies overlap SELECT policies and make access intent hard to audit.
do $$ declare t text; begin
  foreach t in array array['profiles','entrance_exams','programs','subjects','program_subjects','chapters','topics','faculty_assignments','batches','batch_faculty','enrollments','learning_content','content_batch_access','questions','question_options','tests','test_batches','test_questions','video_checkpoints','live_sessions','live_participants','live_questions','class_recordings'] loop
    execute format('drop policy if exists %I on public.%I',case when t='profiles' then 'profiles_admin_write' else t||'_admin_manage' end,t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())',t||'_admin_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',t||'_admin_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())',t||'_admin_delete',t);
  end loop;
end $$;

create function public.teacher_has_assignment(target_exam uuid,target_program uuid,target_subject uuid,permission text default null)
returns boolean language sql stable security invoker set search_path='' as $$
  select public.is_admin() or exists(
    select 1 from public.faculty_assignments f
    where f.faculty_id=(select auth.uid())
      and (target_exam is null or f.exam_id=target_exam or f.exam_id is null)
      and (target_program is null or f.program_id=target_program or f.program_id is null)
      and (target_subject is null or f.subject_id=target_subject or f.subject_id is null)
      and case permission when 'content' then f.can_manage_content when 'questions' then f.can_manage_questions when 'tests' then f.can_manage_tests else true end
  )
$$;

drop policy if exists enrollments_own_read on public.enrollments;
create policy enrollments_scoped_read on public.enrollments for select to authenticated using(
  student_id=(select auth.uid()) or public.is_admin() or public.teacher_has_assignment(null,program_id,null,null)
);
drop policy if exists questions_teacher_read on public.questions;
create policy questions_scoped_read on public.questions for select to authenticated using(
  public.teacher_has_assignment(exam_id,program_id,subject_id,'questions') or exists(
    select 1 from public.test_questions tq join public.tests t on t.id=tq.test_id
    where tq.question_id=questions.id and t.status='active' and public.has_program_access(t.program_id)
  )
);
drop policy if exists options_teacher_read on public.question_options;
create policy options_scoped_read on public.question_options for select to authenticated using(
  exists(select 1 from public.questions q where q.id=question_id)
);
drop policy if exists content_permitted_read on public.learning_content;
create policy content_permitted_read on public.learning_content for select to authenticated using(
  public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'content')
  or (status='active' and public.has_program_access(program_id))
);
drop policy if exists tests_permitted_read on public.tests;
create policy tests_permitted_read on public.tests for select to authenticated using(
  public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'tests')
  or (status='active' and public.has_program_access(program_id))
);

create policy batch_faculty_scoped_read on public.batch_faculty for select to authenticated using(
  public.is_admin() or faculty_id=(select auth.uid()) or exists(select 1 from public.enrollments e where e.batch_id=batch_id and e.student_id=(select auth.uid()) and e.status='active')
);
create policy content_batch_scoped_read on public.content_batch_access for select to authenticated using(
  public.is_admin() or exists(select 1 from public.learning_content c where c.id=content_id)
);
create policy test_batches_scoped_read on public.test_batches for select to authenticated using(
  public.is_admin() or exists(select 1 from public.tests t where t.id=test_id)
);
create policy checkpoints_scoped_read on public.video_checkpoints for select to authenticated using(
  public.is_admin() or exists(select 1 from public.learning_content c where c.id=video_id)
);
create policy live_sessions_scoped_read on public.live_sessions for select to authenticated using(
  public.is_admin() or faculty_id=(select auth.uid()) or exists(select 1 from public.enrollments e where e.batch_id=live_sessions.batch_id and e.student_id=(select auth.uid()) and e.status='active')
);
create policy live_participants_scoped_read on public.live_participants for select to authenticated using(
  user_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
);
create policy live_questions_scoped_read on public.live_questions for select to authenticated using(
  public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and (s.faculty_id=(select auth.uid()) or exists(select 1 from public.enrollments e where e.batch_id=s.batch_id and e.student_id=(select auth.uid()) and e.status='active')))
);
create policy recordings_ready_read on public.class_recordings for select to authenticated using(
  public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
  or (status='ready' and exists(select 1 from public.live_sessions s join public.enrollments e on e.batch_id=s.batch_id where s.id=session_id and e.student_id=(select auth.uid()) and e.status='active'))
);

-- Own-row mutation policies must not use FOR ALL because that implicitly adds broad SELECT paths.
drop policy if exists progress_own_manage on public.video_progress;
create policy progress_own_select on public.video_progress for select to authenticated using(student_id=(select auth.uid()) or public.is_admin());
create policy progress_own_insert on public.video_progress for insert to authenticated with check(student_id=(select auth.uid()));
create policy progress_own_update on public.video_progress for update to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));
drop policy if exists attempts_own_manage on public.test_attempts;
create policy attempts_own_select on public.test_attempts for select to authenticated using(student_id=(select auth.uid()) or public.is_admin());
create policy attempts_own_insert on public.test_attempts for insert to authenticated with check(student_id=(select auth.uid()) and exists(select 1 from public.tests t where t.id=test_id));
create policy attempts_own_update on public.test_attempts for update to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));
drop policy if exists answers_own_manage on public.attempt_answers;
create policy answers_own_select on public.attempt_answers for select to authenticated using(exists(select 1 from public.test_attempts a where a.id=attempt_id and (a.student_id=(select auth.uid()) or public.is_admin())));
create policy answers_own_insert on public.attempt_answers for insert to authenticated with check(exists(select 1 from public.test_attempts a where a.id=attempt_id and a.student_id=(select auth.uid())));
create policy answers_own_update on public.attempt_answers for update to authenticated using(exists(select 1 from public.test_attempts a where a.id=attempt_id and a.student_id=(select auth.uid()))) with check(exists(select 1 from public.test_attempts a where a.id=attempt_id and a.student_id=(select auth.uid())));
drop policy if exists checkpoint_own_manage on public.checkpoint_responses;
create policy checkpoint_own_select on public.checkpoint_responses for select to authenticated using(student_id=(select auth.uid()) or public.is_admin());
create policy checkpoint_own_insert on public.checkpoint_responses for insert to authenticated with check(student_id=(select auth.uid()));
create policy checkpoint_own_update on public.checkpoint_responses for update to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));
drop policy if exists live_responses_own_manage on public.live_question_responses;
create policy live_responses_own_select on public.live_question_responses for select to authenticated using(student_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_questions lq join public.live_sessions s on s.id=lq.session_id where lq.id=live_question_id and s.faculty_id=(select auth.uid())));
create policy live_responses_own_insert on public.live_question_responses for insert to authenticated with check(student_id=(select auth.uid()));
create policy live_responses_own_update on public.live_question_responses for update to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));

grant execute on function public.teacher_has_assignment(uuid,uuid,uuid,text) to authenticated;

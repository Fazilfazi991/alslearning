-- Content authorship is required for storage and teacher auditability.
alter table public.learning_content alter column created_by set default auth.uid();
alter table public.questions alter column created_by set default auth.uid();
alter table public.tests alter column created_by set default auth.uid();

do $$ declare op text; begin
  foreach op in array array['insert','update','delete'] loop
    execute format('drop policy if exists %I on public.learning_content','learning_content_admin_'||op);
    execute format('drop policy if exists %I on public.questions','questions_admin_'||op);
    execute format('drop policy if exists %I on public.tests','tests_admin_'||op);
  end loop;
end $$;
create policy content_authorized_insert on public.learning_content for insert to authenticated with check(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'content'));
create policy content_authorized_update on public.learning_content for update to authenticated using(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'content')) with check(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'content'));
create policy content_authorized_delete on public.learning_content for delete to authenticated using(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'content'));
create policy questions_authorized_insert on public.questions for insert to authenticated with check(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'questions'));
create policy questions_authorized_update on public.questions for update to authenticated using(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'questions')) with check(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'questions'));
create policy questions_authorized_delete on public.questions for delete to authenticated using(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'questions'));
create policy tests_authorized_insert on public.tests for insert to authenticated with check(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'tests'));
create policy tests_authorized_update on public.tests for update to authenticated using(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'tests')) with check(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'tests'));
create policy tests_authorized_delete on public.tests for delete to authenticated using(public.is_admin() or public.teacher_has_assignment(exam_id,program_id,subject_id,'tests'));

do $$ declare op text; begin foreach op in array array['insert','update','delete'] loop execute format('drop policy if exists %I on public.question_options','question_options_admin_'||op);end loop;end $$;
create policy options_authorized_insert on public.question_options for insert to authenticated with check(exists(select 1 from public.questions q where q.id=question_id and (public.is_admin() or public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))));
create policy options_authorized_update on public.question_options for update to authenticated using(exists(select 1 from public.questions q where q.id=question_id and (public.is_admin() or public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions')))) with check(exists(select 1 from public.questions q where q.id=question_id and (public.is_admin() or public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))));
create policy options_authorized_delete on public.question_options for delete to authenticated using(exists(select 1 from public.questions q where q.id=question_id and (public.is_admin() or public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))));

drop policy if exists learning_storage_owner_read on storage.objects;
create policy learning_storage_permitted_read on storage.objects for select to authenticated using(
  bucket_id in ('learning-content','class-recordings') and (
    public.is_admin() or owner_id=(select auth.uid())::text or exists(
      select 1 from public.learning_content c where c.storage_bucket=bucket_id and c.storage_path=name
    )
  )
);
drop policy if exists learning_storage_admin_insert on storage.objects;
create policy learning_storage_authorized_insert on storage.objects for insert to authenticated with check(
  bucket_id in ('learning-content','class-recordings') and (public.is_admin() or exists(
    select 1 from public.learning_content c where c.storage_bucket=bucket_id and c.storage_path=name and c.created_by=(select auth.uid())
  ))
);

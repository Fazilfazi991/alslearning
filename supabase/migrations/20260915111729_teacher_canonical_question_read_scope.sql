-- Canonical questions deliberately have no Program ownership. Keep the existing
-- exact-program authoring helper unchanged; this helper is for reads only.
create function private.teacher_question_read_scope(
  target_exam uuid,
  target_program uuid,
  target_subject uuid
) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
    (select auth.uid()) is not null
    and coalesce(private.active_role(), '') = 'teacher'
    and target_subject is not null
    and exists (
      select 1 from public.faculty_assignments f
      where f.faculty_id = (select auth.uid())
        and f.can_manage_questions
        and f.subject_id = target_subject
        and (f.exam_id is null or f.exam_id = target_exam)
        and (target_program is null or f.program_id = target_program)
    )
  )
$$;

revoke execute on function private.teacher_question_read_scope(uuid, uuid, uuid)
  from public, anon, service_role;
grant execute on function private.teacher_question_read_scope(uuid, uuid, uuid)
  to authenticated;

alter policy question_staff_read on public.questions
  using (private.teacher_question_read_scope(exam_id, program_id, subject_id));

-- Storage signing evaluates this helper separately from question RLS. Preserve
-- Admin, Teacher-owned uploads, and Student attempt/review authorization.
create or replace function private.image_access(path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.is_admin() or (coalesce(private.active_role(),'')='teacher' and (split_part(path,'/',1)=auth.uid()::text or exists(select 1 from public.questions q where (q.stem_image_path=path or q.explanation_image_path=path or exists(select 1 from public.question_media m where m.question_id=q.id and (m.storage_path=path or m.source#>>'{original,storage_path}'=path))) and private.teacher_question_read_scope(q.exam_id,q.program_id,q.subject_id))))
 or (coalesce(private.active_role(),'')='student' and exists(select 1 from private.attempt_snapshots s join public.test_attempts a on a.id=s.attempt_id,jsonb_array_elements(s.questions) q where a.student_id=auth.uid() and private.attempt_access(a.test_id) and ((q->>'stem_image_path'=path or exists(select 1 from jsonb_array_elements(coalesce(q->'stem_media','[]')) m where (m->>'storage_path'=path or m#>>'{source,original,storage_path}'=path))) or (a.status<>'in_progress' and (s.review_settings->>'show_answers')::boolean and (s.review_settings->>'show_explanations')::boolean and (q->>'explanation_image_path'=path or exists(select 1 from jsonb_array_elements(coalesce(q->'solution_media','[]')) m where (m->>'storage_path'=path or m#>>'{source,original,storage_path}'=path)))))))
$$;

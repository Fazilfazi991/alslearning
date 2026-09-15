-- The Question Bank editor needs labels for the Exam and Program named by a
-- Teacher's question assignment. DHS Long Term currently has exam_id NULL, so
-- the general has_program_access helper cannot provide those labels. Keep that
-- helper and its content/test/write semantics unchanged.
create function private.teacher_question_taxonomy_read(
  target_exam uuid,
  target_program uuid
) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and coalesce(private.active_role(), '') = 'teacher'
    and (target_exam is not null or target_program is not null)
    and exists (
      select 1 from public.faculty_assignments f
      where f.faculty_id = (select auth.uid())
        and f.can_manage_questions
        and f.subject_id is not null
        and (target_exam is null or f.exam_id = target_exam)
        and (target_program is null or f.program_id = target_program)
    )
$$;

revoke execute on function private.teacher_question_taxonomy_read(uuid, uuid)
  from public, anon, service_role;
grant execute on function private.teacher_question_taxonomy_read(uuid, uuid)
  to authenticated;

create policy teacher_question_exam_metadata_read
  on public.entrance_exams for select to authenticated
  using (private.teacher_question_taxonomy_read(id, null::uuid));

create policy teacher_question_program_metadata_read
  on public.programs for select to authenticated
  using (private.teacher_question_taxonomy_read(null::uuid, id));

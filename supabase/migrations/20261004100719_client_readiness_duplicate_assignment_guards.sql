-- Retain every existing record. A duplicate in another environment aborts this
-- migration for review rather than silently merging or deleting client data.
create unique index if not exists enrollments_student_program_batch_unique
  on public.enrollments (student_id, program_id, batch_id) nulls not distinct;
create unique index if not exists faculty_assignments_teacher_scope_unique
  on public.faculty_assignments (faculty_id, exam_id, program_id, subject_id) nulls not distinct;

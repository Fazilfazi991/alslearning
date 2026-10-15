-- Historical assignments may revisit the same batch. Only the current active
-- assignment is unique; retain every inactive enrollment and its references.
begin;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='enrollments_one_active_program'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ) then
    raise exception 'Active program assignment uniqueness must exist before removing historical uniqueness';
  end if;
end $$;

alter table public.enrollments
  drop constraint if exists enrollments_student_id_program_id_batch_id_key;
drop index if exists public.enrollments_student_program_batch_unique;

commit;

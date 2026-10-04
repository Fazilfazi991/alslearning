-- A batch with any assignment, enrollment, content/test scope, or class is
-- historical access state. Deleting it must never null or cascade those links.
-- Keep the existing FK names so PostgREST relationship hints stay stable.
begin;
set local lock_timeout = '5s';
lock table public.batches, public.batch_faculty, public.enrollments,
  public.content_batch_access, public.test_batches, public.live_sessions
  in access exclusive mode;

-- Abort on schema drift: a sixth batch reference or a changed FK action needs
-- its own review before this migration can safely run.
do $$
declare
  ref record;
  actual_count integer;
begin
  select count(*) into actual_count
  from pg_constraint
  where contype = 'f' and confrelid = 'public.batches'::regclass;
  if actual_count <> 5 then
    raise exception 'Expected five direct batch foreign keys, found %', actual_count;
  end if;

  for ref in
    select * from (values
      ('batch_faculty', 'c'::"char"),
      ('enrollments', 'n'::"char"),
      ('content_batch_access', 'c'::"char"),
      ('test_batches', 'c'::"char"),
      ('live_sessions', 'n'::"char")
    ) as expected(table_name, delete_action)
  loop
    if not exists (
      select 1
      from pg_constraint c
      join pg_attribute child_column
        on child_column.attrelid = c.conrelid and child_column.attname = 'batch_id'
      join pg_attribute parent_column
        on parent_column.attrelid = c.confrelid and parent_column.attname = 'id'
      where c.contype = 'f'
        and c.conname = ref.table_name || '_batch_id_fkey'
        and c.conrelid = format('public.%I', ref.table_name)::regclass
        and c.confrelid = 'public.batches'::regclass
        and c.conkey = array[child_column.attnum]::smallint[]
        and c.confkey = array[parent_column.attnum]::smallint[]
        and c.confdeltype = ref.delete_action
        and not c.condeferrable
    ) then
      raise exception 'Unexpected batch foreign key on public.%', ref.table_name;
    end if;
  end loop;
end $$;

alter table public.batch_faculty
  drop constraint batch_faculty_batch_id_fkey,
  add constraint batch_faculty_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;

alter table public.enrollments
  drop constraint enrollments_batch_id_fkey,
  add constraint enrollments_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;

alter table public.content_batch_access
  drop constraint content_batch_access_batch_id_fkey,
  add constraint content_batch_access_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;

alter table public.test_batches
  drop constraint test_batches_batch_id_fkey,
  add constraint test_batches_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;

alter table public.live_sessions
  drop constraint live_sessions_batch_id_fkey,
  add constraint live_sessions_batch_id_fkey
    foreign key (batch_id) references public.batches(id) on delete restrict;

commit;

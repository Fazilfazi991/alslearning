-- Preserve explicitly reviewed Unassigned accounts and report every proposed
-- legacy batch code before applying any identity backfill.
drop function public.lms_student_code_backfill(boolean);
create function public.lms_student_code_backfill(
  dry_run boolean default true, approved_unassigned uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare missing jsonb; pending jsonb; proposals jsonb; collisions jsonb;
  person record; batch record; candidate text; assigned integer:=0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin required' using errcode='42501';
  end if;
  lock table public.profiles in share row exclusive mode;
  lock table public.batches in share row exclusive mode;
  approved_unassigned:=coalesce(approved_unassigned,'{}'::uuid[]);
  select coalesce(jsonb_agg(jsonb_build_object('student_id',p.id,'name',p.full_name)), '[]')
  into missing from public.profiles p
  where p.role='student' and p.student_code is null
    and not(p.id=any(approved_unassigned))
    and not exists(select 1 from public.enrollments e where e.student_id=p.id and e.batch_id is not null);
  select coalesce(jsonb_agg(jsonb_build_object('student_id',p.id,'name',p.full_name,
    'state','Unassigned — permanent code pending admission batch')), '[]')
  into pending from public.profiles p where p.role='student' and p.student_code is null
    and p.id=any(approved_unassigned)
    and not exists(select 1 from public.enrollments e where e.student_id=p.id and e.batch_id is not null);
  select coalesce(jsonb_agg(jsonb_build_object('batch_id',b.id,'name',b.name,'proposed_batch_code',
    left(regexp_replace(upper(b.slug),'[^A-Z0-9]','','g'),8)||upper(left(replace(b.id::text,'-',''),8)))),'[]')
  into proposals from public.batches b where b.batch_code is null;
  select coalesce(jsonb_agg(x),'[]') into collisions from (
    select q.value as proposal from jsonb_array_elements(proposals) q(value)
    where exists(select 1 from public.batches b where b.batch_code=q.value->>'proposed_batch_code')
      or (select count(*) from jsonb_array_elements(proposals) p
          where p->>'proposed_batch_code'=q.value->>'proposed_batch_code')>1
  ) x;
  if dry_run then return jsonb_build_object('dry_run',true,
    'clean',jsonb_array_length(missing)=0 and jsonb_array_length(collisions)=0,
    'students_without_batch',missing,'reviewed_unassigned',pending,
    'batch_code_collisions',collisions,'batch_code_proposals',proposals,
    'students_to_assign',(select count(*) from public.profiles p where p.role='student' and p.student_code is null
      and exists(select 1 from public.enrollments e where e.student_id=p.id and e.batch_id is not null)));
  end if;
  if jsonb_array_length(missing)>0 or jsonb_array_length(collisions)>0 then
    raise exception 'Backfill blocked: review missing admission batches or Batch Code collisions';
  end if;
  perform set_config('als.change_reason','Reviewed Student Code backfill; original identity retained',true);
  for batch in select id,slug from public.batches where batch_code is null order by id loop
    candidate:=left(regexp_replace(upper(batch.slug),'[^A-Z0-9]','','g'),8)||upper(left(replace(batch.id::text,'-',''),8));
    update public.batches set batch_code=candidate where id=batch.id;
  end loop;
  for person in select p.id from public.profiles p where p.role='student' and p.student_code is null
    and exists(select 1 from public.enrollments e where e.student_id=p.id and e.batch_id is not null)
    order by p.created_at,p.id loop
    select e.batch_id into batch from public.enrollments e where e.student_id=person.id and e.batch_id is not null
      order by e.enrolled_on,e.created_at,e.id limit 1;
    perform private.lms_assign_student_code(person.id,batch.batch_id); assigned:=assigned+1;
  end loop;
  insert into public.lms_audit_events(actor_id,entity_table,entity_id,action,new_value,reason)
  select auth.uid(),'profiles',(p->>'student_id')::uuid,'identity_unassigned_review',p,
    'Explicitly retained as Unassigned; no admission batch invented'
  from jsonb_array_elements(pending) p;
  return jsonb_build_object('dry_run',false,'assigned',assigned,'reviewed_unassigned',pending);
end $$;
revoke all on function public.lms_student_code_backfill(boolean,uuid[]) from public,anon,service_role;
grant execute on function public.lms_student_code_backfill(boolean,uuid[]) to authenticated;

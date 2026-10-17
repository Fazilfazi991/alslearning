create function private.lms_batch_capacity_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.max_students is distinct from old.max_students and new.max_students is not null
   and new.max_students<private.batch_occupancy(new.id,now()) then
   raise exception 'Capacity cannot be below the current active Student count' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.lms_batch_capacity_guard() from public,anon,authenticated,service_role;
create trigger a_lms_batch_capacity_guard before update on public.batches for each row execute function private.lms_batch_capacity_guard();
-- Keep an installed older batch-edit guard consistent with the same occupancy.
do $$
declare source text; old_clause text:='(select count(*) from public.enrollments where batch_id=new.id and status=''active'')';
begin
 if to_regprocedure('private.erp_batch_capacity_guard()') is not null then
   select pg_get_functiondef('private.erp_batch_capacity_guard()'::regprocedure) into source;
   if position(old_clause in source)=0 then raise exception 'Unexpected legacy batch capacity guard; review before changing it'; end if;
   execute replace(source,old_clause,'private.batch_occupancy(new.id,now())');
 end if;
end $$;

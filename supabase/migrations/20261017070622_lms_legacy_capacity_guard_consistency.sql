-- Some staging installations have an older enrollment guard installed alongside
-- the LMS guard. Retain every other check, changing only its duplicate capacity
-- calculation. No ERP tables, routes, permissions or branch are introduced.
do $$
declare source text; old_clause text:='b.max_students is not null and (select count(*) from public.enrollments where batch_id=b.id and status=''active'' and id<>new.id)';
begin
 if to_regprocedure('private.erp_enrollment_guard()') is not null then
   select pg_get_functiondef('private.erp_enrollment_guard()'::regprocedure) into source;
   if position(old_clause in source)=0 then raise exception 'Unexpected legacy enrollment guard; review before changing it'; end if;
   source:=replace(source,old_clause,'(new.access_starts_at is null or new.access_starts_at<=now()) and (new.access_expires_at is null or new.access_expires_at>now()) and b.max_students is not null and private.batch_occupancy(b.id,now(),new.student_id)');
   execute source;
 end if;
end $$;

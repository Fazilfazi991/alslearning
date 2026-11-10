-- Additive capacity protection; generated with the official Supabase CLI.
-- Count future active enrollments as reserved seats and preserve stricter legacy guards.
-- Serialize the preflight and trigger installation with all capacity-changing
-- writes. Timeout instead of blocking a busy system indefinitely.
set local lock_timeout='5s';
lock table public.profiles,public.batches,public.enrollments in share row exclusive mode;
create index lms_reserved_capacity_active_batch_idx on public.enrollments(batch_id,student_id) where status='active';
-- Recognize only reviewed baseline or staged guard definitions; future drift
-- fails closed until its capacity behavior is reviewed explicitly.
create function private.lms_capacity_legacy_row_mode() returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare fingerprint text; legacy boolean:=false;
begin
 select md5(replace(p.prosrc,chr(13),'')) into fingerprint from pg_catalog.pg_proc p where p.oid=to_regprocedure('private.lms_enrollment_capacity_guard()');
 if fingerprint is null or fingerprint not in ('a75e0f27d0e6e1e872f84157e00133d9','d433aed136aea81a44aaf1ef9bd358ee')
  or not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.enrollments'::regclass and tgname='a_lms_enrollment_capacity_guard' and tgfoid=to_regprocedure('private.lms_enrollment_capacity_guard()') and tgtype=23 and tgenabled in ('O','A')) then
  raise exception 'Unrecognized enrollment capacity guard; review required'; end if;
 legacy:=fingerprint='a75e0f27d0e6e1e872f84157e00133d9';
 if exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.enrollments'::regclass and tgfoid=to_regprocedure('private.erp_enrollment_guard()') and tgenabled in ('O','A')) then
  select md5(replace(p.prosrc,chr(13),'')) into fingerprint from pg_catalog.pg_proc p where p.oid=to_regprocedure('private.erp_enrollment_guard()');
  if fingerprint not in ('89ec1f484362fe0c136aa8b3058a5bea','416242e833106fc2788f9e74038d4518') then raise exception 'Unrecognized ERP enrollment guard; review required'; end if;
  legacy:=legacy or fingerprint='89ec1f484362fe0c136aa8b3058a5bea';
 end if;
 if exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.batches'::regclass and tgfoid=to_regprocedure('private.erp_batch_capacity_guard()') and tgenabled in ('O','A')) then
  select md5(replace(p.prosrc,chr(13),'')) into fingerprint from pg_catalog.pg_proc p where p.oid=to_regprocedure('private.erp_batch_capacity_guard()');
  if fingerprint not in ('0e78bb91afbd15fb745d0cbd5c8b7b07','0db4337c8157ff992176377c778bae88') then raise exception 'Unrecognized ERP batch guard; review required'; end if;
  legacy:=legacy or fingerprint='0e78bb91afbd15fb745d0cbd5c8b7b07';
 end if;
 return legacy;
end $$;
revoke all on function private.lms_capacity_legacy_row_mode() from public,anon,authenticated,service_role;
create function private.lms_reserved_capacity_count(p_batch_id uuid,p_at timestamptz,p_exclude uuid default null) returns bigint
language plpgsql volatile security definer set search_path='' as $$
declare reserved bigint; legacy_rows bigint:=0;
begin
 select count(distinct e.student_id) into reserved from public.enrollments e
 join public.profiles p on p.id=e.student_id and p.role='student' and p.is_active
 where e.batch_id=p_batch_id and e.status='active' and e.student_id is distinct from p_exclude
 and (e.access_expires_at is null or e.access_expires_at>p_at);
 if private.lms_capacity_legacy_row_mode() then
  select count(*) into legacy_rows from public.enrollments e where e.batch_id=p_batch_id and e.status='active' and e.student_id is distinct from p_exclude;
 end if;
 return greatest(reserved,legacy_rows);
end
$$;
revoke all on function private.lms_reserved_capacity_count(uuid,timestamptz,uuid) from public,anon,authenticated,service_role;

-- Do not install on data already beyond the new conservative reservation rule.
do $$ begin
 perform private.lms_capacity_legacy_row_mode();
 if exists(select 1 from public.batches b where b.max_students is not null and private.lms_reserved_capacity_count(b.id,clock_timestamp(),null)>b.max_students) then
  raise exception 'Resolve over-capacity reservations before installing capacity protection';
 end if;
end $$;

create function private.lms_reserved_capacity_enrollment_guard() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare b public.batches; student_active boolean; checked_at timestamptz;
begin
 if new.batch_id is null or new.status<>'active' then return new; end if;
 -- Serialize with reactivation/deactivation. The existing enrollment guard
 -- already acquires the batch lock. Deadlocks fail closed via rollback.
 select p.is_active and p.role='student' into student_active from public.profiles p where p.id=new.student_id for share;
 if not coalesce(student_active,false) then return new; end if;
 select * into b from public.batches where id=new.batch_id for update;
 if not found then raise exception 'Batch unavailable' using errcode='23514'; end if;
 checked_at:=clock_timestamp();
 if b.max_students is not null and private.lms_reserved_capacity_count(b.id,checked_at,null)>b.max_students then
  raise exception 'This batch has no unreserved seats. Choose another batch.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.lms_reserved_capacity_enrollment_guard() from public,anon,authenticated,service_role;
create trigger z_als_reserved_capacity_enrollment after insert or update on public.enrollments for each row execute function private.lms_reserved_capacity_enrollment_guard();

create function private.lms_reserved_capacity_reactivation_guard() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare b public.batches; checked_at timestamptz;
begin
 if new.role<>'student' or not new.is_active or (old.role='student' and old.is_active) then return new; end if;
 for b in select batches.* from public.batches batches where exists(select 1 from public.enrollments e where e.batch_id=batches.id and e.student_id=new.id and e.status='active' and (e.access_expires_at is null or e.access_expires_at>clock_timestamp())) order by batches.id for update of batches loop
  checked_at:=clock_timestamp();
  if b.max_students is not null and private.lms_reserved_capacity_count(b.id,checked_at,new.id)>=b.max_students then
   raise exception 'This batch has no unreserved seats. Reactivation was not applied.' using errcode='23514'; end if;
 end loop;
 return new;
end $$;
revoke all on function private.lms_reserved_capacity_reactivation_guard() from public,anon,authenticated,service_role;
create trigger z_als_reserved_capacity_reactivation before update of is_active,role on public.profiles for each row execute function private.lms_reserved_capacity_reactivation_guard();

create function private.lms_reserved_capacity_batch_guard() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if new.max_students is distinct from old.max_students and new.max_students is not null and private.lms_reserved_capacity_count(new.id,clock_timestamp(),null)>new.max_students then
  raise exception 'Capacity cannot be below reserved student seats.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.lms_reserved_capacity_batch_guard() from public,anon,authenticated,service_role;
create trigger z_als_reserved_capacity_batch before update of max_students on public.batches for each row execute function private.lms_reserved_capacity_batch_guard();

create function private.registration_batch_occupancy() returns table(batch_id uuid,occupied bigint,capacity integer)
language plpgsql volatile security definer set search_path='' as $$
declare checked_at timestamptz;
begin
 if not private.registration_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 checked_at:=clock_timestamp();
 return query select b.id,private.lms_reserved_capacity_count(b.id,checked_at,null),b.max_students from public.batches b;
end $$;
revoke all on function private.registration_batch_occupancy() from public,anon,service_role;
grant execute on function private.registration_batch_occupancy() to authenticated;
create function public.registration_batch_occupancy() returns table(batch_id uuid,occupied bigint,capacity integer)
language sql volatile security invoker set search_path='' as $$ select * from private.registration_batch_occupancy() $$;
revoke all on function public.registration_batch_occupancy() from public,anon,service_role;
grant execute on function public.registration_batch_occupancy() to authenticated;
set local lock_timeout=default;

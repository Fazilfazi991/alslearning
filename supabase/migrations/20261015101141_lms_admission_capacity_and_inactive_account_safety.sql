-- Enforce the existing batch capacity field with an atomic row lock.
-- This LMS guard uses only production LMS tables.
create function private.lms_enrollment_capacity_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare batch public.batches;
begin
  if new.batch_id is null or new.status<>'active' then return new; end if;
  if tg_op='UPDATE' and old.student_id=new.student_id and old.program_id=new.program_id
    and old.batch_id is not distinct from new.batch_id and old.status=new.status then return new; end if;
  select * into batch from public.batches where id=new.batch_id for update;
  if not found or batch.program_id<>new.program_id then raise exception 'Select a compatible batch' using errcode='23514'; end if;
  if batch.status not in ('active','upcoming') then raise exception 'This batch is closed' using errcode='23514'; end if;
  if batch.max_students is not null and
    (select count(*) from public.enrollments where batch_id=batch.id and status='active' and id<>new.id)>=batch.max_students then
    raise exception 'This batch has reached its Student capacity' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.lms_enrollment_capacity_guard() from public,anon,authenticated;
create trigger a_lms_enrollment_capacity_guard before insert or update on public.enrollments
for each row execute function private.lms_enrollment_capacity_guard();

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare admission jsonb:=new.raw_app_meta_data->'lms_admission'; batch public.batches; actor uuid; start_at timestamptz; expires_at timestamptz;
begin
  insert into public.profiles(id,role,full_name,email)
  values(new.id,coalesce((new.raw_app_meta_data->>'role')::public.app_role,'student'),coalesce(new.raw_user_meta_data->>'full_name',''),new.email)
  on conflict(id) do nothing;
  if admission is not null then
    actor:=(admission->>'actor_id')::uuid;
    if (new.raw_app_meta_data->>'role')<>'student' or not exists(select 1 from public.profiles where id=actor and role='admin' and is_active) then
      raise exception 'Active admission Admin required'; end if;
    perform set_config('als.admission_actor',actor::text,true);
    perform set_config('als.change_reason','Student admission',true);
    if coalesce((admission->>'unassigned')::boolean,false)=false then
      select * into batch from public.batches where id=(admission->>'batch_id')::uuid and program_id=(admission->>'program_id')::uuid and status='active';
      if not found or batch.batch_code is null or not exists(select 1 from public.programs where id=batch.program_id and status='active') then
        raise exception 'Select an active compatible Program and coded Batch'; end if;
    elsif nullif(admission->>'program_id','') is not null or nullif(admission->>'batch_id','') is not null then
      raise exception 'Unassigned admission cannot grant partial access';
    end if;
    update public.profiles set full_name=btrim(admission->>'full_name'),phone=nullif(admission->>'phone',''),
      admission_on=(admission->>'admission_on')::date,is_active=true,
      guardian_name=nullif(admission->>'guardian_name',''),guardian_phone=nullif(admission->>'guardian_phone',''),
      guardian_relationship=nullif(admission->>'guardian_relationship',''),address=nullif(admission->>'address',''),internal_notes=nullif(admission->>'internal_notes','') where id=new.id;
    if batch.id is not null then
      start_at:=(admission->>'access_starts_at')::timestamptz; expires_at:=nullif(admission->>'access_expires_at','')::timestamptz;
      if start_at is null or (expires_at is not null and expires_at<=start_at) then raise exception 'Invalid access dates'; end if;
      insert into public.enrollments(student_id,program_id,batch_id,enrolled_on,access_starts_at,access_expires_at,status)
      values(new.id,batch.program_id,batch.id,(admission->>'admission_on')::date,start_at,expires_at,'active');
      perform private.lms_assign_student_code(new.id,batch.id);
    end if;
    -- Auth, access and final account status commit together. A disabled new
    -- account is never externally visible as active during this transaction.
    update public.profiles set is_active=coalesce((admission->>'is_active')::boolean,true) where id=new.id;
    -- Contact information stays in the application profile, not JWT metadata.
    update auth.users set raw_app_meta_data=raw_app_meta_data-'lms_admission' where id=new.id;
  end if;
  return new;
end $$;

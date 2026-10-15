-- Additive LMS maintenance. Existing identity codes are never overwritten.
alter table public.batches add column batch_code text unique
  check(batch_code ~ '^[A-Z0-9]{2,16}$');
alter table public.profiles
  add column student_code text unique check(student_code ~ '^ALS-[A-Z0-9]{2,16}-[0-9]{3,}$'),
  add column admission_batch_id uuid references public.batches(id) on delete restrict,
  add column admission_on date,
  add column guardian_name text check(length(guardian_name)<=120),
  add column guardian_phone text check(length(guardian_phone)<=32),
  add column guardian_relationship text check(length(guardian_relationship)<=80),
  add column address text check(length(address)<=1000),
  add column internal_notes text check(length(internal_notes)<=4000);

create table private.student_code_counters (
  batch_id uuid primary key references public.batches(id) on delete restrict,
  last_value bigint not null check(last_value>0)
);
revoke all on private.student_code_counters from public,anon,authenticated;

create table public.lms_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default clock_timestamp(),
  entity_table text not null, entity_id uuid not null, action text not null,
  previous_value jsonb, new_value jsonb, reason text check(length(reason)<=4000)
);
alter table public.lms_audit_events enable row level security;
revoke all on public.lms_audit_events from public,anon,authenticated;
grant select on public.lms_audit_events to authenticated;
create policy audit_admin_read on public.lms_audit_events for select to authenticated using(public.is_admin());

create table public.student_batch_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  program_id uuid not null references public.programs(id) on delete restrict,
  batch_id uuid references public.batches(id) on delete restrict,
  effective_at timestamptz not null, ended_at timestamptz,
  reason text, actor_id uuid references public.profiles(id) on delete restrict,
  check(ended_at is null or ended_at>=effective_at)
);
create unique index student_history_one_current on public.student_batch_history(enrollment_id) where ended_at is null;
create index student_history_lookup on public.student_batch_history(student_id,effective_at);
alter table public.student_batch_history enable row level security;
revoke all on public.student_batch_history from public,anon,authenticated;
grant select on public.student_batch_history to authenticated;
create policy student_history_read on public.student_batch_history for select to authenticated
  using(public.is_admin() or (student_id=(select auth.uid()) and private.active_role()='student'));
insert into public.student_batch_history(student_id,enrollment_id,program_id,batch_id,effective_at,reason)
select student_id,id,program_id,batch_id,least(access_starts_at,created_at),'Existing assignment at maintenance migration' from public.enrollments;

-- Abort on ambiguous live data; never merge, cancel or delete a student's access.
create unique index enrollments_one_active_program on public.enrollments(student_id,program_id) where status='active';

create function private.lms_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare before_value jsonb; after_value jsonb; actor uuid;
begin
  before_value:=case when tg_op='UPDATE' then to_jsonb(old) end;
  after_value:=to_jsonb(new);
  actor:=coalesce(auth.uid(),nullif(current_setting('als.admission_actor',true),'')::uuid);
  if before_value is distinct from after_value then
    insert into public.lms_audit_events(actor_id,entity_table,entity_id,action,previous_value,new_value,reason)
    values(actor,tg_table_name,new.id,lower(tg_op),before_value,after_value,nullif(current_setting('als.change_reason',true),''));
  end if;
  return new;
end $$;
revoke all on function private.lms_audit() from public,anon,authenticated;
create trigger lms_profile_audit after update on public.profiles for each row execute function private.lms_audit();
create trigger lms_enrollment_audit after insert or update on public.enrollments for each row execute function private.lms_audit();

create function private.lms_assign_student_code(person_id uuid,initial_batch uuid) returns text
language plpgsql security definer set search_path='' as $$
declare code text; number_value bigint; person public.profiles;
begin
  select * into person from public.profiles where id=person_id and role='student' for update;
  if not found then raise exception 'Student not found'; end if;
  if person.student_code is not null then return person.student_code; end if;
  select batch_code into code from public.batches where id=initial_batch;
  if code is null then raise exception 'The admission batch needs a valid Batch Code'; end if;
  loop
    insert into private.student_code_counters(batch_id,last_value) values(initial_batch,1)
      on conflict(batch_id) do update set last_value=private.student_code_counters.last_value+1 returning last_value into number_value;
    exit when not exists(select 1 from public.profiles where student_code='ALS-'||code||'-'||lpad(number_value::text,greatest(3,length(number_value::text)), '0'));
  end loop;
  code:='ALS-'||code||'-'||lpad(number_value::text,greatest(3,length(number_value::text)), '0');
  perform set_config('als.assign_student_id',person_id::text,true);
  update public.profiles set student_code=code,admission_batch_id=initial_batch where id=person_id;
  return code;
end $$;
revoke all on function private.lms_assign_student_code(uuid,uuid) from public,anon,authenticated;

create function private.lms_protect_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.student_code is not null and (new.student_code is distinct from old.student_code or new.admission_batch_id is distinct from old.admission_batch_id) then
    raise exception 'The permanent Student Code and admission batch cannot be changed';
  end if;
  -- Assignment is possible only inside the owner function, never a direct API update.
  if old.student_code is null and new.student_code is not null
     and coalesce(current_setting('als.assign_student_id',true),'')<>new.id::text then raise exception 'Use the controlled Student Code assignment'; end if;
  return new;
end $$;
revoke all on function private.lms_protect_identity() from public,anon,authenticated;
create trigger lms_protect_identity before update on public.profiles for each row execute function private.lms_protect_identity();

create function private.lms_batch_code_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.batch_code is null and tg_op='INSERT' then raise exception 'Enter a unique Batch Code'; end if;
  if tg_op='UPDATE' and old.batch_code is not null and new.batch_code is distinct from old.batch_code then raise exception 'Batch Code is permanent; change the display name instead'; end if;
  return new;
end $$;
revoke all on function private.lms_batch_code_guard() from public,anon,authenticated;
create trigger lms_batch_code_guard before insert or update on public.batches for each row execute function private.lms_batch_code_guard();

create function private.lms_enrollment_history() returns trigger language plpgsql security definer set search_path='' as $$
declare at_time timestamptz; reason_value text;
begin
  if new.batch_id is not null and not exists(select 1 from public.batches where id=new.batch_id and program_id=new.program_id) then
    raise exception 'Batch must belong to the enrolled Program'; end if;
  if tg_op='UPDATE' and (new.student_id<>old.student_id or new.program_id<>old.program_id) then
    raise exception 'Student and Program are permanent enrollment scope; add a separate enrollment'; end if;
  if tg_op='UPDATE' and new.batch_id is distinct from old.batch_id and coalesce(current_setting('als.transfer_enrollment',true),'')<>old.id::text then
    raise exception 'Use Transfer batch to preserve history'; end if;
  if tg_op='INSERT' or new.batch_id is distinct from old.batch_id then
    at_time:=case when tg_op='INSERT' then least(new.access_starts_at,now()) else nullif(current_setting('als.transfer_at',true),'')::timestamptz end;
    reason_value:=nullif(current_setting('als.change_reason',true),'');
    if tg_op='UPDATE' then
      update public.student_batch_history set ended_at=at_time where enrollment_id=new.id and ended_at is null;
    end if;
    insert into public.student_batch_history(student_id,enrollment_id,program_id,batch_id,effective_at,reason,actor_id)
    values(new.student_id,new.id,new.program_id,new.batch_id,at_time,reason_value,coalesce(auth.uid(),nullif(current_setting('als.admission_actor',true),'')::uuid));
    if new.batch_id is not null then perform private.lms_assign_student_code(new.student_id,new.batch_id); end if;
  end if;
  return new;
end $$;
revoke all on function private.lms_enrollment_history() from public,anon,authenticated;
create trigger lms_enrollment_history after insert or update on public.enrollments for each row execute function private.lms_enrollment_history();

create function public.lms_transfer_student(target_enrollment uuid,new_batch uuid,effective_at timestamptz,note text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare enrollment public.enrollments; batch public.batches; history_start timestamptz;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if length(btrim(note)) not between 1 and 1000 then raise exception 'Enter a transfer reason (1–1000 characters)'; end if;
  select * into enrollment from public.enrollments where id=target_enrollment for update;
  if not found or enrollment.status<>'active' then raise exception 'Choose an active enrollment'; end if;
  select * into batch from public.batches where id=new_batch and program_id=enrollment.program_id and status='active';
  if not found then raise exception 'Choose an active batch in the same Program'; end if;
  if new_batch is not distinct from enrollment.batch_id then raise exception 'Choose a different batch'; end if;
  select h.effective_at into history_start from public.student_batch_history h where h.enrollment_id=enrollment.id and h.ended_at is null;
  if effective_at is null or effective_at>now() or effective_at<coalesce(history_start,enrollment.access_starts_at) then
    raise exception 'Effective date must be between the current assignment start and now'; end if;
  perform set_config('als.transfer_enrollment',enrollment.id::text,true);
  perform set_config('als.transfer_at',effective_at::text,true);
  perform set_config('als.change_reason',btrim(note),true);
  update public.enrollments set batch_id=new_batch,updated_at=now() where id=enrollment.id;
  return enrollment.id;
end $$;
revoke all on function public.lms_transfer_student(uuid,uuid,timestamptz,text) from public,anon,service_role;
grant execute on function public.lms_transfer_student(uuid,uuid,timestamptz,text) to authenticated;

-- The Auth insert, canonical profile, enrollment, batch and code share ONE database transaction.
-- Only server-side Auth administration may supply raw_app_meta_data; user_metadata cannot authorize admission.
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
      admission_on=(admission->>'admission_on')::date,is_active=coalesce((admission->>'is_active')::boolean,true),
      guardian_name=nullif(admission->>'guardian_name',''),guardian_phone=nullif(admission->>'guardian_phone',''),
      guardian_relationship=nullif(admission->>'guardian_relationship',''),address=nullif(admission->>'address',''),internal_notes=nullif(admission->>'internal_notes','') where id=new.id;
    if batch.id is not null then
      start_at:=(admission->>'access_starts_at')::timestamptz; expires_at:=nullif(admission->>'access_expires_at','')::timestamptz;
      if start_at is null or (expires_at is not null and expires_at<=start_at) then raise exception 'Invalid access dates'; end if;
      insert into public.enrollments(student_id,program_id,batch_id,enrolled_on,access_starts_at,access_expires_at,status)
      values(new.id,batch.program_id,batch.id,(admission->>'admission_on')::date,start_at,expires_at,'active');
      perform private.lms_assign_student_code(new.id,batch.id);
    end if;
    -- Contact information stays in the application profile, not JWT metadata.
    update auth.users set raw_app_meta_data=raw_app_meta_data-'lms_admission' where id=new.id;
  end if;
  return new;
end $$;

-- Explicitly scoped, observable and repeatable backfill. Run dry_run=true first.
create function public.lms_student_code_backfill(dry_run boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare problems jsonb; person record; batch record; candidate text; assigned integer:=0;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  lock table public.profiles in share row exclusive mode;
  lock table public.batches in share row exclusive mode;
  select coalesce(jsonb_agg(p.id),'[]') into problems from public.profiles p where p.role='student' and p.student_code is null
    and not exists(select 1 from public.enrollments e where e.student_id=p.id and e.batch_id is not null);
  if dry_run then return jsonb_build_object('dry_run',true,'students_without_batch',problems,
    'students_to_assign',(select count(*) from public.profiles where role='student' and student_code is null),
    'batches_to_code',(select count(*) from public.batches where batch_code is null)); end if;
  if jsonb_array_length(problems)>0 then raise exception 'Backfill blocked: students without an admission batch'; end if;
  for batch in select id,slug from public.batches where batch_code is null order by id loop
    candidate:=left(regexp_replace(upper(batch.slug),'[^A-Z0-9]','','g'),8)||upper(left(replace(batch.id::text,'-',''),8));
    if exists(select 1 from public.batches where batch_code=candidate) then raise exception 'Batch Code collision; review dry run'; end if;
    update public.batches set batch_code=candidate where id=batch.id;
  end loop;
  perform set_config('als.change_reason','Reviewed Student Code backfill',true);
  for person in select id from public.profiles where role='student' and student_code is null order by created_at,id loop
    select e.batch_id into batch from public.enrollments e where e.student_id=person.id and e.batch_id is not null order by e.enrolled_on,e.created_at,e.id limit 1;
    perform private.lms_assign_student_code(person.id,batch.batch_id); assigned:=assigned+1;
  end loop;
  return jsonb_build_object('dry_run',false,'assigned',assigned);
end $$;
revoke all on function public.lms_student_code_backfill(boolean) from public,anon,service_role;
grant execute on function public.lms_student_code_backfill(boolean) to authenticated;

alter table public.class_recordings add column review_title text check(length(review_title) between 1 and 250),
  add column review_description text check(length(review_description)<=10000),
  add column rejected_at timestamptz,add column rejection_reason text check(length(rejection_reason)<=1000);
create trigger lms_recording_audit after update on public.class_recordings for each row execute function private.lms_audit();

create function private.lms_recording_admin_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not public.is_admin() and (new.status in ('ready','published') or new.verified_at is not null or new.published_at is not null or new.rejected_at is not null or new.review_title is not null or new.review_description is not null) then
    raise exception 'Admin review required' using errcode='42501';
  end if;
  if tg_op='UPDATE' and not public.is_admin() and (old.status in ('ready','published') or old.rejected_at is not null) then raise exception 'Reviewed recording is locked' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function private.lms_recording_admin_guard() from public,anon,authenticated;
create trigger lms_recording_admin_guard before insert or update on public.class_recordings for each row execute function private.lms_recording_admin_guard();

create function public.lms_recording_decision(target_session uuid,target_recording uuid,decision text,note text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare recording public.class_recordings; at_time timestamptz:=clock_timestamp();
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into recording from public.class_recordings where id=target_recording and session_id=target_session for update;
  if not found then raise exception 'Recording does not belong to this class'; end if;
  perform set_config('als.change_reason',coalesce(note,decision),true);
  if decision='review' then
    if recording.status<>'validating' or recording.client_validated_at is null or not exists(select 1 from public.live_recording_segments where recording_id=recording.id)
       or exists(select 1 from public.live_recording_segments where recording_id=recording.id and (status<>'validating' or client_validated_at is null or client_reported_duration_seconds is null or object_sha256 is null or total_bytes<=0)) then raise exception 'Every segment requires completed validation'; end if;
    update public.live_recording_segments set status='ready',verified_at=at_time,duration_seconds=client_reported_duration_seconds,error_message=null where recording_id=recording.id;
    update public.class_recordings set status='ready',verified_at=at_time,rejected_at=null,rejection_reason=null,error_message=null,
      duration_seconds=(select sum(duration_seconds) from public.live_recording_segments where recording_id=recording.id),
      total_bytes=(select sum(total_bytes) from public.live_recording_segments where recording_id=recording.id) where id=recording.id;
  elsif decision='publish' then
    if recording.rejected_at is not null or recording.status not in ('ready','published') or recording.verified_at is null
      or not exists(select 1 from public.live_sessions where id=target_session and recording_enabled and status='completed')
      or not exists(select 1 from public.live_recording_segments where recording_id=recording.id and status='ready')
      or exists(select 1 from public.live_recording_segments where recording_id=recording.id and status<>'ready') then raise exception 'Only a complete, approved recording can be published'; end if;
    update public.class_recordings set status='published',published_at=coalesce(published_at,at_time),published_by=coalesce(published_by,auth.uid()) where id=recording.id;
  elsif decision='unpublish' then
    if recording.status='published' then update public.class_recordings set status='ready',published_at=null,published_by=null where id=recording.id; end if;
  elsif decision='reject' then
    if note is null or length(btrim(note)) not between 1 and 1000 then raise exception 'Enter a rejection reason'; end if;
    if recording.status not in ('validating','ready','published') then raise exception 'This recording is not ready for a review decision'; end if;
    update public.class_recordings set status=case when status='published' then 'ready'::public.recording_status else status end,rejected_at=at_time,rejection_reason=btrim(note),published_at=null,published_by=null where id=recording.id;
  elsif decision='pending' then
    update public.class_recordings set rejected_at=null,rejection_reason=null where id=recording.id and status in ('ready','validating');
  else raise exception 'Invalid recording decision'; end if;
  return (select jsonb_build_object('status',status,'rejected_at',rejected_at,'published_at',published_at) from public.class_recordings where id=recording.id);
end $$;
revoke all on function public.lms_recording_decision(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.lms_recording_decision(uuid,uuid,text,text) to authenticated;

-- Existing uploaded lessons and real live replays share one discovery/count source.
-- security_invoker preserves each underlying table's existing RLS, including batch/expiry.
create view public.lms_class_catalog with (security_invoker=true) as
select id,title,description,subject_id,chapter_id,topic_label,subtopic,teacher_id,duration_seconds::numeric,
  provider,provider_video_id,status,sort_order,published_at,updated_at,null::uuid session_id,null::uuid program_id,null::uuid batch_id,
  thumbnail_url,storage_provider,storage_key,source_storage_key,poster_storage_key,mime_type,file_size,width,height,checksum_sha256,original_provider,original_provider_video_id
from public.recorded_classes
union all
select r.id,coalesce(r.review_title,s.title),r.review_description,s.subject_id,null::uuid,'Live class'::text,null::text,s.faculty_id,r.duration_seconds,
  'live'::text,null::text,r.status::text,0,r.published_at,r.updated_at,s.id,s.program_id,s.batch_id,
  null::text,'r2'::text,null::text,null::text,null::text,r.mime_type,r.total_bytes,null::integer,null::integer,null::text,null::text,null::text
from public.class_recordings r join public.live_sessions s on s.id=r.session_id
where r.status='published' and r.published_at is not null and r.verified_at is not null and r.rejected_at is null and s.recording_enabled
  and exists(select 1 from public.live_recording_segments g where g.recording_id=r.id and g.status='ready');
revoke all on public.lms_class_catalog from public,anon;
grant select on public.lms_class_catalog to authenticated;

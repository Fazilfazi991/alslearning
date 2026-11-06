-- Additive admissions CRM. Public clients have no table access; submission is
-- validated by the backend and a service-only transactional RPC.
create table public.admission_enquiries (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check(length(btrim(full_name)) between 2 and 120),
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 email text check(email is null or length(email)<=254),
 program_id uuid not null references public.programs(id),
 message text check(message is null or length(message)<=2000),
 consent_at timestamptz not null default now(),
 status text not null default 'new' check(status in ('new','contacted','interested','follow_up','converted','closed')),
 assigned_to uuid references public.profiles(id), student_id uuid unique references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((status='converted')=(student_id is not null))
);
create index admission_enquiries_created on public.admission_enquiries(created_at desc);
create index admission_enquiries_status_program on public.admission_enquiries(status,program_id,created_at desc);
create index admission_enquiries_phone on public.admission_enquiries(phone,program_id,created_at desc);
create index admission_enquiries_assignee on public.admission_enquiries(assigned_to);
create table public.enquiry_activities (
 id uuid primary key default gen_random_uuid(), enquiry_id uuid not null references public.admission_enquiries(id),
 actor_id uuid references public.profiles(id), kind text not null,
 note text not null default '' check(length(note)<=4000), metadata jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index enquiry_activities_enquiry on public.enquiry_activities(enquiry_id,created_at desc);
create index enquiry_activities_actor on public.enquiry_activities(actor_id);
create table public.enquiry_follow_ups (
 id uuid primary key default gen_random_uuid(), enquiry_id uuid not null references public.admission_enquiries(id),
 due_at timestamptz not null, completed_at timestamptz,
 outcome text check(outcome is null or length(outcome)<=4000), created_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create index enquiry_follow_ups_pending on public.enquiry_follow_ups(due_at) where completed_at is null;
create index enquiry_follow_ups_enquiry on public.enquiry_follow_ups(enquiry_id);
create index enquiry_follow_ups_creator on public.enquiry_follow_ups(created_by);
create table private.enquiry_rate_buckets (
 bucket text primary key, window_start timestamptz not null, attempts integer not null
);
create table private.enquiry_requests (
 request_id uuid primary key, enquiry_id uuid not null references public.admission_enquiries(id), created_at timestamptz not null default now()
);
alter table public.admission_enquiries enable row level security;
alter table public.enquiry_activities enable row level security;
alter table public.enquiry_follow_ups enable row level security;
alter table private.enquiry_rate_buckets enable row level security;
alter table private.enquiry_requests enable row level security;
revoke all on public.admission_enquiries,public.enquiry_activities,public.enquiry_follow_ups from anon,authenticated;
revoke all on private.enquiry_rate_buckets,private.enquiry_requests from public,anon,authenticated;
grant select on public.admission_enquiries,public.enquiry_activities,public.enquiry_follow_ups to authenticated;
create function private.enquiry_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and is_active)
$$;
revoke all on function private.enquiry_admin() from public,anon;
grant execute on function private.enquiry_admin() to authenticated;
create policy enquiries_admin_read on public.admission_enquiries for select to authenticated using(private.enquiry_admin());
create policy enquiries_admin_update on public.admission_enquiries for update to authenticated using(private.enquiry_admin()) with check(private.enquiry_admin());
create policy enquiry_activities_admin_read on public.enquiry_activities for select to authenticated using(private.enquiry_admin());
create policy enquiry_activities_admin_insert on public.enquiry_activities for insert to authenticated with check(private.enquiry_admin() and actor_id=auth.uid() and kind in ('note','contact','follow_up'));
create policy enquiry_followups_admin_read on public.enquiry_follow_ups for select to authenticated using(private.enquiry_admin());
create policy enquiry_followups_admin_insert on public.enquiry_follow_ups for insert to authenticated with check(private.enquiry_admin() and created_by=auth.uid());
create policy enquiry_followups_admin_update on public.enquiry_follow_ups for update to authenticated using(private.enquiry_admin()) with check(private.enquiry_admin());

create function private.enquiry_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.assigned_to is not null and not exists(select 1 from public.profiles where id=new.assigned_to and role='admin' and is_active) then raise exception 'Only active administrators may receive enquiries'; end if;
 if tg_op='UPDATE' then
   if old.student_id is not null and (new.student_id is distinct from old.student_id or new.status<>old.status) then raise exception 'Conversion is permanent'; end if;
   if new.student_id is distinct from old.student_id and current_setting('als.enquiry_conversion',true) is distinct from new.id::text then raise exception 'Use Student admission to convert'; end if;
   new.updated_at:=now();
 end if;
 return new;
end $$;
revoke all on function private.enquiry_guard() from public,anon,authenticated;
create trigger enquiry_guard before insert or update on public.admission_enquiries for each row execute function private.enquiry_guard();
create function private.enquiry_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status or new.assigned_to is distinct from old.assigned_to then
 insert into public.enquiry_activities(enquiry_id,actor_id,kind,note,metadata)
 values(new.id,coalesce(auth.uid(),nullif(current_setting('als.admission_actor',true),'')::uuid),'updated','Enquiry updated',jsonb_build_object('old_status',old.status,'status',new.status,'assigned_to',new.assigned_to,'student_id',new.student_id));
 end if;
 return new;
end $$;
revoke all on function private.enquiry_audit() from public,anon,authenticated;
create trigger enquiry_audit after update on public.admission_enquiries for each row execute function private.enquiry_audit();

create function public.submit_admission_enquiry(p_full_name text,p_phone text,p_email text,p_program_id uuid,p_message text,p_request_id uuid,p_ip_hash text,p_phone_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lead uuid; n integer; bucket_key text; limit_n integer;
begin
 -- EXECUTE is revoked from PUBLIC/anon/authenticated; only service_role may
 -- reach this RPC through PostgREST. The database owner may run local QA.
 if p_ip_hash !~ '^[a-f0-9]{64}$' or p_phone_hash !~ '^[a-f0-9]{64}$' or p_request_id is null then raise exception 'Invalid submission'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_phone||p_program_id::text,0));
 select enquiry_id into lead from private.enquiry_requests where request_id=p_request_id;
 if found then return jsonb_build_object('duplicate',true); end if;
 if not exists(select 1 from public.programs where id=p_program_id and status='active') then raise exception 'invalid_program'; end if;
 foreach bucket_key in array array['ip:'||p_ip_hash,'phone:'||p_phone_hash] loop
   limit_n:=case when bucket_key like 'ip:%' then 10 else 3 end;
   insert into private.enquiry_rate_buckets(bucket,window_start,attempts) values(bucket_key,now(),1)
   on conflict(bucket) do update set attempts=case when enquiry_rate_buckets.window_start<now()-interval '1 hour' then 1 else enquiry_rate_buckets.attempts+1 end,
   window_start=case when enquiry_rate_buckets.window_start<now()-interval '1 hour' then now() else enquiry_rate_buckets.window_start end returning attempts into n;
   if n>limit_n then raise exception 'rate_limit'; end if;
 end loop;
 select id into lead from public.admission_enquiries where phone=p_phone and program_id=p_program_id and created_at>now()-interval '10 minutes' order by created_at desc limit 1;
 if found then
   insert into private.enquiry_requests(request_id,enquiry_id) values(p_request_id,lead);
   return jsonb_build_object('duplicate',true);
 end if;
 insert into public.admission_enquiries(full_name,phone,email,program_id,message) values(p_full_name,p_phone,p_email,p_program_id,p_message) returning id into lead;
 insert into private.enquiry_requests(request_id,enquiry_id) values(p_request_id,lead);
 insert into public.enquiry_activities(enquiry_id,kind,note) values(lead,'submitted','Enquiry received with contact consent');
 return jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text) to service_role;

create function public.enquiry_conversion_ready() returns boolean language sql stable security invoker set search_path='' as $$ select private.enquiry_admin() $$;
revoke all on function public.enquiry_conversion_ready() from public,anon;
grant execute on function public.enquiry_conversion_ready() to authenticated;

create function private.update_admission_enquiry(p_id uuid,p_changes jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare lead public.admission_enquiries;
begin
 if not private.enquiry_admin() then raise exception 'Administrator required'; end if;
 select * into lead from public.admission_enquiries where id=p_id for update;
 if not found then raise exception 'Enquiry not found'; end if;
 if p_changes ? 'status' and (p_changes->>'status' is null or p_changes->>'status' not in ('new','contacted','interested','follow_up','closed')) then raise exception 'Invalid status'; end if;
 update public.admission_enquiries set
 status=case when p_changes ? 'status' then p_changes->>'status' else status end,
 assigned_to=case when p_changes ? 'assigned_to' then (p_changes->>'assigned_to')::uuid else assigned_to end where id=p_id;
 if length(btrim(coalesce(p_changes->>'notes','')))>0 then
 insert into public.enquiry_activities(enquiry_id,actor_id,kind,note) values(p_id,auth.uid(),'note',btrim(p_changes->>'notes'));
 end if;
end $$;
revoke all on function private.update_admission_enquiry(uuid,jsonb) from public,anon;
grant execute on function private.update_admission_enquiry(uuid,jsonb) to authenticated;
create function public.update_admission_enquiry(p_id uuid,p_changes jsonb) returns void
language sql security invoker set search_path='' as $$ select private.update_admission_enquiry(p_id,p_changes) $$;
revoke all on function public.update_admission_enquiry(uuid,jsonb) from public,anon;
grant execute on function public.update_admission_enquiry(uuid,jsonb) to authenticated;

create function private.record_enquiry_activity(p_id uuid,p_activity jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare lead public.admission_enquiries; follow_id uuid;
begin
 if not private.enquiry_admin() then raise exception 'Administrator required'; end if;
 select * into lead from public.admission_enquiries where id=p_id for update;
 if not found then raise exception 'Enquiry not found'; end if;
 if p_activity->>'kind' not in ('note','contact','follow_up') or length(btrim(coalesce(p_activity->>'note','')))=0 then raise exception 'Invalid activity'; end if;
 if p_activity->>'kind'='follow_up' and nullif(p_activity->>'follow_up_id','') is not null then
   if length(btrim(coalesce(p_activity->>'outcome','')))=0 then raise exception 'Outcome required'; end if;
   update public.enquiry_follow_ups set completed_at=now(),outcome=p_activity->>'outcome' where id=(p_activity->>'follow_up_id')::uuid and enquiry_id=p_id and completed_at is null returning id into follow_id;
   if not found then raise exception 'Follow-up unavailable'; end if;
 elsif p_activity->>'kind'='follow_up' then
   if lead.status in ('converted','closed') then raise exception 'Enquiry closed'; end if;
   insert into public.enquiry_follow_ups(enquiry_id,due_at,created_by) values(p_id,(p_activity->>'due_at')::timestamptz,auth.uid()) returning id into follow_id;
   update public.admission_enquiries set status='follow_up' where id=p_id;
 elsif p_activity->>'kind'='contact' and lead.status='new' then
   update public.admission_enquiries set status='contacted' where id=p_id;
 end if;
 insert into public.enquiry_activities(enquiry_id,actor_id,kind,note,metadata) values(p_id,auth.uid(),p_activity->>'kind',btrim(p_activity->>'note'),jsonb_build_object('follow_up_id',follow_id,'due_at',p_activity->>'due_at','outcome',p_activity->>'outcome'));
end $$;
revoke all on function private.record_enquiry_activity(uuid,jsonb) from public,anon;
grant execute on function private.record_enquiry_activity(uuid,jsonb) to authenticated;
create function public.record_enquiry_activity(p_id uuid,p_activity jsonb) returns void
language sql security invoker set search_path='' as $$ select private.record_enquiry_activity(p_id,p_activity) $$;
revoke all on function public.record_enquiry_activity(uuid,jsonb) from public,anon;
grant execute on function public.record_enquiry_activity(uuid,jsonb) to authenticated;

-- Extend the existing canonical admission transaction without changing code generation.
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare admission jsonb:=new.raw_app_meta_data->'lms_admission'; batch public.batches; actor uuid; start_at timestamptz; expires_at timestamptz;
begin
  insert into public.profiles(id,role,full_name,email)
  values(new.id,coalesce((new.raw_app_meta_data->>'role')::public.app_role,'student'),coalesce(new.raw_user_meta_data->>'full_name',''),new.email)
  on conflict(id) do nothing;
  if admission is not null then
    actor:=(admission->>'actor_id')::uuid;
    if nullif(admission->>'enquiry_id','') is not null then
      perform 1 from public.admission_enquiries where id=(admission->>'enquiry_id')::uuid and student_id is null and status<>'converted' for update;
      if not found or coalesce((admission->>'unassigned')::boolean,false) then raise exception 'Enquiry unavailable for admission'; end if;
    end if;
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
    if nullif(admission->>'enquiry_id','') is not null then
      if not exists(select 1 from public.profiles where id=new.id and role='student' and student_code is not null and admission_on is not null)
        or not exists(select 1 from public.enrollments where student_id=new.id and program_id=batch.program_id and batch_id=batch.id) then
        raise exception 'Complete admission is required before conversion';
      end if;
      perform set_config('als.enquiry_conversion',admission->>'enquiry_id',true);
      update public.admission_enquiries set status='converted',student_id=new.id where id=(admission->>'enquiry_id')::uuid;
    end if;
    -- Contact information stays in the application profile, not JWT metadata.
    update auth.users set raw_app_meta_data=raw_app_meta_data-'lms_admission' where id=new.id;
  end if;
  return new;
end $$;

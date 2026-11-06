-- Follow-up hardening; preserves the reviewed initial admissions migration.
-- p_ip_hash is a compatibility name: it hashes either an explicitly trusted
-- network address or a signed anonymous browser identity, never a shared unknown.
grant usage on schema private to service_role;
-- Hosted projects do not all inherit Supabase's historical default grants.
-- The server-rendered public course picker reads only these active-program
-- columns. This grants neither anonymous program reads nor program writes.
grant select(id,name,description,status,display_order) on public.programs to service_role;
create or replace function private.submit_admission_enquiry(p_full_name text,p_phone text,p_email text,p_program_id uuid,p_message text,p_request_id uuid,p_ip_hash text,p_phone_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare lead uuid; n integer; bucket_key text; limit_n integer;
begin
 -- EXECUTE is revoked from PUBLIC/anon/authenticated; only service_role may
 -- reach this RPC through PostgREST. The database owner may run local QA.

 if p_full_name is null or length(btrim(p_full_name)) not between 2 and 120
   or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$'
   or (p_email is not null and (length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
   or (p_message is not null and length(p_message)>2000)
   or p_program_id is null or p_request_id is null
   or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$'
   or p_phone_hash is null or p_phone_hash !~ '^[a-f0-9]{64}$' then
   raise exception 'Invalid submission' using errcode='22023';
 end if;
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
revoke all on function private.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function private.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text) to service_role;
create or replace function public.submit_admission_enquiry(p_full_name text,p_phone text,p_email text,p_program_id uuid,p_message text,p_request_id uuid,p_ip_hash text,p_phone_hash text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.submit_admission_enquiry(p_full_name,p_phone,p_email,p_program_id,p_message,p_request_id,p_ip_hash,p_phone_hash)
$$;
revoke all on function public.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text) to service_role;

-- Public invoker wrappers remain unchanged. Their private implementations
-- validate untrusted JSON independently of the Next.js handlers.
create or replace function private.update_admission_enquiry(p_id uuid,p_changes jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare lead public.admission_enquiries;
begin
 if not private.enquiry_admin() then raise exception 'Administrator required'; end if;
 if p_id is null or p_changes is null or jsonb_typeof(p_changes)<>'object' then raise exception 'Invalid enquiry changes' using errcode='22023'; end if;
 if p_changes='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('status','assigned_to','notes'))
   or (p_changes ? 'status' and jsonb_typeof(p_changes->'status')<>'string')
   or (p_changes ? 'assigned_to' and jsonb_typeof(p_changes->'assigned_to') not in ('string','null'))
   or (p_changes ? 'notes' and (jsonb_typeof(p_changes->'notes')<>'string' or length(p_changes->>'notes')>4000)) then
   raise exception 'Invalid enquiry changes' using errcode='22023';
 end if;
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
create or replace function private.record_enquiry_activity(p_id uuid,p_activity jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare lead public.admission_enquiries; follow_id uuid;
begin
 if not private.enquiry_admin() then raise exception 'Administrator required'; end if;
 if p_id is null or p_activity is null or jsonb_typeof(p_activity)<>'object' then raise exception 'Invalid activity' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_activity) k where k not in ('kind','note','due_at','outcome','follow_up_id'))
   or coalesce(jsonb_typeof(p_activity->'kind'),'')<>'string' or p_activity->>'kind' not in ('note','contact','follow_up')
   or coalesce(jsonb_typeof(p_activity->'note'),'')<>'string' or length(btrim(p_activity->>'note')) not between 1 and 4000
   or (p_activity ? 'outcome' and (jsonb_typeof(p_activity->'outcome')<>'string' or length(btrim(p_activity->>'outcome')) not between 1 and 4000))
   or (p_activity ? 'follow_up_id' and (jsonb_typeof(p_activity->'follow_up_id')<>'string' or p_activity->>'follow_up_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
   or (p_activity->>'kind'<>'follow_up' and (p_activity ?| array['due_at','outcome','follow_up_id'])) then
   raise exception 'Invalid activity' using errcode='22023';
 end if;
 if p_activity->>'kind'='follow_up' then
   if p_activity ? 'follow_up_id' then
     if not (p_activity ? 'outcome') or p_activity ? 'due_at' then raise exception 'Invalid follow-up completion' using errcode='22023'; end if;
   else
     if coalesce(jsonb_typeof(p_activity->'due_at'),'')<>'string'
       or p_activity->>'due_at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
       or p_activity ? 'outcome' then raise exception 'Invalid follow-up date' using errcode='22023'; end if;
     if not isfinite((p_activity->>'due_at')::timestamptz) then raise exception 'Invalid follow-up date' using errcode='22023'; end if;
   end if;
 end if;
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
-- Replacing a function preserves grants; spell them out for review.
revoke all on function private.update_admission_enquiry(uuid,jsonb),private.record_enquiry_activity(uuid,jsonb) from public,anon;
grant execute on function private.update_admission_enquiry(uuid,jsonb),private.record_enquiry_activity(uuid,jsonb) to authenticated;

-- Retain historical staff assignments when a staff account is deactivated.
-- Only a newly selected assignee must currently be active; an old assignment
-- must not prevent contact history, conversion, or reassignment to null.
create or replace function private.enquiry_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.assigned_to is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to)
   and not exists(select 1 from public.profiles where id=new.assigned_to and role='admin' and is_active) then raise exception 'Only active administrators may receive enquiries'; end if;
 if tg_op='UPDATE' then
   if old.student_id is not null and (new.student_id is distinct from old.student_id or new.status<>old.status) then raise exception 'Conversion is permanent'; end if;
   if new.student_id is distinct from old.student_id and current_setting('als.enquiry_conversion',true) is distinct from new.id::text then raise exception 'Use Student admission to convert'; end if;
   new.updated_at:=now();
 end if;
 return new;
end $$;
revoke all on function private.enquiry_guard() from public,anon,authenticated;

-- Admission preflight is separate from enquiry readiness. It fails closed if
-- the canonical transactional handler drifts or either Auth entry point is
-- absent/disabled. Future handler changes must refresh this reviewed fingerprint.
-- Normalize CRLF so the fingerprint is identical across checkout platforms.
create or replace function private.lms_admission_ready() returns boolean
language sql stable security invoker set search_path='' as $$
 select private.enquiry_admin()
   and exists(select 1 from pg_catalog.pg_proc where oid=to_regprocedure('private.handle_new_user()') and md5(replace(prosrc,chr(13),''))='527476645ea3d24e9dba92f4f3b725c7')
   and exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_created' and tgfoid=to_regprocedure('private.handle_new_user()') and tgtype=5 and tgenabled in ('O','A'))
   and exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_lms_admission' and tgfoid=to_regprocedure('private.handle_new_user()') and tgtype=17 and tgenabled in ('O','A') and tgqual is not null)
   and to_regprocedure('private.lms_assign_student_code(uuid,uuid)') is not null
$$;
revoke all on function private.lms_admission_ready() from public,anon;
grant execute on function private.lms_admission_ready() to authenticated;
create or replace function public.lms_admission_ready() returns boolean
language sql stable security invoker set search_path='' as $$ select private.lms_admission_ready() $$;
revoke all on function public.lms_admission_ready() from public,anon;
grant execute on function public.lms_admission_ready() to authenticated;

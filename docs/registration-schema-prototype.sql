-- LOCAL PROTOTYPE ONLY. Not a migration and not approved for deployment.
-- Public intake never creates an Auth identity or an enrollment.
alter table public.batches add column registration_default boolean not null default false;
create unique index registration_one_default_per_program on public.batches(program_id) where registration_default and status='active';
create table public.student_registrations (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check(length(btrim(full_name)) between 2 and 120),
 email text not null check(length(email)<=254), phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
 qualification text not null check(length(btrim(qualification)) between 2 and 160),
 institution text not null check(length(btrim(institution)) between 2 and 200),
 program_id uuid not null references public.programs(id), preferred_batch_id uuid references public.batches(id),
 notes text check(length(notes)<=2000), consent_at timestamptz not null default now(),
 enquiry_id uuid references public.admission_enquiries(id),
 status text not null default 'pending' check(status in ('pending','needs_information','approved','rejected')),
 student_id uuid unique references public.profiles(id),
 invitation_status text not null default 'not_sent' check(invitation_status in ('not_sent','sending','sent','failed')),
 invitation_attempt_id uuid, invitation_attempted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check ((status='approved')=(student_id is not null))
);
create unique index registration_open_email on public.student_registrations(lower(email)) where status in ('pending','needs_information','approved');
create unique index registration_open_phone on public.student_registrations(phone) where status in ('pending','needs_information','approved');
create index registration_created on public.student_registrations(created_at desc);
create table public.student_registration_events (
 id uuid primary key default gen_random_uuid(), registration_id uuid not null references public.student_registrations(id),
 actor_id uuid references public.profiles(id), kind text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table private.registration_requests (request_id uuid primary key, registration_id uuid not null references public.student_registrations(id));
create table private.registration_rate_buckets (bucket text primary key, window_start timestamptz not null, attempts integer not null);
create table private.registration_links (token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), enquiry_id uuid not null references public.admission_enquiries(id), created_by uuid not null references public.profiles(id), expires_at timestamptz not null, consumed_at timestamptz, registration_id uuid references public.student_registrations(id), created_at timestamptz not null default now());
alter table public.student_registrations enable row level security;
alter table public.student_registration_events enable row level security;
alter table private.registration_requests enable row level security;
alter table private.registration_rate_buckets enable row level security;
alter table private.registration_links enable row level security;
revoke all on public.student_registrations, public.student_registration_events from public,anon,authenticated;
revoke all on private.registration_requests, private.registration_rate_buckets, private.registration_links from public,anon,authenticated;
grant select on public.student_registrations, public.student_registration_events to authenticated;
grant select on public.student_registrations to service_role;
create policy registrations_admin_read on public.student_registrations for select to authenticated using(private.enquiry_admin());
create policy registration_events_admin_read on public.student_registration_events for select to authenticated using(private.enquiry_admin());

create function private.create_registration_link(p_enquiry_id uuid,p_token_hash text,p_expires_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.enquiry_admin() then raise exception 'Administrator required'; end if;
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '7 days' then raise exception 'Invalid link'; end if;
 if not exists(select 1 from public.admission_enquiries where id=p_enquiry_id and status not in ('closed','converted') and student_id is null) then raise exception 'Enquiry unavailable'; end if;
 insert into private.registration_links(token_hash,enquiry_id,created_by,expires_at) values(p_token_hash,p_enquiry_id,auth.uid(),p_expires_at);
 insert into public.enquiry_activities(enquiry_id,actor_id,kind,note) values(p_enquiry_id,auth.uid(),'note','Registration link created');
end $$;
revoke all on function private.create_registration_link(uuid,text,timestamptz) from public,anon;
grant execute on function private.create_registration_link(uuid,text,timestamptz) to authenticated;
create function public.create_registration_link(p_enquiry_id uuid,p_token_hash text,p_expires_at timestamptz) returns void language sql security invoker set search_path='' as $$ select private.create_registration_link(p_enquiry_id,p_token_hash,p_expires_at) $$;
revoke all on function public.create_registration_link(uuid,text,timestamptz) from public,anon;
grant execute on function public.create_registration_link(uuid,text,timestamptz) to authenticated;

create function private.get_registration_link(p_token_hash text,p_ip_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; result jsonb;
begin
 if coalesce(p_token_hash,'') !~ '^[a-f0-9]{64}$' or coalesce(p_ip_hash,'') !~ '^[a-f0-9]{64}$' then return null; end if;
 insert into private.registration_rate_buckets values('lookup:'||p_ip_hash,now(),1)
 on conflict(bucket) do update set attempts=case when registration_rate_buckets.window_start<now()-interval '1 hour' then 1 else registration_rate_buckets.attempts+1 end,window_start=case when registration_rate_buckets.window_start<now()-interval '1 hour' then now() else registration_rate_buckets.window_start end returning attempts into n;
 if n>60 then return null; end if;
 select jsonb_build_object('full_name',e.full_name,'email',e.email,'phone',e.phone,'program_id',e.program_id) into result from private.registration_links l join public.admission_enquiries e on e.id=l.enquiry_id where l.token_hash=p_token_hash and l.consumed_at is null and l.expires_at>now() and e.status not in ('closed','converted') and e.student_id is null;
 return result;
end $$;
revoke all on function private.get_registration_link(text,text) from public,anon,authenticated;
grant execute on function private.get_registration_link(text,text) to service_role;
create function public.get_registration_link(p_token_hash text,p_ip_hash text) returns jsonb language sql security invoker set search_path='' as $$ select private.get_registration_link(p_token_hash,p_ip_hash) $$;
revoke all on function public.get_registration_link(text,text) from public,anon,authenticated;
grant execute on function public.get_registration_link(text,text) to service_role;

create function private.submit_student_registration(p_full_name text,p_email text,p_phone text,p_qualification text,p_institution text,p_program_id uuid,p_preferred_batch_id uuid,p_notes text,p_consent boolean,p_request_id uuid,p_ip_hash text,p_phone_hash text,p_email_hash text,p_link_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare application_id uuid; linked_enquiry uuid; bucket_key text; n integer; limit_n integer;
begin
 if p_full_name is null or length(btrim(p_full_name)) not between 2 and 120
 or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$'
 or p_qualification is null or length(btrim(p_qualification)) not between 2 and 160
 or p_institution is null or length(btrim(p_institution)) not between 2 and 200
 or length(coalesce(p_notes,''))>2000 or p_consent is distinct from true or p_program_id is null or p_request_id is null
 or coalesce(p_ip_hash,'') !~ '^[a-f0-9]{64}$' or coalesce(p_phone_hash,'') !~ '^[a-f0-9]{64}$' or coalesce(p_email_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid submission' using errcode='22023'; end if;
 -- Consistent ordering fences requests with shared email, phone or id.
 perform pg_advisory_xact_lock(hashtextextended('registration-request:'||p_request_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('registration-email:'||lower(btrim(p_email)),0));
 perform pg_advisory_xact_lock(hashtextextended('registration-phone:'||p_phone,0));
 if exists(select 1 from private.registration_requests where request_id=p_request_id) then return jsonb_build_object('accepted',true); end if;
 if p_link_hash is not null then
   if p_link_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_link'; end if;
   select l.enquiry_id into linked_enquiry from private.registration_links l join public.admission_enquiries e on e.id=l.enquiry_id where l.token_hash=p_link_hash and l.consumed_at is null and l.expires_at>now() and e.status not in ('closed','converted') and e.student_id is null for update of l;
   if linked_enquiry is null then raise exception 'invalid_link'; end if;
 end if;
 if not exists(select 1 from public.programs where id=p_program_id and status='active') then raise exception 'invalid_program'; end if;
 if p_preferred_batch_id is not null and not exists(select 1 from public.batches where id=p_preferred_batch_id and program_id=p_program_id and status='active') then raise exception 'invalid_batch'; end if;
 foreach bucket_key in array array['ip:'||p_ip_hash,'email:'||p_email_hash,'phone:'||p_phone_hash] loop
   limit_n:=case when bucket_key like 'ip:%' then 10 else 3 end;
   insert into private.registration_rate_buckets values(bucket_key,now(),1)
   on conflict(bucket) do update set attempts=case when registration_rate_buckets.window_start<now()-interval '1 hour' then 1 else registration_rate_buckets.attempts+1 end,
     window_start=case when registration_rate_buckets.window_start<now()-interval '1 hour' then now() else registration_rate_buckets.window_start end returning attempts into n;
   if n>limit_n then raise exception 'rate_limit'; end if;
 end loop;
 select id into application_id from public.student_registrations where status in ('pending','needs_information','approved') and (lower(email)=lower(btrim(p_email)) or phone=p_phone) order by created_at limit 1;
 if application_id is null then
   insert into public.student_registrations(full_name,email,phone,qualification,institution,program_id,preferred_batch_id,notes,enquiry_id)
   values(btrim(p_full_name),lower(btrim(p_email)),p_phone,btrim(p_qualification),btrim(p_institution),p_program_id,p_preferred_batch_id,nullif(btrim(p_notes),''),linked_enquiry) returning id into application_id;
   insert into public.student_registration_events(registration_id,kind) values(application_id,'submitted');
 elsif linked_enquiry is not null then
   update public.student_registrations set enquiry_id=linked_enquiry,updated_at=now() where id=application_id and status in ('pending','needs_information') and lower(email)=lower(btrim(p_email)) and phone=p_phone and (enquiry_id is null or enquiry_id=linked_enquiry);
   if not found then raise exception 'invalid_link'; end if;
 end if;
 if linked_enquiry is not null then update private.registration_links set consumed_at=now(),registration_id=application_id where token_hash=p_link_hash; end if;
 insert into private.registration_requests values(p_request_id,application_id);
 return jsonb_build_object('accepted',true);
end $$;
revoke all on function private.submit_student_registration(text,text,text,text,text,uuid,uuid,text,boolean,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_student_registration(text,text,text,text,text,uuid,uuid,text,boolean,uuid,text,text,text,text) to service_role;
create function public.submit_student_registration(p_full_name text,p_email text,p_phone text,p_qualification text,p_institution text,p_program_id uuid,p_preferred_batch_id uuid,p_notes text,p_consent boolean,p_request_id uuid,p_ip_hash text,p_phone_hash text,p_email_hash text,p_link_hash text)
returns jsonb language sql security invoker set search_path='' as $$ select private.submit_student_registration(p_full_name,p_email,p_phone,p_qualification,p_institution,p_program_id,p_preferred_batch_id,p_notes,p_consent,p_request_id,p_ip_hash,p_phone_hash,p_email_hash,p_link_hash) $$;
revoke all on function public.submit_student_registration(text,text,text,text,text,uuid,uuid,text,boolean,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_student_registration(text,text,text,text,text,uuid,uuid,text,boolean,uuid,text,text,text,text) to service_role;

create function private.review_student_registration(p_id uuid,p_action text,p_changes jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r public.student_registrations;
begin
 if not private.enquiry_admin() then raise exception 'Administrator required'; end if;
 if p_id is null or p_action not in ('edit','needs_information','rejected') or p_changes is null or jsonb_typeof(p_changes)<>'object'
 or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('full_name','email','phone','qualification','institution','program_id','preferred_batch_id','notes','reason')) then raise exception 'Invalid review'; end if;
 if p_action='edit' and p_changes ? 'reason' then raise exception 'Invalid review'; end if;
 if p_action<>'edit' and (exists(select 1 from jsonb_object_keys(p_changes) k where k<>'reason') or jsonb_typeof(p_changes->'reason') is distinct from 'string' or length(btrim(p_changes->>'reason')) not between 1 and 2000) then raise exception 'Invalid review'; end if;
 select * into r from public.student_registrations where id=p_id for update;
 if not found or r.status in ('approved','rejected') then raise exception 'Application unavailable'; end if;
 if p_action='edit' then
   if exists(select 1 from jsonb_each(p_changes) e where jsonb_typeof(e.value) not in ('string','null')) then raise exception 'Invalid review'; end if;
   r.full_name:=case when p_changes ? 'full_name' then btrim(p_changes->>'full_name') else r.full_name end;
   r.email:=case when p_changes ? 'email' then lower(btrim(p_changes->>'email')) else r.email end;
   r.phone:=case when p_changes ? 'phone' then p_changes->>'phone' else r.phone end;
   r.qualification:=case when p_changes ? 'qualification' then btrim(p_changes->>'qualification') else r.qualification end;
   r.institution:=case when p_changes ? 'institution' then btrim(p_changes->>'institution') else r.institution end;
   r.program_id:=case when p_changes ? 'program_id' then (p_changes->>'program_id')::uuid else r.program_id end;
   r.preferred_batch_id:=case when p_changes ? 'preferred_batch_id' then (p_changes->>'preferred_batch_id')::uuid else r.preferred_batch_id end;
   r.notes:=case when p_changes ? 'notes' then p_changes->>'notes' else r.notes end;
   if r.full_name is null or length(r.full_name) not between 2 and 120 or r.email is null or length(r.email)>254 or r.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or r.phone is null or r.phone !~ '^\+[1-9][0-9]{7,14}$' or r.qualification is null or length(r.qualification) not between 2 and 160 or r.institution is null or length(r.institution) not between 2 and 200 or length(coalesce(r.notes,''))>2000 then raise exception 'Invalid review'; end if;
   if not exists(select 1 from public.programs where id=r.program_id and status='active') then raise exception 'invalid_program'; end if;
   if r.preferred_batch_id is not null and not exists(select 1 from public.batches where id=r.preferred_batch_id and program_id=r.program_id and status='active') then raise exception 'invalid_batch'; end if;
   update public.student_registrations set full_name=r.full_name,email=r.email,phone=r.phone,qualification=r.qualification,institution=r.institution,program_id=r.program_id,preferred_batch_id=r.preferred_batch_id,notes=r.notes,status='pending',updated_at=now() where id=p_id;
 else
   update public.student_registrations set status=p_action,updated_at=now() where id=p_id;
 end if;
 insert into public.student_registration_events(registration_id,actor_id,kind,details) values(p_id,auth.uid(),p_action,jsonb_build_object('fields',case when p_action='edit' then (select jsonb_agg(k) from jsonb_object_keys(p_changes) k) else null end,'reason',case when p_action<>'edit' then btrim(p_changes->>'reason') else null end));
end $$;
revoke all on function private.review_student_registration(uuid,text,jsonb) from public,anon;
grant execute on function private.review_student_registration(uuid,text,jsonb) to authenticated;
create function public.review_student_registration(p_id uuid,p_action text,p_changes jsonb) returns void language sql security invoker set search_path='' as $$ select private.review_student_registration(p_id,p_action,p_changes) $$;
revoke all on function public.review_student_registration(uuid,text,jsonb) from public,anon;
grant execute on function public.review_student_registration(uuid,text,jsonb) to authenticated;

create function private.claim_registration_invitation(p_registration_id uuid,p_attempt_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_attempt_id is null then return false; end if;
 update public.student_registrations set invitation_status='sending',invitation_attempted_at=now(),invitation_attempt_id=p_attempt_id,updated_at=now()
 where id=p_registration_id and status='approved' and student_id is not null and (invitation_status in ('not_sent','failed') or (invitation_status='sending' and invitation_attempted_at<now()-interval '5 minutes') or (invitation_status='sent' and invitation_attempted_at<now()-interval '1 hour'));
 return found;
end $$;
create function private.complete_registration_invitation(p_registration_id uuid,p_attempt_id uuid,p_succeeded boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_succeeded is null then return false; end if;
 update public.student_registrations set invitation_status=case when p_succeeded then 'sent' else 'failed' end,updated_at=now() where id=p_registration_id and status='approved' and invitation_status='sending' and invitation_attempt_id=p_attempt_id;
 return found;
end $$;
revoke all on function private.claim_registration_invitation(uuid,uuid),private.complete_registration_invitation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.claim_registration_invitation(uuid,uuid),private.complete_registration_invitation(uuid,uuid,boolean) to service_role;
create function public.claim_registration_invitation(p_registration_id uuid,p_attempt_id uuid) returns boolean language sql security invoker set search_path='' as $$ select private.claim_registration_invitation(p_registration_id,p_attempt_id) $$;
create function public.complete_registration_invitation(p_registration_id uuid,p_attempt_id uuid,p_succeeded boolean) returns boolean language sql security invoker set search_path='' as $$ select private.complete_registration_invitation(p_registration_id,p_attempt_id,p_succeeded) $$;
revoke all on function public.claim_registration_invitation(uuid,uuid),public.complete_registration_invitation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_registration_invitation(uuid,uuid),public.complete_registration_invitation(uuid,uuid,boolean) to service_role;

-- The canonical Auth admission trigger runs first. This second trigger checks
-- and records self-registration in the SAME Auth transaction. Any failure
-- rolls back identity, profile, enrollment, student code and approval.
create function private.finish_registration_admission() returns trigger language plpgsql security definer set search_path='' as $$
declare admission jsonb := new.raw_app_meta_data->'lms_admission'; r public.student_registrations; actor uuid; v_batch_id uuid;
begin
 if admission is null or nullif(admission->>'registration_id','') is null then return new; end if;
 actor := (admission->>'actor_id')::uuid;
 v_batch_id := (admission->>'batch_id')::uuid;
 select * into r from public.student_registrations where id=(admission->>'registration_id')::uuid for update;
 if not found or r.status<>'pending' or r.student_id is not null or r.consent_at is null
   or new.email_confirmed_at is not null or lower(new.email) is distinct from lower(r.email)
   or admission->>'full_name' is distinct from r.full_name or admission->>'phone' is distinct from r.phone
   or (admission->>'program_id')::uuid is distinct from r.program_id
   or coalesce((admission->>'unassigned')::boolean,false)
   or (nullif(admission->>'enquiry_id','')::uuid is distinct from r.enquiry_id)
   or not exists(select 1 from public.profiles where id=actor and role='admin' and is_active)
   or not exists(select 1 from public.batches b join public.programs p on p.id=b.program_id where b.id=v_batch_id and b.program_id=r.program_id and b.status='active' and b.batch_code is not null and p.status='active')
   or not exists(select 1 from public.profiles where id=new.id and role='student' and is_active and student_code is not null)
   or not exists(select 1 from public.enrollments where student_id=new.id and program_id=r.program_id and batch_id=v_batch_id and status='active') then
   raise exception 'Registration admission validation failed';
 end if;
 update public.student_registrations set status='approved',student_id=new.id,updated_at=now() where id=r.id;
 insert into public.student_registration_events(registration_id,actor_id,kind,details) values(r.id,actor,'approved',jsonb_build_object('student_id',new.id,'batch_id',v_batch_id));
 return new;
end $$;
revoke all on function private.finish_registration_admission() from public,anon,authenticated;
create trigger z_finish_registration_admission after insert on auth.users for each row execute function private.finish_registration_admission();
-- GoTrue can insert an identity first and attach trusted app metadata in a
-- later UPDATE in the same transaction. Complete registration on both paths.
create trigger z_finish_registration_admission_update after update of raw_app_meta_data on auth.users for each row when (new.raw_app_meta_data ? 'lms_admission') execute function private.finish_registration_admission();
create function public.registration_admission_ready() returns boolean language sql stable security invoker set search_path='' as $$
 select private.lms_admission_ready() and exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='z_finish_registration_admission' and tgfoid=to_regprocedure('private.finish_registration_admission()') and tgtype=5 and tgenabled in ('O','A'))
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='z_finish_registration_admission_update' and tgfoid=to_regprocedure('private.finish_registration_admission()') and tgtype=17 and tgqual is not null and tgenabled in ('O','A'))
$$;
revoke all on function public.registration_admission_ready() from public,anon;
grant execute on function public.registration_admission_ready() to authenticated;

-- Invitation must never recreate an unrelated identity if an approved account
-- disappears or changes email between the check and the Auth provider call.
create function private.guard_registration_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   if exists(select 1 from public.student_registrations where status='approved' and lower(email)=lower(new.email)) then raise exception 'Approved registration identity already exists'; end if;
   return new;
 end if;
 if tg_op='DELETE' then
   if exists(select 1 from public.student_registrations where status='approved' and student_id=old.id) then raise exception 'Approved registration identity is protected'; end if;
   return old;
 end if;
 if new.email is distinct from old.email and exists(select 1 from public.student_registrations where status='approved' and student_id=old.id) then raise exception 'Approved registration email is protected'; end if;
 return new;
end $$;
revoke all on function private.guard_registration_identity() from public,anon,authenticated;
create trigger a_guard_registration_identity before insert or delete or update of email on auth.users for each row execute function private.guard_registration_identity();
create function public.registration_invitation_ready() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='a_guard_registration_identity' and tgfoid=to_regprocedure('private.guard_registration_identity()') and tgenabled in ('O','A'))
 and exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass and tgname='z_finish_registration_admission' and tgfoid=to_regprocedure('private.finish_registration_admission()') and tgenabled in ('O','A'))
 and to_regprocedure('private.claim_registration_invitation(uuid,uuid)') is not null and to_regprocedure('private.complete_registration_invitation(uuid,uuid,boolean)') is not null
$$;
revoke all on function public.registration_invitation_ready() from public,anon,authenticated;
grant execute on function public.registration_invitation_ready() to service_role;

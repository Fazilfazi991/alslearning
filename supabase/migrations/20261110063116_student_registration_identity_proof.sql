-- Student registration identity proof; generated with Supabase CLI 3.1.0.
-- One person may apply again after a prior admission; only open applications
-- are deduplicated. Each application still has one immutable linked student.
alter table public.student_registrations drop constraint student_registrations_student_id_key;
create index registration_student_history on public.student_registrations(student_id) where student_id is not null;
drop index public.registration_open_email;
drop index public.registration_open_phone;
create unique index registration_open_email on public.student_registrations(lower(email)) where status in ('pending','needs_information');
create unique index registration_open_phone on public.student_registrations(phone) where status in ('pending','needs_information');
create unique index registration_open_enquiry on public.student_registrations(enquiry_id) where enquiry_id is not null and status in ('pending','needs_information');
create or replace function private.submit_student_registration(p_full_name text,p_email text,p_phone text,p_qualification text,p_institution text,p_program_id uuid,p_preferred_batch_id uuid,p_notes text,p_consent boolean,p_request_id uuid,p_ip_hash text,p_phone_hash text,p_email_hash text,p_link_hash text)
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
   perform pg_advisory_xact_lock(hashtextextended('registration-enquiry:'||linked_enquiry::text,0));
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
 select id into application_id from public.student_registrations where status in ('pending','needs_information') and (lower(email)=lower(btrim(p_email)) or phone=p_phone) order by created_at limit 1;
 if linked_enquiry is not null and application_id is null and exists(select 1 from public.student_registrations where enquiry_id=linked_enquiry and status in ('pending','needs_information')) then raise exception 'invalid_link'; end if;
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

create table private.registration_identity_proofs (
 registration_id uuid primary key references public.student_registrations(id),
 user_id uuid not null references auth.users(id),
 verified_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 check(expires_at>verified_at)
);
alter table private.registration_identity_proofs enable row level security;
revoke all on private.registration_identity_proofs from public,anon,authenticated,service_role;

create function private.record_registration_identity_proof(p_request_id uuid,p_user_id uuid,p_email text) returns boolean
language plpgsql security definer set search_path='' as $$
declare application public.student_registrations; identity_email text; confirmed timestamptz; banned timestamptz; profile_email text; attempts integer;
begin
 if p_request_id is null or p_user_id is null or p_email is null or length(p_email)>254 then return false; end if;
 insert into private.registration_rate_buckets(bucket,window_start,attempts) values('proof:'||p_user_id::text,now(),1)
 on conflict(bucket) do update set attempts=case when registration_rate_buckets.window_start<now()-interval '1 hour' then 1 else registration_rate_buckets.attempts+1 end,
 window_start=case when registration_rate_buckets.window_start<now()-interval '1 hour' then now() else registration_rate_buckets.window_start end returning registration_rate_buckets.attempts into attempts;
 if attempts>10 then return false; end if;
 select r.* into application from private.registration_requests q join public.student_registrations r on r.id=q.registration_id where q.request_id=p_request_id for update of r;
 if not found or application.status<>'pending' or application.student_id is not null or lower(application.email)<>lower(btrim(p_email)) then return false; end if;
 select u.email,u.email_confirmed_at,u.banned_until into identity_email,confirmed,banned from auth.users u where u.id=p_user_id for share;
 if not found or confirmed is null or (banned is not null and banned>now()) or lower(identity_email) is distinct from lower(application.email) then return false; end if;
 select p.email into profile_email from public.profiles p where p.id=p_user_id and p.role='student' and p.is_active for share;
 if not found or lower(profile_email) is distinct from lower(application.email) then return false; end if;
 insert into private.registration_identity_proofs(registration_id,user_id,verified_at,expires_at)
 values(application.id,p_user_id,now(),now()+interval '24 hours')
 on conflict(registration_id) do update set verified_at=excluded.verified_at,expires_at=excluded.expires_at
 where registration_identity_proofs.user_id=excluded.user_id and registration_identity_proofs.consumed_at is null;
 if not found then return false; end if;
 insert into public.student_registration_events(registration_id,actor_id,kind) values(application.id,p_user_id,'identity_verified');
 return true;
end $$;
revoke all on function private.record_registration_identity_proof(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.record_registration_identity_proof(uuid,uuid,text) to service_role;
create function public.record_registration_identity_proof(p_request_id uuid,p_user_id uuid,p_email text) returns boolean
language sql security invoker set search_path='' as $$ select private.record_registration_identity_proof(p_request_id,p_user_id,p_email) $$;
revoke all on function public.record_registration_identity_proof(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_registration_identity_proof(uuid,uuid,text) to service_role;

create function private.registration_existing_student_ready(p_registration_id uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
 if not private.registration_admin() then raise exception 'Administrator required'; end if;
 return exists(select 1 from public.student_registrations r
  join private.registration_identity_proofs proof on proof.registration_id=r.id
  join auth.users u on u.id=proof.user_id
  join public.profiles p on p.id=u.id
  where r.id=p_registration_id and r.status='pending' and r.student_id is null and r.consent_at is not null
    and proof.expires_at>now() and proof.consumed_at is null
    and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
    and lower(u.email)=lower(r.email) and lower(p.email)=lower(r.email) and p.role='student' and p.is_active);
end $$;
revoke all on function private.registration_existing_student_ready(uuid) from public,anon;
grant execute on function private.registration_existing_student_ready(uuid) to authenticated;
create function public.registration_existing_student_ready(p_registration_id uuid) returns boolean
language sql volatile security invoker set search_path='' as $$ select private.registration_existing_student_ready(p_registration_id) $$;
revoke all on function public.registration_existing_student_ready(uuid) from public,anon;
grant execute on function public.registration_existing_student_ready(uuid) to authenticated;

-- Keep existing accounts intact: the only new access comes from a successful,
-- capacity-guarded enrollment and all approval changes commit in one transaction.
alter table public.student_registrations drop constraint student_registrations_invitation_status_check;
alter table public.student_registrations add constraint student_registrations_invitation_status_check check(invitation_status in ('not_sent','sending','sent','failed','not_required'));
create function private.approve_existing_registration(p_registration_id uuid,p_batch_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.student_registrations; proof private.registration_identity_proofs; account auth.users; person public.profiles; batch public.batches; code text;
begin
 if not private.registration_admin() or not private.lms_admission_ready() then raise exception 'Active admission Admin required'; end if;
 if p_registration_id is null or p_batch_id is null then raise exception 'Invalid approval'; end if;
 select * into r from public.student_registrations where id=p_registration_id for update;
 if not found or r.status<>'pending' or r.student_id is not null or r.consent_at is null then raise exception 'Application unavailable'; end if;
 select * into proof from private.registration_identity_proofs where registration_id=r.id for update;
 if not found or proof.consumed_at is not null or proof.expires_at<=now() then raise exception 'Current verified identity proof required'; end if;
 select * into account from auth.users where id=proof.user_id for share;
 if not found or account.email_confirmed_at is null or (account.banned_until is not null and account.banned_until>now()) or lower(account.email) is distinct from lower(r.email) then raise exception 'Verified identity unavailable'; end if;
 select * into person from public.profiles where id=proof.user_id for update;
 if not found or person.role<>'student' or not person.is_active or lower(person.email) is distinct from lower(r.email) then raise exception 'Active student identity required'; end if;
 select * into batch from public.batches where id=p_batch_id for update;
 if not found or batch.program_id<>r.program_id or batch.status<>'active' or batch.batch_code is null or not exists(select 1 from public.programs where id=r.program_id and status='active') then raise exception 'Select an active compatible coded batch'; end if;
 if exists(select 1 from public.enrollments where student_id=person.id and program_id=r.program_id and (status='active' or batch_id=batch.id)) then raise exception 'Existing enrollment requires manual review'; end if;
 if r.enquiry_id is not null then
  perform 1 from public.admission_enquiries where id=r.enquiry_id and student_id is null and status not in ('converted','closed') for update;
  if not found then raise exception 'Enquiry unavailable for admission'; end if;
 end if;
 perform set_config('als.admission_actor',auth.uid()::text,true);
 perform set_config('als.change_reason','Student registration approval',true);
 update public.profiles set admission_on=coalesce(admission_on,current_date) where id=person.id;
 insert into public.enrollments(student_id,program_id,batch_id,enrolled_on,access_starts_at,access_expires_at,status)
 values(person.id,r.program_id,batch.id,current_date,now(),null,'active');
 code:=private.lms_assign_student_code(person.id,batch.id);
 if r.enquiry_id is not null then
  perform set_config('als.enquiry_conversion',r.enquiry_id::text,true);
  update public.admission_enquiries set status='converted',student_id=person.id where id=r.enquiry_id;
 end if;
 update private.registration_identity_proofs set consumed_at=now() where registration_id=r.id;
 update public.student_registrations set status='approved',student_id=person.id,invitation_status='not_required',updated_at=now() where id=r.id;
 insert into public.student_registration_events(registration_id,actor_id,kind,details) values(r.id,auth.uid(),'approved',jsonb_build_object('student_id',person.id,'batch_id',batch.id,'linked_existing',true));
 return jsonb_build_object('student_id',person.id,'student_code',code,'linked_existing',true);
end $$;
revoke all on function private.approve_existing_registration(uuid,uuid) from public,anon;
grant execute on function private.approve_existing_registration(uuid,uuid) to authenticated;
create function public.approve_existing_registration(p_registration_id uuid,p_batch_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.approve_existing_registration(p_registration_id,p_batch_id) $$;
revoke all on function public.approve_existing_registration(uuid,uuid) from public,anon;
grant execute on function public.approve_existing_registration(uuid,uuid) to authenticated;

-- Draft registration-owned recovery. This migration does not enable setup.
-- A confirmed provider success is terminal only if the transport cannot issue
-- a duplicate request after the response. Hosted transport remains unverified.
do $$ begin
 if to_regprocedure('private.account_session_allowed()') is null then
  raise exception 'shared account session guard is required';
 end if;
end $$;
create table private.registration_setup_recoveries (
 id uuid primary key default gen_random_uuid(),
 source_operation uuid not null unique references private.registration_setup_operations(id) on delete restrict,
 registration_id uuid not null references public.student_registrations(id) on delete restrict,
 student_id uuid not null references public.profiles(id) on delete restrict,
 authorized_by uuid not null references public.profiles(id) on delete restrict,
 reason text not null check (reason in ('setup_acknowledgement_lost','operator_assisted_setup')),
 authorized_at timestamptz not null default clock_timestamp(),
 consumed_at timestamptz,
 replacement_operation uuid unique references private.registration_setup_operations(id) on delete restrict,
 check ((consumed_at is null) = (replacement_operation is null))
);
revoke all on private.registration_setup_recoveries from public,anon,authenticated,service_role;
alter table private.registration_setup_operations add column replaces_operation_id uuid unique references private.registration_setup_operations(id) on delete restrict;

-- Only the verified authenticated Admin can authorize; reason is an enum so
-- passwords, links and tokens cannot be accidentally entered into audit text.
create function public.authorize_registration_setup_recovery(p_registration uuid,p_operation uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); target uuid; account uuid; op private.registration_setup_operations; resolution uuid;
begin
 if actor is null or p_registration is null or p_operation is null or p_reason is null or p_reason not in ('setup_acknowledgement_lost','operator_assisted_setup') then return null; end if;
 select student_id into target from private.registration_setup_operations where id=p_operation;
 if target is null then return null; end if;
 for account in select distinct x from unnest(array[actor,target]) as t(x) order by x loop
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||account::text,0)) then return null; end if;
 end loop;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||target::text,0)) then return null; end if;
 if not private.registration_admin() or not private.account_session_allowed() then return null; end if;
 select * into op from private.registration_setup_operations where id=p_operation and student_id=target for update;
 if not found or op.registration_id<>p_registration or not ((op.state in ('provider_confirmed','authorization_denied') and op.provider_outcome='confirmed_success') or (op.state='provider_rejected' and op.provider_outcome='confirmed_rejection')) then return null; end if;
 if not exists(select 1 from public.student_registrations r join public.profiles p on p.id=r.student_id join auth.users u on u.id=p.id
  where r.id=op.registration_id and r.student_id=target and r.status='approved' and p.role='student' and p.is_active and lower(btrim(r.email))=lower(btrim(u.email)) and lower(btrim(r.email))=lower(btrim(p.email)) and (u.banned_until is null or u.banned_until<=clock_timestamp())) then return null; end if;
 if exists(select 1 from private.registration_setup_operations o where o.student_id=target and o.id<>op.id and
   (o.state not in ('superseded','provider_confirmed','authorization_denied','provider_rejected') or (o.state in ('provider_confirmed','authorization_denied','provider_rejected') and not exists(select 1 from private.registration_setup_recoveries r where r.source_operation=o.id and r.consumed_at is not null)))) then return null; end if;
 insert into private.registration_setup_recoveries(source_operation,registration_id,student_id,authorized_by,reason)
 values(op.id,op.registration_id,target,actor,p_reason) on conflict(source_operation) do nothing returning id into resolution;
 if resolution is null then return null; end if;
 insert into public.student_registration_events(registration_id,actor_id,kind,details)
 values(op.registration_id,actor,'setup_recovery_authorized',jsonb_build_object('operation_id',op.id,'authorization_id',resolution,'reason',p_reason));
 return resolution;
end $$;
revoke all on function public.authorize_registration_setup_recovery(uuid,uuid,text) from public,anon,service_role;
grant execute on function public.authorize_registration_setup_recovery(uuid,uuid,text) to authenticated;

create function public.registration_setup_recovery_status(p_registration uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_registration is null or not private.registration_admin() or not private.account_session_allowed() then return null; end if;
 select jsonb_build_object('registration_id',r.id,'student_id',r.student_id,'registration_status',r.status,
   'student_active',p.is_active,'student_role',p.role,'independently_banned',coalesce(u.banned_until>clock_timestamp(),false),
   'operations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'state',o.state,'provider_outcome',o.provider_outcome,
     'access_decision',o.access_decision,'issued_at',o.issued_at,'claimed_at',o.claimed_at,'completed_at',o.completed_at,
     'replaces_operation_id',o.replaces_operation_id,'recovery_authorized',rr.id is not null,'recovery_consumed',rr.consumed_at is not null,
     'recovery_reason',rr.reason,'recovery_authorized_by',rr.authorized_by,'recovery_authorized_at',rr.authorized_at) order by o.issued_at desc)
     from private.registration_setup_operations o left join private.registration_setup_recoveries rr on rr.source_operation=o.id where o.registration_id=r.id),'[]'::jsonb))
 into result from public.student_registrations r left join public.profiles p on p.id=r.student_id left join auth.users u on u.id=r.student_id where r.id=p_registration;
 return result;
end $$;
revoke all on function public.registration_setup_recovery_status(uuid) from public,anon,service_role;
grant execute on function public.registration_setup_recovery_status(uuid) to authenticated;

-- Called only while holding the target account and setup locks. An earlier
-- resolved source remains immutable and does not block its own successor.
create function private.registration_setup_open_recovery(p_registration uuid,p_student uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; n bigint;
begin
 if exists(select 1 from private.registration_setup_operations where student_id=p_student and state not in ('superseded','provider_confirmed','authorization_denied','provider_rejected')) then return null; end if;
 select count(*),min(r.id::text)::uuid into n,result from private.registration_setup_recoveries r
 join private.registration_setup_operations o on o.id=r.source_operation
 where r.registration_id=p_registration and r.student_id=p_student and r.consumed_at is null
 and o.student_id=p_student and o.registration_id=p_registration and ((o.state in ('provider_confirmed','authorization_denied') and o.provider_outcome='confirmed_success') or (o.state='provider_rejected' and o.provider_outcome='confirmed_rejection'));
 if n<>1 then return null; end if;
 if exists(select 1 from private.registration_setup_operations o where o.student_id=p_student and o.state in ('provider_confirmed','authorization_denied','provider_rejected')
   and not exists(select 1 from private.registration_setup_recoveries r where r.source_operation=o.id and (r.consumed_at is not null or r.id=result))) then return null; end if;
 return result;
end $$;
revoke all on function private.registration_setup_open_recovery(uuid,uuid) from public,anon,authenticated,service_role;

create function public.registration_setup_recovery_for_invitation(p_registration uuid,p_student uuid) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if p_registration is null or p_student is null then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 if not exists(select 1 from public.student_registrations r join public.profiles p on p.id=r.student_id join auth.users u on u.id=p.id where r.id=p_registration and r.student_id=p_student and r.status='approved' and p.role='student' and p.is_active and lower(btrim(r.email))=lower(btrim(u.email)) and lower(btrim(r.email))=lower(btrim(p.email)) and (u.banned_until is null or u.banned_until<=clock_timestamp())) then return null; end if;
 return private.registration_setup_open_recovery(p_registration,p_student);
end $$;
revoke all on function public.registration_setup_recovery_for_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.registration_setup_recovery_for_invitation(uuid,uuid) to service_role;

create or replace function public.registration_setup_invitation_available(p_registration uuid,p_student uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_registration is null or p_student is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 if not exists(select 1 from public.student_registrations r join public.profiles p on p.id=r.student_id join auth.users u on u.id=p.id where r.id=p_registration and r.student_id=p_student and r.status='approved' and p.role='student' and p.is_active and lower(btrim(r.email))=lower(btrim(u.email)) and lower(btrim(r.email))=lower(btrim(p.email)) and (u.banned_until is null or u.banned_until<=clock_timestamp())) then return false; end if;
 if private.registration_setup_open_recovery(p_registration,p_student) is not null then return true; end if;
 return not exists(select 1 from private.registration_setup_operations o where o.student_id=p_student and
   (o.state not in ('issued','superseded','provider_confirmed','authorization_denied','provider_rejected') or (o.state in ('provider_confirmed','authorization_denied','provider_rejected') and not exists(select 1 from private.registration_setup_recoveries r where r.source_operation=o.id and r.consumed_at is not null))));
end $$;

create function public.issue_registration_setup_replacement(p_registration uuid,p_student uuid,p_session uuid,p_digest text,p_recovery uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare source uuid; replacement uuid;
begin
 if p_registration is null or p_student is null or p_session is null or p_recovery is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 if not private.registration_setup_identity_allowed(p_registration,p_student,p_session) then return false; end if;
 if not exists(select 1 from public.student_registrations r join auth.users u on u.id=r.student_id join public.profiles p on p.id=r.student_id where r.id=p_registration and r.student_id=p_student and lower(btrim(r.email))=lower(btrim(u.email)) and lower(btrim(r.email))=lower(btrim(p.email))) then return false; end if;
 if private.registration_setup_open_recovery(p_registration,p_student) is distinct from p_recovery then return false; end if;
 select source_operation into source from private.registration_setup_recoveries where id=p_recovery and consumed_at is null for update;
 if source is null then return false; end if;
 insert into private.registration_setup_operations(registration_id,student_id,session_id,grant_digest,state,expires_at,replaces_operation_id)
 values(p_registration,p_student,p_session,p_digest,'issued',clock_timestamp()+interval '10 minutes',source) returning id into replacement;
 update private.registration_setup_recoveries set consumed_at=clock_timestamp(),replacement_operation=replacement where id=p_recovery and consumed_at is null;
 insert into public.student_registration_events(registration_id,actor_id,kind,details)
 values(p_registration,null,'setup_recovery_redeemed',jsonb_build_object('operation_id',source,'replacement_operation_id',replacement,'authorization_id',p_recovery));
 return true;
end $$;
revoke all on function public.issue_registration_setup_replacement(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.issue_registration_setup_replacement(uuid,uuid,uuid,text,uuid) to service_role;

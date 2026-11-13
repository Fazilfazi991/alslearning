-- Draft only. Depends on the reviewed registration and shared account/session
-- migrations. Never apply to a hosted target without a separate drift review.
create table private.registration_setup_operations (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.student_registrations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  session_id uuid not null,
  grant_digest text not null unique check (grant_digest ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('issued','claimed','provider_confirmed','authorization_denied','unknown','superseded')),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  completed_at timestamptz,
  check (expires_at > issued_at)
);
create index registration_setup_student_state on private.registration_setup_operations(student_id,state);
revoke all on private.registration_setup_operations from public, anon, authenticated, service_role;

-- Internal only. The caller first holds the shared account lock; this mirrors
-- the candidate shared guard without treating a caller-supplied ID as proof.
create function private.registration_setup_identity_allowed(p_registration uuid,p_student uuid,p_session uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare previous_claims text := current_setting('request.jwt.claims',true); allowed boolean := false;
begin
  if p_registration is null or p_student is null or p_session is null then return false; end if;
  -- Inputs come exclusively from the server after getUser/getClaims verification.
  -- Restore the request context even on error; never expose a generic setter.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_student,'session_id',p_session,'role','authenticated')::text,true);
  allowed := private.account_session_allowed() and exists (
    select 1 from public.student_registrations r join public.profiles p on p.id=r.student_id
    where r.id=p_registration and r.status='approved' and r.student_id=p_student and p.role='student' and p.is_active
  );
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  return allowed;
exception when others then
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  return false;
end $$;
revoke all on function private.registration_setup_identity_allowed(uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Only trusted server code calls these; p_student and p_session must be
-- derived from verified Auth user/claims, not from request body or cookies.
create function public.issue_registration_setup(p_registration uuid,p_student uuid,p_session uuid,p_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_student is null or p_session is null or p_registration is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 if not private.registration_setup_identity_allowed(p_registration,p_student,p_session) then return false; end if;
 -- Claimed/unknown operations may still write remotely. No replacement can
 -- race them; human reconciliation is required and is intentionally absent.
 if exists(select 1 from private.registration_setup_operations where student_id=p_student and state in ('claimed','unknown','provider_confirmed')) then return false; end if;
 update private.registration_setup_operations set state='superseded',completed_at=clock_timestamp() where student_id=p_student and state='issued';
 insert into private.registration_setup_operations(registration_id,student_id,session_id,grant_digest,state,expires_at)
 values(p_registration,p_student,p_session,p_digest,'issued',clock_timestamp()+interval '10 minutes');
 return true;
end $$;

-- Resends must not knowingly initiate replacement proof while a credential
-- write is in flight or unresolved. Issuance rechecks the same condition.
create function public.registration_setup_invitation_available(p_registration uuid,p_student uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_registration is null or p_student is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 return exists(select 1 from public.student_registrations r join public.profiles p on p.id=r.student_id join auth.users u on u.id=p.id where r.id=p_registration and r.student_id=p_student and r.status='approved' and p.role='student' and p.is_active and (u.banned_until is null or u.banned_until<=clock_timestamp()))
   and not exists(select 1 from private.registration_setup_operations where student_id=p_student and state in ('claimed','unknown','provider_confirmed'));
end $$;
revoke all on function public.registration_setup_invitation_available(uuid,uuid) from public,anon,authenticated;
grant execute on function public.registration_setup_invitation_available(uuid,uuid) to service_role;
create function public.claim_registration_setup(p_student uuid,p_session uuid,p_digest text) returns uuid
language plpgsql security definer set search_path='' as $$
declare op private.registration_setup_operations; result uuid;
begin
 if p_student is null or p_session is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 select * into op from private.registration_setup_operations where grant_digest=p_digest and student_id=p_student and session_id=p_session for update;
 if not found or op.state<>'issued' or op.expires_at<=clock_timestamp() or not private.registration_setup_identity_allowed(op.registration_id,p_student,p_session) then return null; end if;
 update private.registration_setup_operations set state='claimed',claimed_at=clock_timestamp() where id=op.id and state='issued' returning id into result;
 return result;
end $$;

create function public.finish_registration_setup(p_operation uuid,p_student uuid,p_session uuid,p_outcome text) returns text
language plpgsql security definer set search_path='' as $$
declare op private.registration_setup_operations; next_state text;
begin
 if p_student is null or p_session is null or p_operation is null or p_outcome is null or p_outcome not in ('provider_confirmed','unknown') then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 select * into op from private.registration_setup_operations where id=p_operation and student_id=p_student and session_id=p_session for update;
 if not found or op.state<>'claimed' then return null; end if;
 next_state := case when p_outcome='unknown' then 'unknown' when not private.registration_setup_identity_allowed(op.registration_id,p_student,p_session) then 'authorization_denied' else 'provider_confirmed' end;
 update private.registration_setup_operations set state=next_state,completed_at=clock_timestamp() where id=op.id;
 return next_state;
end $$;
revoke all on function public.issue_registration_setup(uuid,uuid,uuid,text),public.claim_registration_setup(uuid,uuid,text),public.finish_registration_setup(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_registration_setup(uuid,uuid,uuid,text),public.claim_registration_setup(uuid,uuid,text),public.finish_registration_setup(uuid,uuid,uuid,text) to service_role;

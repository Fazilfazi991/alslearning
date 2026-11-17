-- Forward-only registration safeguard: a provider-successful operation
-- remains terminal even when the subsequent application check was denied.
-- This does not reopen or resolve any operation.
create or replace function public.issue_registration_setup(p_registration uuid,p_student uuid,p_session uuid,p_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_student is null or p_session is null or p_registration is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 if not private.registration_setup_identity_allowed(p_registration,p_student,p_session) then return false; end if;
 if exists(select 1 from private.registration_setup_operations where student_id=p_student and state not in ('issued','superseded')) then return false; end if;
 update private.registration_setup_operations set state='superseded',completed_at=clock_timestamp() where student_id=p_student and state='issued';
 insert into private.registration_setup_operations(registration_id,student_id,session_id,grant_digest,state,expires_at)
 values(p_registration,p_student,p_session,p_digest,'issued',clock_timestamp()+interval '10 minutes');
 return true;
end $$;

create or replace function public.registration_setup_invitation_available(p_registration uuid,p_student uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_registration is null or p_student is null then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 return exists(select 1 from public.student_registrations r join public.profiles p on p.id=r.student_id join auth.users u on u.id=p.id where r.id=p_registration and r.student_id=p_student and r.status='approved' and p.role='student' and p.is_active and (u.banned_until is null or u.banned_until<=clock_timestamp()))
   and not exists(select 1 from private.registration_setup_operations where student_id=p_student and state not in ('issued','superseded'));
end $$;

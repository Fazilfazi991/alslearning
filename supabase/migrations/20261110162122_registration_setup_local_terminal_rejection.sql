-- Local-only candidate: the service role is trusted to assert a verified
-- provider outcome. Neither an Admin nor a browser can set this outcome.
-- Do not deploy until the actual hosted transport and provider provenance
-- have an independently reviewed equivalent; application release is disabled.
alter table private.registration_setup_operations drop constraint registration_setup_operations_state_check;
alter table private.registration_setup_operations add constraint registration_setup_operations_state_check
 check (state in ('issued','claimed','provider_confirmed','authorization_denied','provider_rejected','unknown','superseded'));
alter table private.registration_setup_operations drop constraint registration_setup_operations_provider_outcome_check;
alter table private.registration_setup_operations add constraint registration_setup_operations_provider_outcome_check
 check (provider_outcome in ('not_dispatched','may_have_dispatched','confirmed_success','confirmed_rejection','unknown'));

create or replace function private.registration_setup_record_outcomes() returns trigger
language plpgsql set search_path='' as $$
begin
  new.provider_outcome := case new.state
    when 'claimed' then 'may_have_dispatched'
    when 'unknown' then 'unknown'
    when 'provider_confirmed' then 'confirmed_success'
    when 'authorization_denied' then 'confirmed_success'
    when 'provider_rejected' then 'confirmed_rejection'
    when 'issued' then 'not_dispatched'
    when 'superseded' then 'not_dispatched'
    else 'unknown' end;
  new.access_decision := case new.state
    when 'provider_confirmed' then 'allowed'
    when 'authorization_denied' then 'denied_or_unavailable'
    else 'not_checked' end;
  return new;
end $$;

create or replace function public.finish_registration_setup(p_operation uuid,p_student uuid,p_session uuid,p_outcome text) returns text
language plpgsql security definer set search_path='' as $$
declare op private.registration_setup_operations; next_state text;
begin
 if p_student is null or p_session is null or p_operation is null or p_outcome is null or p_outcome not in ('provider_confirmed','provider_rejected','unknown') then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 select * into op from private.registration_setup_operations where id=p_operation and student_id=p_student and session_id=p_session for update;
 if not found or op.state<>'claimed' then return null; end if;
 next_state := case when p_outcome='unknown' then 'unknown' when p_outcome='provider_rejected' then 'provider_rejected' when not private.registration_setup_identity_allowed(op.registration_id,p_student,p_session) then 'authorization_denied' else 'provider_confirmed' end;
 update private.registration_setup_operations set state=next_state,completed_at=clock_timestamp() where id=op.id;
 return next_state;
end $$;

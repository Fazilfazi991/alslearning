-- Registration-owned draft. Apply only after the reviewed setup-operations
-- migration; hosted migration history and shared security dependencies must
-- be checked separately. This does not authorize retries or recovery.
alter table private.registration_setup_operations
  add column provider_outcome text not null default 'not_dispatched'
    check (provider_outcome in ('not_dispatched','may_have_dispatched','confirmed_success','unknown')),
  add column access_decision text not null default 'not_checked'
    check (access_decision in ('not_checked','allowed','denied_or_unavailable'));

-- The legacy function deliberately folds guard exceptions into false. Its
-- denied state therefore cannot distinguish a denial from an unavailable
-- check. Keep that uncertainty instead of manufacturing an audit conclusion.
update private.registration_setup_operations set
  provider_outcome = case state
    when 'claimed' then 'may_have_dispatched'
    when 'unknown' then 'unknown'
    when 'provider_confirmed' then 'confirmed_success'
    when 'authorization_denied' then 'confirmed_success'
    when 'issued' then 'not_dispatched'
    when 'superseded' then 'not_dispatched'
    else 'unknown' end,
  access_decision = case state
    when 'provider_confirmed' then 'allowed'
    when 'authorization_denied' then 'denied_or_unavailable'
    else 'not_checked' end;

create function private.registration_setup_record_outcomes() returns trigger
language plpgsql set search_path='' as $$
begin
  new.provider_outcome := case new.state
    when 'claimed' then 'may_have_dispatched'
    when 'unknown' then 'unknown'
    when 'provider_confirmed' then 'confirmed_success'
    when 'authorization_denied' then 'confirmed_success'
    when 'issued' then 'not_dispatched'
    when 'superseded' then 'not_dispatched'
    else 'unknown' end;
  new.access_decision := case new.state
    when 'provider_confirmed' then 'allowed'
    when 'authorization_denied' then 'denied_or_unavailable'
    else 'not_checked' end;
  return new;
end $$;
revoke all on function private.registration_setup_record_outcomes() from public, anon, authenticated, service_role;
create trigger registration_setup_record_outcomes before insert or update of state
on private.registration_setup_operations for each row
execute function private.registration_setup_record_outcomes();

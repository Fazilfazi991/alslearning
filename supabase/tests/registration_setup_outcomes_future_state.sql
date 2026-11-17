-- Run only in the synthetic race lab after its route tests have created an
-- operation. Simulate a future migration introducing a new state, and roll
-- the schema and row change back immediately.
begin;
alter table private.registration_setup_operations drop constraint registration_setup_operations_state_check;
update private.registration_setup_operations set state='future_unrecognized'
where id=(select id from private.registration_setup_operations limit 1);
do $$ begin
  if not exists (select 1 from private.registration_setup_operations
    where state='future_unrecognized' and provider_outcome='unknown' and access_decision='not_checked') then
    raise exception 'An unrecognized future state did not fail closed';
  end if;
end $$;
rollback;

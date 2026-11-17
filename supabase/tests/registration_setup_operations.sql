-- Disposable synthetic lab only. Entire fixture and operation are rolled back.
begin;
set local role als_account_status_writer;
update public.profiles set is_active=true where id='10000000-0000-4000-8000-000000000011';
reset role;
update auth.users set banned_until=null where id='10000000-0000-4000-8000-000000000011';
update auth.sessions set created_at=clock_timestamp(),not_after=null where id='20000000-0000-4000-8000-000000000011';
delete from private.registration_setup_operations;
do $$ begin
 if exists (select 1 from unnest(array['anon','authenticated']) as role_name cross join unnest(array['public.issue_registration_setup(uuid,uuid,uuid,text)','public.claim_registration_setup(uuid,uuid,text)','public.finish_registration_setup(uuid,uuid,uuid,text)','public.registration_setup_invitation_available(uuid,uuid)']) as fn where has_function_privilege(role_name,fn,'execute')) then
   raise exception 'public grant RPC exposed to client roles';
 end if;
end $$;
-- An absent claims value is restored, including when the predicate raises.
select set_config('request.jwt.claims','',true);
do $$ begin
  perform private.registration_setup_identity_allowed('80000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000011');
  if coalesce(current_setting('request.jwt.claims',true),'')<>'' then raise exception 'absent claims changed'; end if;
end $$;
alter table public.student_registrations rename to student_registrations_test_hidden;
select set_config('request.jwt.claims','{"role":"service_role","sub":"prior"}',true);
do $$ begin
  if private.registration_setup_identity_allowed('80000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000011') then raise exception 'exception should deny'; end if;
  if current_setting('request.jwt.claims',true)<>'{"role":"service_role","sub":"prior"}' then raise exception 'claims changed after exception'; end if;
end $$;
alter table public.student_registrations_test_hidden rename to student_registrations;
set local role service_role;
set local request.jwt.claims='{"role":"service_role","sub":"before"}';
do $$
declare r constant uuid := '80000000-0000-4000-8000-000000000099';
 u constant uuid := '10000000-0000-4000-8000-000000000011';
 s constant uuid := '20000000-0000-4000-8000-000000000011'; op uuid;
begin
 if public.issue_registration_setup(r,u,s,null) then raise exception 'null accepted'; end if;
 if public.claim_registration_setup(u,s,null) is not null then raise exception 'null claim accepted'; end if;
 if public.finish_registration_setup(null,u,s,null) is not null then raise exception 'null outcome accepted'; end if;
 if not public.issue_registration_setup(r,u,s,repeat('e',64)) then raise exception 'issue failed'; end if;
 if not public.registration_setup_invitation_available(r,u) then raise exception 'unused grant blocked resend'; end if;
 if current_setting('request.jwt.claims',true) <> '{"role":"service_role","sub":"before"}' then raise exception 'claim context changed'; end if;
 if public.claim_registration_setup(u,'20000000-0000-4000-8000-000000000012',repeat('e',64)) is not null then raise exception 'wrong session accepted'; end if;
 if public.claim_registration_setup('10000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000012',repeat('e',64)) is not null then raise exception 'wrong student accepted'; end if;
 if public.issue_registration_setup('80000000-0000-4000-8000-000000000098',u,s,repeat('f',64)) then raise exception 'wrong application accepted'; end if;
 op:=public.claim_registration_setup(u,s,repeat('e',64));
 if op is null then raise exception 'valid claim failed'; end if;
 if public.claim_registration_setup(u,s,repeat('e',64)) is not null then raise exception 'claim replay accepted'; end if;
 if public.finish_registration_setup(op,u,s,'unknown')<>'unknown' then raise exception 'unknown not recorded'; end if;
 if public.issue_registration_setup(r,u,s,repeat('f',64)) then raise exception 'replacement accepted during uncertainty'; end if;
 if public.registration_setup_invitation_available(r,u) then raise exception 'uncertain operation allowed resend'; end if;
 if current_setting('request.jwt.claims',true) <> '{"role":"service_role","sub":"before"}' then raise exception 'claim context changed'; end if;
end $$;
reset role;
do $$ begin
  begin
    delete from public.student_registrations where id='80000000-0000-4000-8000-000000000099';
    raise exception 'deletion unexpectedly succeeded';
  exception when foreign_key_violation then null;
  end;
end $$;
rollback;

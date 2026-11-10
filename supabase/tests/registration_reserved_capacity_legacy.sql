begin;
insert into public.programs(id,slug,name,status) values('f7000000-0000-4000-8000-000000000001','qa-legacy','QA legacy','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values('f7000000-0000-4000-8000-000000000002','f7000000-0000-4000-8000-000000000001','qa-legacy','QA legacy','LEGACYQA','active',4);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('f7000000-0000-4000-8000-000000000010','legacy-admin@example.invalid',now(),'{"role":"admin"}','{"full_name":"Admin"}'),
('f7000000-0000-4000-8000-000000000011','legacy1@example.invalid',now(),'{"role":"student"}','{"full_name":"One"}'),
('f7000000-0000-4000-8000-000000000012','legacy2@example.invalid',now(),'{"role":"student"}','{"full_name":"Two"}');
update public.profiles set is_active=false where id='f7000000-0000-4000-8000-000000000011';
insert into public.enrollments(student_id,program_id,batch_id,access_starts_at,access_expires_at,status) values
('f7000000-0000-4000-8000-000000000011','f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000002',now()+interval '1 hour',null,'active'),
('f7000000-0000-4000-8000-000000000012','f7000000-0000-4000-8000-000000000001','f7000000-0000-4000-8000-000000000002',now()-interval '3 hours',now()-interval '1 hour','active');
do $$ begin
 if not private.lms_capacity_legacy_row_mode() then raise exception 'Legacy capacity mode missing'; end if;
 if private.lms_reserved_capacity_count('f7000000-0000-4000-8000-000000000002',clock_timestamp(),null)<>2 then raise exception 'Legacy active rows not reflected'; end if;
 begin update public.batches set max_students=1 where id='f7000000-0000-4000-8000-000000000002'; raise exception 'Capacity below legacy count accepted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f7000000-0000-4000-8000-000000000010"}',true);
set local role authenticated;
do $$ begin if (select occupied from public.registration_batch_occupancy() where batch_id='f7000000-0000-4000-8000-000000000002')<>2 then raise exception 'Legacy RPC did not reflect stricter active-row count'; end if; end $$;
reset role;
create or replace function private.lms_enrollment_capacity_guard() returns trigger language plpgsql security definer set search_path='' as $$ begin return new; end $$;
do $$ begin
 begin perform private.lms_capacity_legacy_row_mode(); raise exception 'Unknown guard accepted'; exception when raise_exception then if sqlerrm not like 'Unrecognized enrollment capacity guard%' then raise; end if; end;
end $$;
rollback;

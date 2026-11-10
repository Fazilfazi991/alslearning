begin;
insert into public.programs(id,slug,name,status) values('f4000000-0000-4000-8000-000000000001','qa-reserved','QA reserved','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values
('f4000000-0000-4000-8000-000000000002','f4000000-0000-4000-8000-000000000001','qa-reserved-a','QA reserved A','RESERVEA','active',2),
('f4000000-0000-4000-8000-000000000003','f4000000-0000-4000-8000-000000000001','qa-reserved-b','QA reserved B','RESERVEB','active',2);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('f4000000-0000-4000-8000-000000000010','reserved-admin@example.invalid',now(),'{"role":"admin"}','{"full_name":"Admin"}'),
('f4000000-0000-4000-8000-000000000011','reserved-one@example.invalid',now(),'{"role":"student"}','{"full_name":"One"}'),
('f4000000-0000-4000-8000-000000000012','reserved-two@example.invalid',now(),'{"role":"student"}','{"full_name":"Two"}'),
('f4000000-0000-4000-8000-000000000013','reserved-three@example.invalid',now(),'{"role":"student"}','{"full_name":"Three"}'),
('f4000000-0000-4000-8000-000000000014','reserved-four@example.invalid',now(),'{"role":"student"}','{"full_name":"Four"}');
update public.profiles set is_active=false where id='f4000000-0000-4000-8000-000000000012';
insert into public.enrollments(id,student_id,program_id,batch_id,access_starts_at,access_expires_at,status) values
('f4000000-0000-4000-8000-000000000021','f4000000-0000-4000-8000-000000000011','f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',now()+interval '1 hour',now()+interval '3 hours','active'),
('f4000000-0000-4000-8000-000000000022','f4000000-0000-4000-8000-000000000012','f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000002',now()+interval '1 hour',now()+interval '3 hours','active'),
('f4000000-0000-4000-8000-000000000023','f4000000-0000-4000-8000-000000000013','f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000003',now()-interval '3 hours',now()-interval '1 hour','active');
update public.batches set max_students=1 where id='f4000000-0000-4000-8000-000000000002';
do $$ begin
 if private.lms_reserved_capacity_count('f4000000-0000-4000-8000-000000000002',clock_timestamp(),null)<>1 then raise exception 'Future seat missing or inactive student counted'; end if;
 if private.lms_reserved_capacity_count('f4000000-0000-4000-8000-000000000003',clock_timestamp(),null)<>0 then raise exception 'Expired enrollment counted'; end if;
 begin update public.profiles set is_active=true where id='f4000000-0000-4000-8000-000000000012'; raise exception 'Reactivation into reserved batch accepted'; exception when check_violation then if sqlerrm not like '%no unreserved seats%' then raise; end if; end;
 if (select is_active from public.profiles where id='f4000000-0000-4000-8000-000000000012') then raise exception 'Rejected reactivation persisted'; end if;
end $$;
-- Deactivating the existing account frees the reservation; another student can activate.
update public.profiles set is_active=false where id='f4000000-0000-4000-8000-000000000011';
update public.profiles set is_active=true where id='f4000000-0000-4000-8000-000000000012';
update public.enrollments set access_expires_at=now()+interval '3 hours' where id='f4000000-0000-4000-8000-000000000023';
insert into public.enrollments(student_id,program_id,batch_id,access_starts_at,access_expires_at,status) values('f4000000-0000-4000-8000-000000000014','f4000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000003',now()+interval '1 hour',now()+interval '3 hours','active');
do $$ begin
 if private.lms_reserved_capacity_count('f4000000-0000-4000-8000-000000000002',clock_timestamp(),null)<>1 then raise exception 'Activation/deactivation count wrong'; end if;
 begin update public.batches set max_students=1 where id='f4000000-0000-4000-8000-000000000003'; raise exception 'Capacity reduction below reservations accepted'; exception when check_violation then if sqlerrm not like '%reserved student seats%' then raise; end if; end;
 if has_function_privilege('anon','public.registration_batch_occupancy()','execute') then raise exception 'Anonymous RPC access'; end if;
end $$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f4000000-0000-4000-8000-000000000013"}',true);
set local role authenticated;
do $$ begin
 begin perform * from public.registration_batch_occupancy(); raise exception 'Non-admin RPC accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f4000000-0000-4000-8000-000000000010"}',true);
set local role authenticated;
do $$ begin
 if (select occupied from public.registration_batch_occupancy() where batch_id='f4000000-0000-4000-8000-000000000002')<>1 then raise exception 'Admin occupancy differs from guard'; end if;
end $$;
reset role;
rollback;

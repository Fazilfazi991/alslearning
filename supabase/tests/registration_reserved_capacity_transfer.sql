begin;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values('f8000000-0000-4000-8000-000000000010','transfer-admin@example.invalid',now(),'{"role":"admin"}','{"full_name":"Admin"}');
insert into public.programs(id,slug,name,status) values('f8000000-0000-4000-8000-000000000001','qa-transfer-capacity','QA transfer','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values
('f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000001','qa-transfer-from','QA from','FROMQA','active',2),
('f8000000-0000-4000-8000-000000000003','f8000000-0000-4000-8000-000000000001','qa-transfer-to','QA to','TOQA','active',1);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('f8000000-0000-4000-8000-000000000011','transfer1@example.invalid',now(),'{"role":"student"}','{"full_name":"One"}'),
('f8000000-0000-4000-8000-000000000012','transfer2@example.invalid',now(),'{"role":"student"}','{"full_name":"Two"}');
insert into public.enrollments(id,student_id,program_id,batch_id,access_starts_at,status) values
('f8000000-0000-4000-8000-000000000021','f8000000-0000-4000-8000-000000000011','f8000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000002',now(),'active'),
('f8000000-0000-4000-8000-000000000022','f8000000-0000-4000-8000-000000000012','f8000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000003',now()+interval '1 hour','active');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"f8000000-0000-4000-8000-000000000010"}',true);
set local role authenticated;
do $$ begin
 begin
  perform public.lms_transfer_student('f8000000-0000-4000-8000-000000000021','f8000000-0000-4000-8000-000000000003',clock_timestamp(),'QA transfer');
  raise exception 'Transfer into reserved full batch accepted';
 exception when check_violation then if sqlerrm not like '%no unreserved seats%' and sqlerrm not like '%full%' then raise; end if; end;
end $$;
reset role;
do $$ begin if not exists(select 1 from public.enrollments where id='f8000000-0000-4000-8000-000000000021' and batch_id='f8000000-0000-4000-8000-000000000002') then raise exception 'Rejected transfer moved student'; end if; end $$;
rollback;

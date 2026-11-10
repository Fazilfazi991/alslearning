begin;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values('f3000000-0000-4000-8000-000000000010','skew-admin@example.invalid',now(),'{"role":"admin"}','{"full_name":"Admin"}');
insert into public.programs(id,slug,name,status) values('f3000000-0000-4000-8000-000000000001','qa-clock-skew','QA clock skew','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values('f3000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000001','qa-clock-skew','QA clock skew','SKEWQA','active',1);
select public.submit_student_registration('Clock One','clock1@example.invalid','+919876548101','BSc','QA institute','f3000000-0000-4000-8000-000000000001',null,null,true,'f3000000-0000-4000-8000-000000000021',repeat('1',64),repeat('2',64),repeat('3',64),null);
select public.submit_student_registration('Clock Two','clock2@example.invalid','+919876548102','BSc','QA institute','f3000000-0000-4000-8000-000000000001',null,null,true,'f3000000-0000-4000-8000-000000000022',repeat('1',64),repeat('4',64),repeat('5',64),null);
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
select 'f3000000-0000-4000-8000-000000000011',email,jsonb_build_object('role','student','lms_admission',jsonb_build_object('actor_id','f3000000-0000-4000-8000-000000000010','registration_id',id,'full_name',full_name,'phone',phone,'admission_on',current_date,'program_id',program_id,'batch_id','f3000000-0000-4000-8000-000000000002','access_starts_at',now()+interval '1 hour','unassigned',false,'is_active',true)),jsonb_build_object('full_name',full_name) from public.student_registrations where email='clock1@example.invalid';
do $$ begin
 begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
  select 'f3000000-0000-4000-8000-000000000012',email,jsonb_build_object('role','student','lms_admission',jsonb_build_object('actor_id','f3000000-0000-4000-8000-000000000010','registration_id',id,'full_name',full_name,'phone',phone,'admission_on',current_date,'program_id',program_id,'batch_id','f3000000-0000-4000-8000-000000000002','access_starts_at',now()+interval '1 hour','unassigned',false,'is_active',true)),jsonb_build_object('full_name',full_name) from public.student_registrations where email='clock2@example.invalid';
  raise exception 'Second future-start registration accepted';
 exception when check_violation then if sqlerrm not like '%no unreserved seats%' and sqlerrm not like '%reached its Student capacity%' and sqlerrm not like '%batch is full%' then raise; end if; end;
 if exists(select 1 from auth.users where id='f3000000-0000-4000-8000-000000000012') then raise exception 'Rejected account persisted'; end if;
 if not exists(select 1 from public.student_registrations where email='clock2@example.invalid' and status='pending' and student_id is null) then raise exception 'Failed approval did not roll back'; end if;
 if private.lms_reserved_capacity_count('f3000000-0000-4000-8000-000000000002',clock_timestamp(),null)<>1 then raise exception 'Future seat not reserved'; end if;
end $$;
rollback;

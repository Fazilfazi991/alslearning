-- Disposable PostgreSQL only. The test rolls back its fixtures.
begin;
do $$ begin
 if has_table_privilege('anon','public.student_registrations','select') or has_table_privilege('authenticated','public.student_registrations','insert') then raise exception 'Application access exposed'; end if;
 if has_function_privilege('anon','public.submit_student_registration(text,text,text,text,text,uuid,uuid,text,boolean,uuid,text,text,text)','execute') then raise exception 'Public submission RPC exposed'; end if;
end $$;
insert into public.programs(id,slug,name,status) values('b0000000-0000-4000-8000-000000000001','registration-qa','QA program','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','registration-qa','QA batch','REGQA','active',1);
set local role service_role;
do $$ begin
 begin
  perform public.submit_student_registration('Test Student','reg-qa@example.invalid','+919876543210','BSc','Test institution','b0000000-0000-4000-8000-000000000001',null,null,false,'b0000000-0000-4000-8000-000000000005',repeat('a',64),repeat('b',64),repeat('c',64));
  raise exception 'Missing consent accepted';
 exception when invalid_parameter_value then null; end;
end $$;
select public.submit_student_registration('Test Student','reg-qa@example.invalid','+919876543210','BSc','Test institution','b0000000-0000-4000-8000-000000000001',null,null,true,'b0000000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64),repeat('c',64));
select public.submit_student_registration('Test Student','reg-qa@example.invalid','+919876543210','BSc','Test institution','b0000000-0000-4000-8000-000000000001',null,null,true,'b0000000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64),repeat('c',64));
select public.submit_student_registration('Test Student','reg-qa@example.invalid','+919876543210','BSc','Test institution','b0000000-0000-4000-8000-000000000001',null,null,true,'b0000000-0000-4000-8000-000000000004',repeat('a',64),repeat('b',64),repeat('c',64));
reset role;
do $$ begin
 if (select count(*) from public.student_registrations where email='reg-qa@example.invalid')<>1 then raise exception 'Duplicate registration'; end if;
 if exists(select 1 from auth.users where email='reg-qa@example.invalid') then raise exception 'Identity created before approval'; end if;
end $$;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('b0000000-0000-4000-8000-000000000010','reg-admin@example.invalid','{"role":"admin"}','{"full_name":"Test Admin"}');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000010"}',true);
set local role authenticated;
do $$ begin if not public.registration_admission_ready() then raise exception 'Admission readiness false'; end if; end $$;
select public.review_student_registration((select id from public.student_registrations where email='reg-qa@example.invalid'),'needs_information','{"reason":"Please clarify qualification"}');
select public.review_student_registration((select id from public.student_registrations where email='reg-qa@example.invalid'),'edit','{"qualification":"BSc MLT"}');
reset role;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
select 'b0000000-0000-4000-8000-000000000011',email,jsonb_build_object('role','student','lms_admission',jsonb_build_object('actor_id','b0000000-0000-4000-8000-000000000010','registration_id',id,'full_name',full_name,'phone',phone,'admission_on','2026-11-10','program_id',program_id,'batch_id','b0000000-0000-4000-8000-000000000002','access_starts_at','2026-11-10T00:00:00Z','unassigned',false,'is_active',true)),jsonb_build_object('full_name',full_name) from public.student_registrations where email='reg-qa@example.invalid';
do $$ declare app uuid; begin
 select id into app from public.student_registrations where email='reg-qa@example.invalid' and status='approved' and student_id='b0000000-0000-4000-8000-000000000011';
 if app is null or not exists(select 1 from public.profiles where id='b0000000-0000-4000-8000-000000000011' and student_code like 'ALS-REGQA-%') then raise exception 'Admission did not commit'; end if;
 if not public.registration_invitation_ready() then raise exception 'Invitation readiness false'; end if;
 if not public.claim_registration_invitation(app,'b0000000-0000-4000-8000-000000000012') or public.claim_registration_invitation(app,'b0000000-0000-4000-8000-000000000013') then raise exception 'Invitation lease failed'; end if;
 if public.complete_registration_invitation(app,'b0000000-0000-4000-8000-000000000013',true) or not public.complete_registration_invitation(app,'b0000000-0000-4000-8000-000000000012',false) then raise exception 'Invitation fence failed'; end if;
 begin delete from auth.users where id='b0000000-0000-4000-8000-000000000011'; raise exception 'Identity deletion accepted'; exception when raise_exception then if sqlerrm<>'Approved registration identity is protected' then raise; end if; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000099"}',true);
do $$ begin if exists(select 1 from public.student_registrations) or exists(select 1 from public.student_registration_events) then raise exception 'Unauthorized read'; end if; end $$;
rollback;

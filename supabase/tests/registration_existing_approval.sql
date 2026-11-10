-- Disposable migrated DB only; rollback preserves its initial state.
begin;
insert into public.programs(id,slug,name,status) values
 ('d0000000-0000-4000-8000-000000000001','existing-qa-one','Existing QA one','active'),
 ('d0000000-0000-4000-8000-000000000002','existing-qa-two','Existing QA two','active');
insert into public.batches(id,program_id,slug,name,batch_code,status,max_students) values
 ('d0000000-0000-4000-8000-000000000011','d0000000-0000-4000-8000-000000000001','existing-full','Full batch','EXFULL','active',1),
 ('d0000000-0000-4000-8000-000000000012','d0000000-0000-4000-8000-000000000001','existing-open','Open batch','EXOPEN','active',1),
 ('d0000000-0000-4000-8000-000000000013','d0000000-0000-4000-8000-000000000002','existing-two','Second batch','EXTWO','active',1);
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 ('d0000000-0000-4000-8000-000000000020','existing-admin@example.invalid',now(),'{"role":"admin"}','{"full_name":"Admin"}'),
 ('d0000000-0000-4000-8000-000000000021','existing-student@example.invalid',now(),'{"role":"student"}','{"full_name":"Existing Student"}'),
 ('d0000000-0000-4000-8000-000000000022','existing-filler@example.invalid',now(),'{"role":"student"}','{"full_name":"Filler"}');
do $$ begin if to_regclass('auth.sessions') is not null then execute $q$insert into auth.sessions(id,user_id,created_at) values('d0000000-0000-4000-8000-000000000023','d0000000-0000-4000-8000-000000000020',now())$q$; end if; end $$;
insert into public.enrollments(student_id,program_id,batch_id,status,access_starts_at) values('d0000000-0000-4000-8000-000000000022','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000011','active',now());
select public.submit_student_registration('Existing Student','existing-student@example.invalid','+919876543240','BSc','Test institution','d0000000-0000-4000-8000-000000000001',null,null,true,'d0000000-0000-4000-8000-000000000024',repeat('a',64),repeat('b',64),repeat('c',64),null);
select public.record_registration_identity_proof('d0000000-0000-4000-8000-000000000024','d0000000-0000-4000-8000-000000000021','existing-student@example.invalid');
update private.registration_identity_proofs set verified_at=now()-interval '2 days',expires_at=now()-interval '1 day' where registration_id=(select id from public.student_registrations where email='existing-student@example.invalid' and status='pending');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"d0000000-0000-4000-8000-000000000020","session_id":"d0000000-0000-4000-8000-000000000023"}',true);
set local role authenticated;
do $$ declare application uuid; begin
 select id into application from public.student_registrations where email='existing-student@example.invalid' and status='pending';
 if public.registration_existing_student_ready(application) then raise exception 'Expired proof marked ready'; end if;
 begin perform public.approve_existing_registration(application,'d0000000-0000-4000-8000-000000000012'); raise exception 'Expired proof accepted'; exception when raise_exception then if sqlerrm<>'Current verified identity proof required' then raise; end if; end;
end $$;
reset role;
select public.record_registration_identity_proof('d0000000-0000-4000-8000-000000000024','d0000000-0000-4000-8000-000000000021','existing-student@example.invalid');
set local role authenticated;
do $$ declare application uuid; begin
 select id into application from public.student_registrations where email='existing-student@example.invalid' and status='pending';
 if not public.registration_existing_student_ready(application) then raise exception 'Verified identity not ready'; end if;
 begin perform public.approve_existing_registration(application,'d0000000-0000-4000-8000-000000000011'); raise exception 'Full batch accepted'; exception when check_violation then null; end;
 if not exists(select 1 from public.student_registrations where id=application and status='pending' and student_id is null) then raise exception 'Full batch changed application'; end if;
 perform public.approve_existing_registration(application,'d0000000-0000-4000-8000-000000000012');
 if not exists(select 1 from public.student_registrations where id=application and status='approved' and student_id='d0000000-0000-4000-8000-000000000021' and invitation_status='not_required') then raise exception 'Approval missing'; end if;
 begin perform public.approve_existing_registration(application,'d0000000-0000-4000-8000-000000000012'); raise exception 'Approval replay accepted'; exception when raise_exception then if sqlerrm<>'Application unavailable' then raise; end if; end;
end $$;
reset role;
do $$ declare c text; begin
 if public.record_registration_identity_proof('d0000000-0000-4000-8000-000000000024','d0000000-0000-4000-8000-000000000021','existing-student@example.invalid') then raise exception 'Consumed proof renewed'; end if;
 select student_code into c from public.profiles where id='d0000000-0000-4000-8000-000000000021';
 if c not like 'ALS-EXOPEN-%' or not exists(select 1 from public.student_batch_history where student_id='d0000000-0000-4000-8000-000000000021' and batch_id='d0000000-0000-4000-8000-000000000012') then raise exception 'Student code or history missing'; end if;
 perform public.submit_student_registration('Existing Student','existing-student@example.invalid','+919876543240','BSc','Test institution','d0000000-0000-4000-8000-000000000001',null,null,true,'d0000000-0000-4000-8000-000000000026',repeat('a',64),repeat('b',64),repeat('c',64),null);
 if not public.record_registration_identity_proof('d0000000-0000-4000-8000-000000000026','d0000000-0000-4000-8000-000000000021','existing-student@example.invalid') then raise exception 'Repeat application proof failed'; end if;
end $$;
set local role authenticated;
do $$ declare application uuid; begin
 select id into application from public.student_registrations where email='existing-student@example.invalid' and status='pending';
 begin perform public.approve_existing_registration(application,'d0000000-0000-4000-8000-000000000012'); raise exception 'Duplicate enrollment accepted'; exception when raise_exception then if sqlerrm<>'Existing enrollment requires manual review' then raise; end if; end;
 perform public.review_student_registration(application,'rejected','{"reason":"Already enrolled in this program"}');
end $$;
reset role;
do $$ begin
 perform public.submit_student_registration('Existing Student','existing-student@example.invalid','+919876543240','BSc','Test institution','d0000000-0000-4000-8000-000000000002',null,null,true,'d0000000-0000-4000-8000-000000000025',repeat('a',64),repeat('b',64),repeat('c',64),null);
 if not public.record_registration_identity_proof('d0000000-0000-4000-8000-000000000025','d0000000-0000-4000-8000-000000000021','existing-student@example.invalid') then raise exception 'Second application proof failed'; end if;
end $$;
set local role authenticated;
do $$ declare application uuid; begin
 select id into application from public.student_registrations where email='existing-student@example.invalid' and status='pending';
 perform public.approve_existing_registration(application,'d0000000-0000-4000-8000-000000000013');
end $$;
reset role;
do $$ begin
 if (select count(*) from public.student_registrations where student_id='d0000000-0000-4000-8000-000000000021' and status='approved')<>2 then raise exception 'Second admission lost'; end if;
 if (select student_code from public.profiles where id='d0000000-0000-4000-8000-000000000021') not like 'ALS-EXOPEN-%' then raise exception 'Permanent code changed'; end if;
end $$;
rollback;

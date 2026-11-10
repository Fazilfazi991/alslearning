-- Disposable migrated database only. All fixtures are rolled back.
begin;
do $$ begin
 if has_function_privilege('anon','public.record_registration_identity_proof(uuid,uuid,text)','execute') or has_function_privilege('authenticated','public.record_registration_identity_proof(uuid,uuid,text)','execute') then raise exception 'Identity proof exposed'; end if;
 if has_table_privilege('authenticated','private.registration_identity_proofs','select') then raise exception 'Identity evidence exposed'; end if;
end $$;
insert into public.programs(id,slug,name,status) values('c0000000-0000-4000-8000-000000000001','proof-qa','Proof QA','active');
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('c0000000-0000-4000-8000-000000000002','proof-student@example.invalid','{"role":"student"}','{"full_name":"Proof Student"}'),
 ('c0000000-0000-4000-8000-000000000003','proof-other@example.invalid','{"role":"student"}','{"full_name":"Other Student"}');
select public.submit_student_registration('Proof Student','proof-student@example.invalid','+919876543230','BSc','Test institution','c0000000-0000-4000-8000-000000000001',null,null,true,'c0000000-0000-4000-8000-000000000004',repeat('a',64),repeat('b',64),repeat('c',64),null);
do $$ begin
 if public.record_registration_identity_proof('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000002','proof-student@example.invalid') then raise exception 'Unconfirmed identity accepted'; end if;
 update auth.users set email_confirmed_at=now() where id in ('c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000003');
 if public.record_registration_identity_proof('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000003','proof-student@example.invalid') then raise exception 'Mismatched identity accepted'; end if;
 if not public.record_registration_identity_proof('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000002','proof-student@example.invalid') then raise exception 'Valid proof rejected'; end if;
 if not public.record_registration_identity_proof('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000002','proof-student@example.invalid') then raise exception 'Same-identity proof renewal rejected'; end if;
 if not exists(select 1 from private.registration_identity_proofs p join public.student_registrations r on r.id=p.registration_id where r.status='pending' and r.student_id is null and p.user_id='c0000000-0000-4000-8000-000000000002' and p.expires_at>now()) then raise exception 'Proof or pending state missing'; end if;
 if exists(select 1 from public.enrollments where student_id='c0000000-0000-4000-8000-000000000002') then raise exception 'Proof granted enrollment'; end if;
 if (select count(*) from public.student_registration_events where kind='identity_verified' and actor_id='c0000000-0000-4000-8000-000000000002')<>2 then raise exception 'Proof audit missing'; end if;
 update private.registration_identity_proofs set user_id='c0000000-0000-4000-8000-000000000003' where registration_id=(select id from public.student_registrations where email='proof-student@example.invalid');
 if public.record_registration_identity_proof('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000002','proof-student@example.invalid') then raise exception 'Existing proof rebound to another user'; end if;
 for i in 1..10 loop perform public.record_registration_identity_proof('c0000000-0000-4000-8000-000000000099','c0000000-0000-4000-8000-000000000002','proof-student@example.invalid'); end loop;
 if (select attempts from private.registration_rate_buckets where bucket='proof:c0000000-0000-4000-8000-000000000002')<=10 then raise exception 'Proof attempts were not recorded'; end if;
 if public.record_registration_identity_proof('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000002','proof-student@example.invalid') then raise exception 'Proof rate limit bypassed'; end if;
end $$;
rollback;

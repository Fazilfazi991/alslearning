-- Run against an isolated migrated DB only. Everything rolls back.
begin;
do $$
begin
 if has_table_privilege('anon','public.admission_enquiries','select') or has_table_privilege('anon','public.admission_enquiries','insert') or has_table_privilege('anon','public.admission_enquiries','update') or has_table_privilege('anon','public.admission_enquiries','delete') then raise exception 'Anonymous enquiry access'; end if;
 if has_function_privilege('anon','public.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text)','execute') or has_function_privilege('authenticated','public.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text)','execute') then raise exception 'Public submission RPC exposed'; end if;
 if has_table_privilege('authenticated','public.enquiry_activities','delete') or has_table_privilege('authenticated','public.enquiry_activities','update') then raise exception 'Audit history mutable'; end if;
 if not (select relrowsecurity from pg_class where oid='public.admission_enquiries'::regclass) then raise exception 'RLS disabled'; end if;
end $$;
insert into public.programs(id,slug,name,status) values('a0000000-0000-4000-8000-000000000001','enquiry-qa-isolated','Isolated enquiry test','active');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.submit_admission_enquiry('Test Person','+919876543210',null,'a0000000-0000-4000-8000-000000000001','Isolated test','a0000000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64));
select public.submit_admission_enquiry('Test Person','+919876543210',null,'a0000000-0000-4000-8000-000000000001','Isolated test','a0000000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64));
select public.submit_admission_enquiry('Test Person','+919876543210',null,'a0000000-0000-4000-8000-000000000001','Isolated test','a0000000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64));
do $$ begin
 if (select count(*) from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate created'; end if;
 begin
 update public.admission_enquiries set status='converted',student_id=null where program_id='a0000000-0000-4000-8000-000000000001';
 raise exception 'Premature conversion accepted';
 exception when check_violation then null;
 end;
 begin
 perform public.submit_admission_enquiry('Test Person','+919876543210',null,'a0000000-0000-4000-8000-000000000099',null,gen_random_uuid(),repeat('a',64),repeat('b',64));
 raise exception 'Invalid program accepted';
 exception when raise_exception then if sqlerrm<>'invalid_program' then raise; end if;
 end;
end $$;
-- New idempotency tokens cannot evade the per-phone persistent limit.
select public.submit_admission_enquiry('Test Person','+919876543210',null,'a0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),repeat('a',64),repeat('b',64));
do $$ begin
 begin
   perform public.submit_admission_enquiry('Test Person','+919876543210',null,'a0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),repeat('a',64),repeat('b',64));
   raise exception 'Phone rate limit bypassed';
 exception when raise_exception then if sqlerrm<>'rate_limit' then raise; end if;
 end;
end $$;
-- Admission CRM mutations and conversion run through real canonical triggers.
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('a0000000-0000-4000-8000-000000000010','enquiry-admin-qa@example.invalid','{"role":"admin"}','{"full_name":"Isolated Admin"}');
insert into public.batches(id,program_id,slug,name,batch_code,status) values
('a0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000001','enquiry-qa-batch','Isolated Batch','ENQUIRYQA','active');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000010"}',true);
set local role authenticated;
select public.update_admission_enquiry((select id from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001'),'{"assigned_to":"a0000000-0000-4000-8000-000000000010","notes":"Admin review"}');
select public.record_enquiry_activity((select id from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001'),'{"kind":"contact","note":"Called student"}');
select public.record_enquiry_activity((select id from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001'),'{"kind":"follow_up","note":"Call tomorrow","due_at":"2030-01-01T12:00:00Z"}');
do $$ begin
 if (select status from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001')<>'follow_up' then raise exception 'Follow-up status missing'; end if;
 if (select count(*) from public.enquiry_activities where note='Admin review')<>1 then raise exception 'Note not audited'; end if;
 if not public.enquiry_conversion_ready() then raise exception 'Active admin blocked'; end if;
 perform public.record_enquiry_activity((select id from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001'),jsonb_build_object('kind','follow_up','note','Discussed admission','follow_up_id',(select id from public.enquiry_follow_ups where enquiry_id in (select id from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001') limit 1),'outcome','Interested'));
 if exists(select 1 from public.enquiry_follow_ups where completed_at is null and enquiry_id in (select id from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001')) then raise exception 'Outcome not recorded'; end if;
end $$;
reset role;
-- The request may be represented by the Auth createUser metadata insert/update;
-- this uses exactly the canonical handler, preserving code and enrollment history.
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
select 'a0000000-0000-4000-8000-000000000012','enquiry-student-qa@example.invalid',
 jsonb_build_object('role','student','lms_admission',jsonb_build_object(
 'actor_id','a0000000-0000-4000-8000-000000000010','enquiry_id',id,'full_name','Admitted Student',
 'phone','+919876543210','admission_on','2026-11-06','program_id',program_id,
 'batch_id','a0000000-0000-4000-8000-000000000011','access_starts_at','2026-11-06T00:00:00Z','unassigned',false,'is_active',true)),
 '{"full_name":"Admitted Student"}'::jsonb
from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001';
do $$ begin
 if not exists(select 1 from public.admission_enquiries where student_id='a0000000-0000-4000-8000-000000000012' and status='converted') then raise exception 'Conversion link missing'; end if;
 if not exists(select 1 from public.profiles where id='a0000000-0000-4000-8000-000000000012' and student_code like 'ALS-ENQUIRYQA-%') then raise exception 'Permanent student code missing'; end if;
 begin
   insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
   select 'a0000000-0000-4000-8000-000000000013','enquiry-student-second-qa@example.invalid',
    jsonb_build_object('role','student','lms_admission',jsonb_build_object('actor_id','a0000000-0000-4000-8000-000000000010','enquiry_id',id,'unassigned',false)), '{}'::jsonb
   from public.admission_enquiries where program_id='a0000000-0000-4000-8000-000000000001';
   raise exception 'Second conversion accepted';
 exception when raise_exception then if sqlerrm<>'Enquiry unavailable for admission' then raise; end if;
 end;
 if exists(select 1 from auth.users where id='a0000000-0000-4000-8000-000000000013') then raise exception 'Failed conversion left orphan Auth'; end if;
 if exists(select 1 from public.profiles where id='a0000000-0000-4000-8000-000000000013') then raise exception 'Failed conversion left orphan profile'; end if;
end $$;
-- Authenticated users without an active canonical Admin profile see nothing.
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000099"}',true);
do $$ begin
 if exists(select 1 from public.admission_enquiries) then raise exception 'Unauthorized enquiry read'; end if;
 if exists(select 1 from public.enquiry_activities) then raise exception 'Unauthorized history read'; end if;
 if exists(select 1 from public.enquiry_follow_ups) then raise exception 'Unauthorized follow-up read'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('a0000000-0000-4000-8000-000000000020','enquiry-teacher-qa@example.invalid','{"role":"teacher"}','{"full_name":"Isolated Teacher"}');
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000020","app_metadata":{"role":"teacher"}}',true);
do $$ begin
 if exists(select 1 from public.admission_enquiries) or public.enquiry_conversion_ready() then raise exception 'Teacher can access enquiries'; end if;
 begin perform public.update_admission_enquiry(gen_random_uuid(),'{"status":"closed"}'); raise exception 'Teacher mutation accepted'; exception when raise_exception then if sqlerrm<>'Administrator required' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000012","app_metadata":{"role":"student"}}',true);
do $$ begin
 if exists(select 1 from public.admission_enquiries) or public.enquiry_conversion_ready() then raise exception 'Student can access enquiries'; end if;
end $$;
reset role;
-- A once-valid admin loses access immediately when their canonical account is
-- inactive, even if its old JWT still claims the administrator role.
select set_config('request.jwt.claims','{}',true);
update public.profiles set is_active=false where id='a0000000-0000-4000-8000-000000000010';
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000010","app_metadata":{"role":"admin"}}',true);
do $$ begin
 if public.enquiry_conversion_ready() or exists(select 1 from public.admission_enquiries) then raise exception 'Inactive admin retained access'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.admission_enquiries; raise exception 'Anon read accepted'; exception when insufficient_privilege then null; end;
 begin perform public.enquiry_conversion_ready(); raise exception 'Anon RPC accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;

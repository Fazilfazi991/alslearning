-- Disposable, migrated PostgreSQL/Supabase only. This leaves no fixture rows.
begin;
do $$ begin
 if (select count(*) from pg_attribute a where a.attrelid='public.programs'::regclass and a.attname in ('id','name','description','status','display_order') and exists(select 1 from aclexplode(a.attacl) acl where acl.grantee='service_role'::regrole and acl.privilege_type='SELECT'))<>5 then raise exception 'Explicit hosted program picker grants missing'; end if;
 if (select prosecdef from pg_proc where oid='public.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text)'::regprocedure) then raise exception 'Public submission wrapper must be invoker'; end if;
 if has_function_privilege('authenticated','private.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text)','execute') or has_function_privilege('anon','private.submit_admission_enquiry(text,text,text,uuid,text,uuid,text,text)','execute') then raise exception 'Submission implementation exposed'; end if;
 if has_table_privilege('authenticated','public.admission_enquiries','update') or has_table_privilege('authenticated','public.enquiry_activities','insert') or has_table_privilege('authenticated','public.enquiry_follow_ups','update') then raise exception 'Audited RPC write bypass'; end if;
end $$;
insert into public.programs(id,slug,name,status) values('b0000000-0000-4000-8000-000000000001','enquiry-hardening-qa','Isolated rate QA','active');
set local role service_role;
select id,name,description from public.programs where status='active' order by display_order,name;
do $$ declare i integer; phone text; begin
 -- More than ten unrelated browser/phone pairs never share an unknown bucket.
 for i in 1..12 loop
   phone:='+91987000'||lpad(i::text,4,'0');
   perform public.submit_admission_enquiry('Independent Browser',phone,null,'b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),repeat(md5('browser'||i),2),repeat(md5(phone),2));
 end loop;
 -- A new browser token cannot reset the durable per-phone quota.
 for i in 1..3 loop
   perform public.submit_admission_enquiry('Same Phone','+919871234567',null,'b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),repeat(md5('changing-browser'||i),2),repeat(md5('one-phone'),2));
 end loop;
 begin
   perform public.submit_admission_enquiry('Same Phone','+919871234567',null,'b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),repeat(md5('new-browser'),2),repeat(md5('one-phone'),2));
   raise exception 'Cookie reset bypassed phone limit';
 exception when raise_exception then if sqlerrm<>'rate_limit' then raise; end if; end;
 -- The browser/network budget still caps different phones from one origin.
 for i in 1..10 loop
   phone:='+91987200'||lpad(i::text,4,'0');
   perform public.submit_admission_enquiry('Same Browser',phone,null,'b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),repeat(md5('same-browser'),2),repeat(md5(phone),2));
 end loop;
 begin
   perform public.submit_admission_enquiry('Same Browser','+919872009999',null,'b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),repeat(md5('same-browser'),2),repeat(md5('different-phone'),2));
   raise exception 'Browser budget bypassed';
 exception when raise_exception then if sqlerrm<>'rate_limit' then raise; end if; end;
 -- SQL callers cannot bypass request validation using nullable parameters.
 begin
   perform public.submit_admission_enquiry(null,'+919873234567',null,'b0000000-0000-4000-8000-000000000001',null,gen_random_uuid(),null,repeat('a',64));
   raise exception 'Null submission accepted';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('b0000000-0000-4000-8000-000000000010','enquiry-hardening-admin@example.invalid','{"role":"admin"}','{"full_name":"Isolated Admin"}'),
('b0000000-0000-4000-8000-000000000011','enquiry-hardening-former-admin@example.invalid','{"role":"admin"}','{"full_name":"Former Admin"}');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"b0000000-0000-4000-8000-000000000010"}',true);
set local role authenticated;
do $$ declare lead uuid; payload jsonb; begin
 if not public.lms_admission_ready() then raise exception 'Canonical admission pipeline not ready'; end if;
 select id into lead from public.admission_enquiries where program_id='b0000000-0000-4000-8000-000000000001' order by id limit 1;
 foreach payload in array array['null'::jsonb,'[]'::jsonb,'{}'::jsonb,'{"notes":{}}'::jsonb,'{"status":null}'::jsonb,'{"student_id":"b0000000-0000-4000-8000-000000000010"}'::jsonb] loop
   begin perform public.update_admission_enquiry(lead,payload); raise exception 'Malformed update accepted'; exception when invalid_parameter_value then null; end;
 end loop;
 foreach payload in array array['null'::jsonb,'[]'::jsonb,'{}'::jsonb,'{"kind":"note","note":{}}'::jsonb,'{"kind":"follow_up","note":"call","due_at":"infinity"}'::jsonb,'{"kind":"follow_up","note":"call","due_at":"2030-01-01T12:00:00Z","outcome":"bad combination"}'::jsonb,'{"kind":"contact","note":"call","follow_up_id":null}'::jsonb] loop
   begin perform public.record_enquiry_activity(lead,payload); raise exception 'Malformed activity accepted'; exception when invalid_parameter_value then null; end;
 end loop;
 perform public.update_admission_enquiry(lead,'{"assigned_to":"b0000000-0000-4000-8000-000000000011"}');
end $$;
reset role;
alter table auth.users disable trigger on_auth_user_lms_admission;
set local role authenticated;
do $$ begin if public.lms_admission_ready() then raise exception 'Missing metadata trigger passed readiness'; end if; end $$;
reset role;
alter table auth.users enable trigger on_auth_user_lms_admission;
update public.profiles set is_active=false where id='b0000000-0000-4000-8000-000000000011';
set local role authenticated;
do $$ declare lead uuid; begin
 select id into lead from public.admission_enquiries where assigned_to='b0000000-0000-4000-8000-000000000011' limit 1;
 perform public.record_enquiry_activity(lead,'{"kind":"contact","note":"Historical assignment does not block contact"}');
 perform public.update_admission_enquiry(lead,'{"assigned_to":null}');
 begin
   perform public.update_admission_enquiry(lead,'{"assigned_to":"b0000000-0000-4000-8000-000000000011"}');
   raise exception 'New inactive assignment accepted';
 exception when raise_exception then if sqlerrm<>'Only active administrators may receive enquiries' then raise; end if; end;
end $$;
reset role;
rollback;

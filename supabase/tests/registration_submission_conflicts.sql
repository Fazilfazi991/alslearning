-- Disposable migrated database only. Test actual RPC idempotency and family phone reuse.
begin;
insert into public.programs(id,slug,name,status) values
('f0000000-0000-4000-8000-000000000001','conflict-qa-one','QA one','active'),
('f0000000-0000-4000-8000-000000000002','conflict-qa-two','QA two','active');
do $$
declare p1 uuid := 'f0000000-0000-4000-8000-000000000001'; p2 uuid := 'f0000000-0000-4000-8000-000000000002'; key1 uuid := 'f0000000-0000-4000-8000-000000000003'; result jsonb;
begin
 result := public.submit_student_registration('Applicant One','one@example.invalid','+919876543210','BSc','College',p1,null,null,true,key1,repeat('a',64),repeat('b',64),repeat('c',64),null);
 if result->>'accepted'<>'true' then raise exception 'Initial request rejected'; end if;
 result := public.submit_student_registration('Applicant One','one@example.invalid','+919876543210','BSc','College',p1,null,null,true,key1,repeat('a',64),repeat('b',64),repeat('c',64),null);
 if result->>'accepted'<>'true' then raise exception 'Exact replay rejected'; end if;
 result := public.submit_student_registration('Applicant One','one@example.invalid','+919876543210','BSc','College',p2,null,null,true,key1,repeat('a',64),repeat('b',64),repeat('c',64),null);
 if result->>'error'<>'application_conflict' or result->>'accepted'<>'false' then raise exception 'Changed payload with same key accepted'; end if;
 result := public.submit_student_registration('Applicant One','one@example.invalid','+919876543210','BSc','College',p2,null,null,true,'f0000000-0000-4000-8000-000000000004',repeat('a',64),repeat('b',64),repeat('c',64),null);
 if result->>'error'<>'application_conflict' or result->>'accepted'<>'false' then raise exception 'Changed program with new key accepted'; end if;
 if (select attempts from private.registration_rate_buckets where bucket='phone:'||repeat('b',64))<>2 then raise exception 'Conflict did not consume rate limit'; end if;
 result := public.submit_student_registration('Applicant One','one@example.invalid','+919876543210','BSc','College',p1,null,null,true,'f0000000-0000-4000-8000-000000000005',repeat('a',64),repeat('b',64),repeat('c',64),null);
 if result->>'accepted'<>'true' then raise exception 'Exact duplicate with new key rejected'; end if;
 -- Reset the time window for the family test; the limit includes conflicts.
 update private.registration_rate_buckets set window_start=now()-interval '2 hours' where bucket='phone:'||repeat('b',64);
 result := public.submit_student_registration('Applicant Two','two@example.invalid','+919876543210','BSc','College',p2,null,null,true,'f0000000-0000-4000-8000-000000000006',repeat('a',64),repeat('b',64),repeat('d',64),null);
 if result->>'accepted'<>'true' then raise exception 'Family phone rejected'; end if;
 if (select count(*) from public.student_registrations where phone='+919876543210')<>2 then raise exception 'Family applications not stored separately'; end if;
end $$;
rollback;

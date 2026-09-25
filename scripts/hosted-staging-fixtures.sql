-- Synthetic data for the verified als-live-staging project only.
-- Apply with scripts/apply-hosted-staging-fixtures.ps1 after identity checks.
do $$
declare
  staging_teacher uuid;
  staging_program uuid;
  staging_subject uuid;
  staging_batch uuid;
  staging_session uuid;
  staging_student uuid;
begin
  if (select count(*) from auth.users) <> 5
     or (select count(*) from auth.users where email in (
       'als-staging-admin@example.test', 'als-staging-teacher@example.test',
       'als-staging-student1@example.test', 'als-staging-student2@example.test',
       'als-staging-ineligible@example.test'
     )) <> 5 then
    raise exception 'Staging Auth roster is not exactly the five synthetic users';
  end if;
  if exists (
    select 1 from auth.users
    where (email = 'als-staging-admin@example.test' and raw_app_meta_data->>'role' <> 'admin')
       or (email = 'als-staging-teacher@example.test' and raw_app_meta_data->>'role' <> 'teacher')
       or (email like 'als-staging-%@example.test' and email not in ('als-staging-admin@example.test','als-staging-teacher@example.test') and raw_app_meta_data->>'role' <> 'student')
  ) then raise exception 'Synthetic role mismatch'; end if;

  select id into strict staging_teacher from auth.users where email = 'als-staging-teacher@example.test';
  insert into public.programs(slug,name,status,has_live_classes,has_recorded_content,has_tests)
  values ('als-staging-classroom','Synthetic ALS Staging Classroom','active',true,true,false)
  on conflict(slug) do update set name = excluded.name
  returning id into staging_program;
  insert into public.subjects(slug,name,status)
  values ('als-staging-laboratory-science','Synthetic Laboratory Science','active')
  on conflict(slug) do update set name = excluded.name
  returning id into staging_subject;
  insert into public.program_subjects(program_id,subject_id)
  values (staging_program,staging_subject) on conflict do nothing;

  insert into public.batches(slug,name,program_id,status,max_students)
  values ('als-staging-batch','Synthetic Staging Batch',staging_program,'active',2)
  on conflict(slug) do update set name = excluded.name
  returning id into staging_batch;
  insert into public.batch_faculty(batch_id,faculty_id)
  values (staging_batch,staging_teacher) on conflict do nothing;
  if not exists (
    select 1 from public.faculty_assignments
    where faculty_id = staging_teacher and program_id = staging_program and subject_id = staging_subject
  ) then
    insert into public.faculty_assignments(faculty_id,program_id,subject_id,can_manage_content)
    values (staging_teacher,staging_program,staging_subject,true);
  end if;

  for staging_student in
    select id from auth.users where email in ('als-staging-student1@example.test','als-staging-student2@example.test')
  loop
    insert into public.enrollments(student_id,program_id,batch_id,status,access_starts_at,access_expires_at)
    values (staging_student,staging_program,staging_batch,'active',now()-interval '1 minute',now()+interval '24 hours')
    on conflict(student_id,program_id,batch_id) do update
      set status = excluded.status, access_starts_at = excluded.access_starts_at,
          access_expires_at = excluded.access_expires_at;
  end loop;
  if exists (select 1 from public.enrollments where student_id=(select id from auth.users where email='als-staging-ineligible@example.test')) then
    raise exception 'Ineligible Student unexpectedly has an enrollment';
  end if;

  if (select count(*) from public.live_sessions where title='Synthetic ALS Hosted Staging Class') > 1 then
    raise exception 'Duplicate synthetic staging class';
  end if;
  select id into staging_session from public.live_sessions where title='Synthetic ALS Hosted Staging Class';
  if staging_session is null then
    insert into public.live_sessions(title,faculty_id,program_id,batch_id,subject_id,provider,status,max_receivers,recording_enabled,student_audio_enabled,student_video_enabled)
    values ('Synthetic ALS Hosted Staging Class',staging_teacher,staging_program,staging_batch,staging_subject,'cloudflare','scheduled',3,true,false,false)
    returning id into staging_session;
  elsif exists (
    select 1 from public.live_sessions where id=staging_session
      and (faculty_id<>staging_teacher or program_id<>staging_program or batch_id<>staging_batch
           or subject_id<>staging_subject or provider<>'cloudflare' or status<>'scheduled')
  ) then
    raise exception 'Existing staging class ownership/status mismatch';
  end if;
end $$;

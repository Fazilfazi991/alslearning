-- CONDITIONAL STAGING-ONLY ROLLBACK PLAN. REVIEW BEFORE ANY EXECUTION.
-- This script is for an otherwise empty registration installation after a
-- controlled staging test. It refuses to delete any application, event,
-- link, proof, request, rate bucket, or approved batch default. It does not
-- delete or modify ANY Auth identity, profile, enrollment, enquiry, course,
-- student code, existing audit row, managed role or Storage object.
-- Clean up only individually identified synthetic fixtures, after reviewing
-- their complete dependency graph; never run generic cleanup of Auth users.
-- If any real application or unknown dependency exists, stop and use a reviewed
-- forward fix or validated backup recovery instead of running this script.
-- For staging: quiesce registration traffic and coordinate the shared window.
-- PostgreSQL RESTRICT is intentional; no CASCADE is permitted.
begin;
set local lock_timeout = '5s';
-- Freeze writers while checking for data and removing the schema.
lock table auth.users, public.profiles, public.batches, public.enrollments,
  public.student_registrations, public.student_registration_events,
  private.registration_requests, private.registration_rate_buckets,
  private.registration_links, private.registration_identity_proofs in access exclusive mode;
do $$
begin
 if exists(select 1 from public.student_registrations)
    or exists(select 1 from public.student_registration_events)
    or exists(select 1 from private.registration_requests)
    or exists(select 1 from private.registration_rate_buckets)
    or exists(select 1 from private.registration_links)
    or exists(select 1 from private.registration_identity_proofs)
    or exists(select 1 from public.batches where registration_default) then
   raise exception 'Rollback refused: registration data, rate buckets, links, proof, or batch defaults exist';
 end if;
 if (select count(*) from supabase_migrations.schema_migrations where (version,name) in (('20261110062353','student_registration'),('20261110063116','student_registration_identity_proof')))<>2
    or exists(select 1 from supabase_migrations.schema_migrations where version>'20261110063116' and (version,name) <> ('20261110080919','student_registration_capacity_guard'))
    or exists(select 1 from supabase_migrations.schema_migrations where version='20261110080919' and name <> 'student_registration_capacity_guard') then
   raise exception 'Rollback refused: migration history differs or later migrations exist';
 end if;
end $$;
-- Exact names and RESTRICT fail closed when the optional third migration drifts.
do $$ begin
 if exists(select 1 from supabase_migrations.schema_migrations where version='20261110080919' and name='student_registration_capacity_guard') then
  drop function public.registration_batch_occupancy();
  drop function private.registration_batch_occupancy();
  drop trigger z_als_reserved_capacity_batch on public.batches;
  drop trigger z_als_reserved_capacity_reactivation on public.profiles;
  drop trigger z_als_reserved_capacity_enrollment on public.enrollments;
  drop function private.lms_reserved_capacity_batch_guard();
  drop function private.lms_reserved_capacity_reactivation_guard();
  drop function private.lms_reserved_capacity_enrollment_guard();
  drop function private.lms_reserved_capacity_count(uuid,timestamptz,uuid);
  drop function private.lms_capacity_legacy_row_mode();
  drop index public.lms_reserved_capacity_active_batch_idx;
 end if;
end $$;
drop trigger z_finish_registration_admission on auth.users;
drop trigger z_finish_registration_admission_update on auth.users;
drop trigger a_guard_registration_identity on auth.users;

drop function public.approve_existing_registration(uuid,uuid);
drop function public.registration_existing_student_ready(uuid);
drop function public.record_registration_identity_proof(uuid,uuid,text);
drop function public.registration_admission_ready();
drop function public.registration_invitation_ready();
drop function public.claim_registration_invitation(uuid,uuid);
drop function public.complete_registration_invitation(uuid,uuid,boolean);
drop function public.create_registration_link(uuid,text,timestamptz);
drop function public.get_registration_link(text,text);
drop function public.review_student_registration(uuid,text,jsonb);
drop function public.submit_student_registration(text,text,text,text,text,uuid,uuid,text,boolean,uuid,text,text,text,text);

drop function private.approve_existing_registration(uuid,uuid);
drop function private.registration_existing_student_ready(uuid);
drop function private.record_registration_identity_proof(uuid,uuid,text);
drop function private.claim_registration_invitation(uuid,uuid);
drop function private.complete_registration_invitation(uuid,uuid,boolean);
drop function private.create_registration_link(uuid,text,timestamptz);
drop function private.get_registration_link(text,text);
drop function private.review_student_registration(uuid,text,jsonb);
drop function private.submit_student_registration(text,text,text,text,text,uuid,uuid,text,boolean,uuid,text,text,text,text);
drop function private.finish_registration_admission();
drop function private.guard_registration_identity();

drop table private.registration_identity_proofs;
drop table private.registration_links;
drop table private.registration_requests;
drop table private.registration_rate_buckets;
drop table public.student_registration_events;
drop table public.student_registrations;
drop function private.registration_admin();
drop index public.registration_one_default_per_program;
alter table public.batches drop column registration_default;
delete from supabase_migrations.schema_migrations
where (version,name) in (('20261110062353','student_registration'),('20261110063116','student_registration_identity_proof'),('20261110080919','student_registration_capacity_guard'));
commit;

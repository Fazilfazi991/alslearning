-- ALS entrance-exam coaching platform foundation.
-- All public tables use RLS. Authorization roles live in profiles, not user-editable JWT metadata.
create extension if not exists pgcrypto;

create type public.app_role as enum ('student','teacher','admin');
create type public.record_status as enum ('draft','active','archived');
create type public.batch_status as enum ('upcoming','active','completed','archived');
create type public.enrollment_status as enum ('active','suspended','completed','cancelled');
create type public.content_kind as enum ('video','pdf','note','document','image','external_link','recording');
create type public.question_kind as enum ('single_mcq','multiple_mcq','true_false','image_mcq','case_based','match_following');
create type public.question_source as enum ('standard','previous_exam','recalled');
create type public.test_kind as enum ('mock','subject','chapter','topic','revision','daily','weekly');
create type public.session_status as enum ('draft','scheduled','live','completed','cancelled');
create type public.recording_status as enum ('recording','processing','ready','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  full_name text not null default '', email text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.entrance_exams (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text, default_duration_days integer check(default_duration_days is null or default_duration_days > 0),
  status public.record_status not null default 'draft', display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.programs (
  id uuid primary key default gen_random_uuid(), exam_id uuid references public.entrance_exams(id) on delete set null,
  slug text not null unique, name text not null, description text, duration_days integer check(duration_days is null or duration_days > 0),
  starts_on date, ends_on date, access_validity_days integer check(access_validity_days is null or access_validity_days > 0),
  status public.record_status not null default 'draft', price_reference text,
  has_recorded_content boolean not null default false, has_live_classes boolean not null default false,
  has_tests boolean not null default false, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subjects (
  id uuid primary key default gen_random_uuid(), slug text not null, name text not null, description text,
  status public.record_status not null default 'active', display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(slug)
);
create table public.program_subjects (
  program_id uuid not null references public.programs(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  display_order integer not null default 0, primary key(program_id,subject_id)
);
create table public.chapters (
  id uuid primary key default gen_random_uuid(), subject_id uuid not null references public.subjects(id) on delete cascade,
  program_id uuid references public.programs(id) on delete cascade, slug text not null, name text not null,
  status public.record_status not null default 'active', display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(subject_id,program_id,slug)
);
create table public.topics (
  id uuid primary key default gen_random_uuid(), subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade, program_id uuid references public.programs(id) on delete cascade,
  slug text not null, name text not null, status public.record_status not null default 'active', display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(chapter_id is not null or subject_id is not null)
);
create table public.faculty_assignments (
  id uuid primary key default gen_random_uuid(), faculty_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid references public.entrance_exams(id) on delete cascade, program_id uuid references public.programs(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade, can_manage_content boolean not null default false,
  can_manage_questions boolean not null default false, can_manage_tests boolean not null default false,
  created_at timestamptz not null default now(), check(num_nonnulls(exam_id,program_id,subject_id) >= 1)
);
create table public.batches (
  id uuid primary key default gen_random_uuid(), program_id uuid not null references public.programs(id) on delete restrict,
  exam_id uuid references public.entrance_exams(id) on delete set null, slug text not null unique, name text not null,
  starts_on date, ends_on date, access_valid_until date, schedule jsonb not null default '[]'::jsonb,
  max_students integer check(max_students is null or max_students > 0), status public.batch_status not null default 'upcoming',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.batch_faculty (
  batch_id uuid not null references public.batches(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade, primary key(batch_id,faculty_id)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete restrict, batch_id uuid references public.batches(id) on delete set null,
  enrolled_on date not null default current_date, access_expires_at timestamptz, status public.enrollment_status not null default 'active',
  payment_reference text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id,program_id,batch_id)
);
create table public.learning_content (
  id uuid primary key default gen_random_uuid(), kind public.content_kind not null, slug text not null unique, title text not null,
  description text, exam_id uuid references public.entrance_exams(id) on delete set null,
  program_id uuid references public.programs(id) on delete cascade, subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null, topic_id uuid references public.topics(id) on delete set null,
  lesson_id uuid references public.learning_content(id) on delete cascade, faculty_id uuid references public.profiles(id) on delete set null,
  source_type text, external_url text, storage_bucket text, storage_path text, mime_type text, byte_size bigint,
  duration_seconds integer check(duration_seconds is null or duration_seconds >= 0), visibility text not null default 'enrolled',
  allow_download boolean not null default false, status public.record_status not null default 'draft', display_order integer not null default 0,
  published_at timestamptz, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(external_url is not null or storage_path is not null or kind = 'note')
);
create table public.content_batch_access (
  content_id uuid not null references public.learning_content(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade, primary key(content_id,batch_id)
);
create table public.video_progress (
  content_id uuid not null references public.learning_content(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  position_seconds integer not null default 0, completed boolean not null default false, updated_at timestamptz not null default now(),
  primary key(content_id,student_id)
);
create table public.questions (
  id uuid primary key default gen_random_uuid(), exam_id uuid references public.entrance_exams(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null, subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null, topic_id uuid references public.topics(id) on delete set null,
  type public.question_kind not null, prompt text not null, stem_media_content_id uuid references public.learning_content(id) on delete set null,
  explanation text, difficulty text not null default 'medium' check(difficulty in ('easy','medium','hard')),
  marks numeric(8,2) not null default 1, negative_marks numeric(8,2) not null default 0,
  source_type public.question_source not null default 'standard', source_reference text, exam_year integer, exam_session text,
  status public.record_status not null default 'draft', created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.question_options (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references public.questions(id) on delete cascade,
  label text, content text not null, media_content_id uuid references public.learning_content(id) on delete set null,
  is_correct boolean not null default false, match_key text, display_order integer not null default 0
);
create table public.tests (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null, type public.test_kind not null,
  exam_id uuid references public.entrance_exams(id) on delete set null, program_id uuid references public.programs(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null, chapter_id uuid references public.chapters(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null, question_count integer not null check(question_count > 0),
  duration_minutes integer not null check(duration_minutes > 0), total_marks numeric(8,2), default_negative_marks numeric(8,2) not null default 0,
  target_score numeric(8,2), max_attempts integer check(max_attempts is null or max_attempts > 0), available_from timestamptz,
  available_until timestamptz, randomize_questions boolean not null default false, randomize_options boolean not null default false,
  show_answers boolean not null default true, show_explanations boolean not null default true,
  selection_mode text not null default 'manual' check(selection_mode in ('manual','generated')),
  selection_rules jsonb not null default '{}'::jsonb, status public.record_status not null default 'draft',
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.test_batches (
  test_id uuid not null references public.tests(id) on delete cascade, batch_id uuid not null references public.batches(id) on delete cascade,
  primary key(test_id,batch_id)
);
create table public.test_questions (
  test_id uuid not null references public.tests(id) on delete cascade, question_id uuid not null references public.questions(id) on delete restrict,
  display_order integer not null default 0, marks_override numeric(8,2), negative_marks_override numeric(8,2), primary key(test_id,question_id)
);
create table public.test_attempts (
  id uuid primary key default gen_random_uuid(), test_id uuid not null references public.tests(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict, started_at timestamptz not null default now(), submitted_at timestamptz,
  score numeric(8,2), status text not null default 'in_progress' check(status in ('in_progress','submitted','graded')),
  question_order uuid[] not null default '{}', created_at timestamptz not null default now()
);
create table public.attempt_answers (
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict, selected_option_ids uuid[] not null default '{}',
  response jsonb, is_correct boolean, marks_awarded numeric(8,2), answered_at timestamptz not null default now(), primary key(attempt_id,question_id)
);
create table public.video_checkpoints (
  id uuid primary key default gen_random_uuid(), video_id uuid not null references public.learning_content(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict, trigger_seconds integer not null check(trigger_seconds >= 0),
  pause_video boolean not null default true, mandatory boolean not null default false, show_feedback boolean not null default true,
  retry_policy text not null default 'once', store_response boolean not null default true, display_order integer not null default 0
);
create table public.checkpoint_responses (
  checkpoint_id uuid not null references public.video_checkpoints(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, selected_option_ids uuid[] not null default '{}',
  is_correct boolean, attempt_count integer not null default 1, answered_at timestamptz not null default now(), primary key(checkpoint_id,student_id)
);
create table public.live_sessions (
  id uuid primary key default gen_random_uuid(), program_id uuid references public.programs(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null, subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null, faculty_id uuid not null references public.profiles(id) on delete restrict,
  title text not null, starts_at timestamptz, ends_at timestamptz, provider text not null default 'unconfigured', provider_room_id text,
  status public.session_status not null default 'draft', chat_enabled boolean not null default true,
  student_audio_enabled boolean not null default true, student_video_enabled boolean not null default true,
  recording_enabled boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.live_participants (
  session_id uuid not null references public.live_sessions(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  presenter boolean not null default false, raised_hand boolean not null default false, joined_at timestamptz, left_at timestamptz,
  primary key(session_id,user_id)
);
create table public.live_questions (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.live_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict, launched_at timestamptz, closed_at timestamptz,
  show_results boolean not null default false
);
create table public.live_question_responses (
  live_question_id uuid not null references public.live_questions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, selected_option_ids uuid[] not null default '{}',
  response jsonb, responded_at timestamptz not null default now(), primary key(live_question_id,student_id)
);
create table public.class_recordings (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.live_sessions(id) on delete cascade,
  content_id uuid references public.learning_content(id) on delete set null, provider_recording_id text, status public.recording_status not null default 'recording',
  error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index on public.enrollments(student_id,status,access_expires_at);
create index on public.learning_content(program_id,subject_id,chapter_id,topic_id,status);
create index on public.questions(exam_id,subject_id,chapter_id,topic_id,status);
create index on public.tests(program_id,type,status);
create index on public.live_sessions(batch_id,starts_at,status);

create function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',false)
$$;
create function public.is_teacher() returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') in ('teacher','admin'),false)
$$;
create function public.has_program_access(target_program uuid) returns boolean language sql stable security invoker set search_path='' as $$
  select public.is_admin() or exists(
    select 1 from public.enrollments e where e.student_id=(select auth.uid()) and e.program_id=target_program
    and e.status='active' and (e.access_expires_at is null or e.access_expires_at > now())
  ) or exists(select 1 from public.faculty_assignments f where f.faculty_id=(select auth.uid()) and f.program_id=target_program)
$$;

do $$ declare t text; begin
  foreach t in array array['profiles','entrance_exams','programs','subjects','program_subjects','chapters','topics','faculty_assignments','batches','batch_faculty','enrollments','learning_content','content_batch_access','video_progress','questions','question_options','tests','test_batches','test_questions','test_attempts','attempt_answers','video_checkpoints','checkpoint_responses','live_sessions','live_participants','live_questions','live_question_responses','class_recordings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
  end loop;
end $$;

create policy profiles_self_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_admin());
create policy profiles_admin_write on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());

do $$ declare t text; begin
  foreach t in array array['entrance_exams','programs','subjects','program_subjects','chapters','topics','batches','batch_faculty','faculty_assignments','learning_content','content_batch_access','questions','question_options','tests','test_batches','test_questions','video_checkpoints','live_sessions','live_participants','live_questions','class_recordings'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',t||'_admin_manage',t);
  end loop;
end $$;

create policy taxonomy_authenticated_read on public.entrance_exams for select to authenticated using(status='active' or public.is_teacher());
create policy programs_authenticated_read on public.programs for select to authenticated using(status='active' or public.is_teacher());
create policy subjects_authenticated_read on public.subjects for select to authenticated using(status='active' or public.is_teacher());
create policy program_subjects_authenticated_read on public.program_subjects for select to authenticated using(true);
create policy chapters_authenticated_read on public.chapters for select to authenticated using(status='active' or public.is_teacher());
create policy topics_authenticated_read on public.topics for select to authenticated using(status='active' or public.is_teacher());
create policy batches_teacher_or_member_read on public.batches for select to authenticated using(public.is_teacher() or exists(select 1 from public.enrollments e where e.batch_id=id and e.student_id=(select auth.uid()) and e.status='active'));
create policy faculty_assignments_own_read on public.faculty_assignments for select to authenticated using(faculty_id=(select auth.uid()) or public.is_admin());
create policy enrollments_own_read on public.enrollments for select to authenticated using(student_id=(select auth.uid()) or public.is_teacher());
create policy enrollments_admin_manage on public.enrollments for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy content_permitted_read on public.learning_content for select to authenticated using(public.is_teacher() or (status='active' and public.has_program_access(program_id)));
create policy questions_teacher_read on public.questions for select to authenticated using(public.is_teacher());
create policy options_teacher_read on public.question_options for select to authenticated using(public.is_teacher());
create policy tests_permitted_read on public.tests for select to authenticated using(public.is_teacher() or (status='active' and public.has_program_access(program_id)));
create policy test_questions_permitted_read on public.test_questions for select to authenticated using(exists(select 1 from public.tests t where t.id=test_id and (public.is_teacher() or (t.status='active' and public.has_program_access(t.program_id)))));
create policy progress_own_manage on public.video_progress for all to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));
create policy attempts_own_manage on public.test_attempts for all to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));
create policy answers_own_manage on public.attempt_answers for all to authenticated using(exists(select 1 from public.test_attempts a where a.id=attempt_id and a.student_id=(select auth.uid()))) with check(exists(select 1 from public.test_attempts a where a.id=attempt_id and a.student_id=(select auth.uid())));
create policy checkpoint_own_manage on public.checkpoint_responses for all to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));
create policy live_responses_own_manage on public.live_question_responses for all to authenticated using(student_id=(select auth.uid())) with check(student_id=(select auth.uid()));

insert into storage.buckets(id,name,public) values ('learning-content','learning-content',false),('class-recordings','class-recordings',false) on conflict(id) do nothing;
create policy learning_storage_admin_insert on storage.objects for insert to authenticated with check(bucket_id in ('learning-content','class-recordings') and public.is_admin());
create policy learning_storage_admin_update on storage.objects for update to authenticated using(bucket_id in ('learning-content','class-recordings') and public.is_admin()) with check(bucket_id in ('learning-content','class-recordings') and public.is_admin());
create policy learning_storage_admin_delete on storage.objects for delete to authenticated using(bucket_id in ('learning-content','class-recordings') and public.is_admin());
create policy learning_storage_owner_read on storage.objects for select to authenticated using(bucket_id in ('learning-content','class-recordings') and (owner_id=(select auth.uid())::text or public.is_admin()));

insert into public.entrance_exams(slug,name,description,default_duration_days,status,display_order) values
('cre','CRE – Common Recruitment Exam','Common Recruitment Exam preparation',60,'active',1),
('lab-technician-grade-2','Lab Technician Grade 2','Grade 2 laboratory technician entrance preparation',365,'active',2),
('msc-mlt-entrance','MSc MLT Entrance','MSc Medical Laboratory Technology entrance preparation',30,'active',3),
('jso','Junior Scientific Officer / JSO','Junior Scientific Officer entrance preparation',365,'active',4);
insert into public.subjects(slug,name,status,display_order) values
('biochemistry','Biochemistry','active',1),('microbiology','Microbiology','active',2),('pathology','Pathology','active',3);
insert into public.programs(exam_id,slug,name,duration_days,status,has_recorded_content,has_live_classes,has_tests,display_order)
select case when v.exam_slug is null then null else e.id end,v.slug,v.name,v.duration_days,'active',true,true,true,v.ord
from (values ('dhs-long-term','DHS Long Term',null::text,365,1),('dme-long-term','DME Long Term',null,365,2),('msc-mlt-entrance','MSc MLT Entrance','msc-mlt-entrance',30,3),('cre-crash-course','CRE Crash Course','cre',60,4)) v(slug,name,exam_slug,duration_days,ord)
left join public.entrance_exams e on e.slug=v.exam_slug;

-- Forward-only core pipeline. Existing questions, attempts and QA accounts are preserved.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
alter type public.test_kind add value if not exists 'full_exam';
alter table public.batches add column access_starts_at timestamptz, add column access_expires_at timestamptz;
alter table public.questions add column stem_image_path text, add column explanation_image_path text, add column source_label text;
create table private.attempt_snapshots (
 attempt_id uuid primary key references public.test_attempts(id) on delete cascade,
 questions jsonb not null, review_settings jsonb not null, total_marks numeric not null
);
revoke all on private.attempt_snapshots from public,anon,authenticated;
alter table private.attempt_snapshots enable row level security;

-- These small, non-exposed helpers deliberately bypass RLS to avoid recursive policies.
-- Every identity originates from auth.uid(), never an argument supplied by the caller.
create function private.active_role() returns text language sql stable security definer set search_path='' as $$
 select p.role::text from public.profiles p where p.id=(select auth.uid()) and p.is_active
$$;
create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(private.active_role()='admin',false)
$$;
create or replace function public.is_teacher() returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(private.active_role() in ('admin','teacher'),false)
$$;
create or replace function public.teacher_has_assignment(target_exam uuid,target_program uuid,target_subject uuid,permission text default null)
returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (private.active_role()='teacher' and exists(
 select 1 from public.faculty_assignments f where f.faculty_id=(select auth.uid())
 and (f.exam_id is null or f.exam_id=target_exam)
 and (f.program_id is null or f.program_id=target_program)
 and (f.subject_id is null or f.subject_id=target_subject)
 and case permission when 'content' then f.can_manage_content when 'questions' then f.can_manage_questions when 'tests' then f.can_manage_tests else true end))
$$;
create function private.enrolled(target_program uuid,target_batch uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_role()='student' and exists(
 select 1 from public.enrollments e join public.programs p on p.id=e.program_id
 left join public.batches b on b.id=e.batch_id
 where e.student_id=(select auth.uid()) and e.program_id=target_program and e.status='active' and p.status='active'
 and (target_batch is null or e.batch_id=target_batch)
 and (e.access_starts_at is null or e.access_starts_at<=now()) and (e.access_expires_at is null or e.access_expires_at>now())
 and (e.batch_id is null or (b.program_id=e.program_id and b.status='active'
 and (b.access_starts_at is null or b.access_starts_at<=now()) and (b.access_expires_at is null or b.access_expires_at>now())
 and (b.access_valid_until is null or b.access_valid_until>=current_date))))
$$;
create or replace function public.has_program_access(target_program uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or private.enrolled(target_program) or (private.active_role()='teacher' and exists(select 1 from public.faculty_assignments f where f.faculty_id=(select auth.uid()) and f.program_id=target_program))
$$;
create function private.teacher_batches(ids uuid[]) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (private.active_role()='teacher' and not exists(select 1 from unnest(ids) b where not exists(select 1 from public.batch_faculty f where f.batch_id=b and f.faculty_id=(select auth.uid()))))
$$;
create function private.content_access(target uuid,staff_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_content c where c.id=target and (
 (public.teacher_has_assignment(c.exam_id,c.program_id,c.subject_id,'content') and private.teacher_batches(array(select b.batch_id from public.content_batch_access b where b.content_id=c.id)))
 or (not staff_only and c.status='active' and private.enrolled(c.program_id) and (
 not exists(select 1 from public.content_batch_access b where b.content_id=c.id) or exists(select 1 from public.content_batch_access b where b.content_id=c.id and private.enrolled(c.program_id,b.batch_id))))))
$$;
create function private.test_access(target uuid,staff_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tests t where t.id=target and (
 (public.teacher_has_assignment(t.exam_id,t.program_id,t.subject_id,'tests') and private.teacher_batches(array(select b.batch_id from public.test_batches b where b.test_id=t.id)))
 or (not staff_only and t.status='active' and private.enrolled(t.program_id)
 and (t.available_from is null or t.available_from<=now()) and (t.available_until is null or t.available_until>now())
 and (not exists(select 1 from public.test_batches b where b.test_id=t.id) or exists(select 1 from public.test_batches b where b.test_id=t.id and private.enrolled(t.program_id,b.batch_id))))))
$$;

-- Replace core policies as a set: permissive legacy policies must not survive beside new ones.
do $$ declare r record; begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['profiles','entrance_exams','programs','subjects','program_subjects','chapters','topics','batches','batch_faculty','faculty_assignments','enrollments','learning_content','content_batch_access','questions','question_options','question_answer_keys','tests','test_batches','test_questions','test_attempts','attempt_answers','video_progress','video_checkpoints','checkpoint_responses']) loop
 execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop;
end $$;
create policy profiles_read on public.profiles for select to authenticated using(public.is_admin() or (private.active_role() is not null and id=(select auth.uid())));
create policy profiles_admin on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
do $$ declare t text; begin
 foreach t in array array['entrance_exams','programs','subjects','program_subjects','chapters','topics','batches','batch_faculty','faculty_assignments','enrollments'] loop
 execute format('create policy admin_manage on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t); end loop;
end $$;
create policy program_read on public.programs for select to authenticated using(public.has_program_access(id));
create policy exam_read on public.entrance_exams for select to authenticated using(public.is_admin() or exists(select 1 from public.programs p where p.exam_id=entrance_exams.id));
create policy subject_read on public.subjects for select to authenticated using(public.is_admin() or exists(select 1 from public.program_subjects ps where ps.subject_id=subjects.id) or public.teacher_has_assignment(null,null,id));
create policy program_subject_read on public.program_subjects for select to authenticated using(public.has_program_access(program_id));
create policy chapter_read on public.chapters for select to authenticated using(public.is_admin() or exists(select 1 from public.subjects s where s.id=chapters.subject_id));
create policy topic_read on public.topics for select to authenticated using(public.is_admin() or exists(select 1 from public.subjects s where s.id=topics.subject_id));
create policy batch_read on public.batches for select to authenticated using(private.enrolled(program_id,id) or (private.active_role()='teacher' and exists(select 1 from public.batch_faculty f where f.batch_id=batches.id and f.faculty_id=(select auth.uid()))));
create policy batch_faculty_read on public.batch_faculty for select to authenticated using(private.active_role()='teacher' and faculty_id=(select auth.uid()));
create policy faculty_read on public.faculty_assignments for select to authenticated using(private.active_role()='teacher' and faculty_id=(select auth.uid()));
create policy enrollment_read on public.enrollments for select to authenticated using(private.active_role()='student' and student_id=(select auth.uid()));
create policy content_read on public.learning_content for select to authenticated using(private.content_access(id));
create policy content_batches_read on public.content_batch_access for select to authenticated using(private.content_access(content_id));
create policy question_staff_read on public.questions for select to authenticated using(public.teacher_has_assignment(exam_id,program_id,subject_id,'questions'));
create policy options_staff_read on public.question_options for select to authenticated using(exists(select 1 from public.questions q where q.id=question_options.question_id));
create policy keys_staff_read on public.question_answer_keys for select to authenticated using(exists(select 1 from public.questions q where q.id=question_answer_keys.question_id));
create policy test_read on public.tests for select to authenticated using(private.test_access(id));
create policy test_questions_read on public.test_questions for select to authenticated using(private.test_access(test_id,true));
create policy test_batches_read on public.test_batches for select to authenticated using(private.test_access(test_id));
create policy attempts_staff_read on public.test_attempts for select to authenticated using(public.is_admin());
create policy answers_staff_read on public.attempt_answers for select to authenticated using(public.is_admin());
create policy progress_read on public.video_progress for select to authenticated using(public.is_admin() or (private.active_role()='student' and student_id=(select auth.uid()) and private.content_access(content_id)));
create policy progress_write on public.video_progress for insert to authenticated with check(private.active_role()='student' and student_id=(select auth.uid()) and private.content_access(content_id));
create policy progress_update on public.video_progress for update to authenticated using(private.active_role()='student' and student_id=(select auth.uid()) and private.content_access(content_id)) with check(private.active_role()='student' and student_id=(select auth.uid()) and private.content_access(content_id));
create policy checkpoint_staff_read on public.video_checkpoints for select to authenticated using(private.content_access(video_id,true));
create policy checkpoint_admin on public.video_checkpoints for all to authenticated using(public.is_admin()) with check(public.is_admin());
-- Checkpoint playback is intentionally disabled for this batch. Preserve existing records.
revoke execute on function public.submit_checkpoint_response(uuid,uuid[]) from public,anon,authenticated;
revoke insert,update,delete on public.test_attempts,public.attempt_answers,public.questions,public.question_options,public.question_answer_keys,public.tests,public.test_questions,public.test_batches,public.learning_content,public.content_batch_access,public.checkpoint_responses from anon,authenticated;

create function private.validate_taxonomy(ex uuid,pr uuid,su uuid,ch uuid,tp uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if pr is not null and ex is not null and not exists(select 1 from public.programs p where p.id=pr and (p.exam_id is null or p.exam_id=ex)) then raise exception 'Program and exam do not match'; end if;
 if pr is not null and su is not null and not exists(select 1 from public.program_subjects p where p.program_id=pr and p.subject_id=su) then raise exception 'Subject is not mapped to this program'; end if;
 if ch is not null and not exists(select 1 from public.chapters c where c.id=ch and c.subject_id=su and (c.program_id is null or c.program_id=pr)) then raise exception 'Chapter and subject do not match'; end if;
 if tp is not null and not exists(select 1 from public.topics t where t.id=tp and t.subject_id=su and (ch is null or t.chapter_id=ch) and (t.program_id is null or t.program_id=pr)) then raise exception 'Topic does not match taxonomy'; end if;
end $$;
create function public.core_save_question(value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare q public.questions; old public.questions; o jsonb; oid uuid; n integer; correct_n integer;
begin
 q:=jsonb_populate_record(null::public.questions,value); q.id:=coalesce(q.id,gen_random_uuid());
 select * into old from public.questions where id=q.id for update;
 if not public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions') or (old.id is not null and not public.teacher_has_assignment(old.exam_id,old.program_id,old.subject_id,'questions')) then raise exception 'Question permission denied'; end if;
 perform private.validate_taxonomy(q.exam_id,q.program_id,q.subject_id,q.chapter_id,q.topic_id);
 if q.exam_id is null or q.subject_id is null or length(btrim(coalesce(q.prompt,'')))=0 then raise exception 'Exam, subject and question text are required'; end if;
 if q.type='match_following' then raise exception 'Matching is disabled pending a dedicated pair editor and scorer'; end if;
 if q.marks<=0 or q.marks is null or q.negative_marks<0 or q.negative_marks is null then raise exception 'Invalid marks'; end if;
 select count(*),count(*) filter(where (x->>'correct')::boolean) into n,correct_n from jsonb_array_elements(value->'options') x;
 if n<2 or correct_n<1 or (q.type<>'multiple_mcq' and correct_n<>1) or exists(select 1 from jsonb_array_elements(value->'options') x where length(btrim(coalesce(x->>'content','')))=0) then raise exception 'Provide valid options and correct answers'; end if;
 if q.type='true_false' and (n<>2 or not ((value->'options') @> '[{"content":"True"},{"content":"False"}]'::jsonb)) then raise exception 'True/False requires True and False options'; end if;
 if q.type='image_mcq' and q.stem_image_path is null then raise exception 'An image is required'; end if;
 if q.stem_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.stem_image_path) then raise exception 'Question image upload is missing'; end if;
 if q.explanation_image_path is not null and not exists(select 1 from storage.objects where bucket_id='question-media' and name=q.explanation_image_path) then raise exception 'Explanation image upload is missing'; end if;
 insert into public.questions(id,exam_id,program_id,subject_id,chapter_id,topic_id,type,prompt,explanation,difficulty,marks,negative_marks,source_type,source_reference,exam_year,exam_session,source_label,status,stem_image_path,explanation_image_path)
 values(q.id,q.exam_id,q.program_id,q.subject_id,q.chapter_id,q.topic_id,q.type,q.prompt,q.explanation,q.difficulty,q.marks,q.negative_marks,coalesce(q.source_type,'standard'),q.source_reference,q.exam_year,q.exam_session,q.source_label,coalesce(q.status,'draft'),q.stem_image_path,q.explanation_image_path)
 on conflict(id) do update set exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,type=excluded.type,prompt=excluded.prompt,explanation=excluded.explanation,difficulty=excluded.difficulty,marks=excluded.marks,negative_marks=excluded.negative_marks,source_type=excluded.source_type,source_reference=excluded.source_reference,exam_year=excluded.exam_year,exam_session=excluded.exam_session,source_label=excluded.source_label,status=excluded.status,stem_image_path=excluded.stem_image_path,explanation_image_path=excluded.explanation_image_path,updated_at=now();
 delete from public.question_options where question_id=q.id;
 n:=0;
 for o in select * from jsonb_array_elements(value->'options') loop
 oid:=gen_random_uuid(); insert into public.question_options(id,question_id,content,display_order) values(oid,q.id,o->>'content',n);
 if (o->>'correct')::boolean then insert into public.question_answer_keys(question_id,option_id) values(q.id,oid); end if; n:=n+1;
 end loop;
 return q.id;
end $$;

create function public.core_save_test(value jsonb,question_ids uuid[],batch_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.tests; old public.tests; selected uuid[]; total numeric;
begin
 t:=jsonb_populate_record(null::public.tests,value); t.id:=coalesce(t.id,gen_random_uuid());
 select * into old from public.tests where id=t.id for update;
 if not public.teacher_has_assignment(t.exam_id,t.program_id,t.subject_id,'tests') or not private.teacher_batches(batch_ids) or (old.id is not null and not private.test_access(old.id,true)) then raise exception 'Test permission denied'; end if;
 perform private.validate_taxonomy(t.exam_id,t.program_id,t.subject_id,t.chapter_id,t.topic_id);
 if t.program_id is null or t.exam_id is null or length(btrim(coalesce(t.title,'')))=0 or t.duration_minutes is null or t.duration_minutes<1 or t.max_attempts is null or t.max_attempts<1 or t.default_negative_marks<0 then raise exception 'Invalid test configuration'; end if;
 if t.available_from is not null and t.available_until<=t.available_from then raise exception 'Availability end must follow start'; end if;
 if exists(select 1 from unnest(batch_ids) b where not exists(select 1 from public.batches x where x.id=b and x.program_id=t.program_id)) then raise exception 'Batch belongs to another program'; end if;
 if t.selection_mode='generated' then
 select array_agg(id) into selected from (select q.id from public.questions q where q.status='active' and q.type<>'match_following' and q.exam_id=t.exam_id and (q.program_id is null or q.program_id=t.program_id) and (t.subject_id is null or q.subject_id=t.subject_id) and (t.chapter_id is null or q.chapter_id=t.chapter_id) and (t.topic_id is null or q.topic_id=t.topic_id) and (coalesce(t.selection_rules->>'difficulty','')='' or q.difficulty=t.selection_rules->>'difficulty') order by random() limit t.question_count) q;
 if coalesce(cardinality(selected),0)<>t.question_count then raise exception 'Not enough active questions match this rule'; end if;
 else selected:=question_ids; end if;
 if coalesce(cardinality(selected),0)=0 or cardinality(selected)<>(select count(distinct x) from unnest(selected) x) then raise exception 'Select distinct active questions'; end if;
 if exists(select 1 from unnest(selected) x where not exists(select 1 from public.questions q where q.id=x and q.status='active' and q.type<>'match_following' and q.exam_id=t.exam_id and (q.program_id is null or q.program_id=t.program_id) and (t.subject_id is null or q.subject_id=t.subject_id) and (t.chapter_id is null or q.chapter_id=t.chapter_id) and (t.topic_id is null or q.topic_id=t.topic_id))) then raise exception 'Question is draft, unavailable or outside this taxonomy'; end if;
 select sum(marks) into total from public.questions where id=any(selected);
 insert into public.tests(id,slug,title,type,exam_id,program_id,subject_id,chapter_id,topic_id,question_count,duration_minutes,total_marks,default_negative_marks,max_attempts,available_from,available_until,randomize_questions,randomize_options,show_results,show_answers,show_explanations,selection_mode,selection_rules,status)
 values(t.id,coalesce(old.slug,'test-'||t.id),t.title,t.type,t.exam_id,t.program_id,t.subject_id,t.chapter_id,t.topic_id,cardinality(selected),t.duration_minutes,total,t.default_negative_marks,t.max_attempts,t.available_from,t.available_until,coalesce(t.randomize_questions,false),coalesce(t.randomize_options,false),coalesce(t.show_results,true),coalesce(t.show_answers,true),coalesce(t.show_explanations,true),coalesce(t.selection_mode,'manual'),coalesce(t.selection_rules,'{}'),coalesce(t.status,'draft'))
 on conflict(id) do update set title=excluded.title,type=excluded.type,exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,question_count=excluded.question_count,duration_minutes=excluded.duration_minutes,total_marks=excluded.total_marks,default_negative_marks=excluded.default_negative_marks,max_attempts=excluded.max_attempts,available_from=excluded.available_from,available_until=excluded.available_until,randomize_questions=excluded.randomize_questions,randomize_options=excluded.randomize_options,show_results=excluded.show_results,show_answers=excluded.show_answers,show_explanations=excluded.show_explanations,selection_mode=excluded.selection_mode,selection_rules=excluded.selection_rules,status=excluded.status,updated_at=now();
 delete from public.test_questions where test_id=t.id; delete from public.test_batches where test_id=t.id;
 insert into public.test_questions(test_id,question_id,display_order) select t.id,x,ord-1 from unnest(selected) with ordinality a(x,ord);
 insert into public.test_batches(test_id,batch_id) select t.id,x from unnest(batch_ids) x;
 return t.id;
end $$;

create function private.snapshot_questions(ids uuid[],negative numeric) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'type',q.type,'marks',q.marks,'negative_marks',negative,'stem_image_path',q.stem_image_path,'explanation',q.explanation,'explanation_image_path',q.explanation_image_path,
 'options',(select jsonb_agg(jsonb_build_object('id',o.id,'content',o.content) order by o.display_order) from public.question_options o where o.question_id=q.id),
 'correct_ids',(select jsonb_agg(k.option_id order by k.option_id) from public.question_answer_keys k where k.question_id=q.id)) order by array_position(ids,q.id)),'[]') from public.questions q where q.id=any(ids)
$$;
-- Snapshot legacy attempts before editors can replace option IDs.
insert into private.attempt_snapshots(attempt_id,questions,review_settings,total_marks)
select a.id,private.snapshot_questions(a.question_order,t.default_negative_marks),jsonb_build_object('show_results',t.show_results,'show_answers',t.show_answers,'show_explanations',t.show_explanations),coalesce(t.total_marks,0)
from public.test_attempts a join public.tests t on t.id=a.test_id;

create or replace function public.start_test_attempt(target_test uuid) returns public.test_attempts language plpgsql security definer set search_path='' as $$
declare t public.tests; a public.test_attempts; ids uuid[]; snap jsonb;
begin
 if private.active_role() is distinct from 'student' or not private.test_access(target_test) then raise exception 'Test access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||target_test::text,0));
 select * into t from public.tests where id=target_test;
 select * into a from public.test_attempts where test_id=target_test and student_id=auth.uid() and status='in_progress' for update;
 if a.id is not null then
 if a.expires_at>now() then return a; end if;
 perform public.submit_test_attempt(a.id);
 end if;
 if (select count(*) from public.test_attempts where test_id=target_test and student_id=auth.uid())>=t.max_attempts then raise exception 'Attempt limit reached'; end if;
 if t.selection_mode='generated' then
 select array_agg(id) into ids from (select q.id from public.questions q where q.status='active' and q.type<>'match_following' and q.exam_id=t.exam_id and (q.program_id is null or q.program_id=t.program_id) and (t.subject_id is null or q.subject_id=t.subject_id) and (t.chapter_id is null or q.chapter_id=t.chapter_id) and (t.topic_id is null or q.topic_id=t.topic_id) and (coalesce(t.selection_rules->>'difficulty','')='' or q.difficulty=t.selection_rules->>'difficulty') order by random() limit t.question_count) q;
 else select array_agg(q.id order by case when t.randomize_questions then random() else tq.display_order end) into ids from public.test_questions tq join public.questions q on q.id=tq.question_id where tq.test_id=t.id and q.status='active'; end if;
 if coalesce(cardinality(ids),0)<>t.question_count then raise exception 'Test bank is no longer ready'; end if;
 snap:=private.snapshot_questions(ids,t.default_negative_marks);
 insert into public.test_attempts(test_id,student_id,question_order,expires_at,option_order) values(t.id,auth.uid(),ids,least(now()+make_interval(mins=>t.duration_minutes),coalesce(t.available_until,'infinity')),
 (select jsonb_object_agg(q->>'id',(select jsonb_agg(o->>'id' order by case when t.randomize_options then random() else ord end) from jsonb_array_elements(q->'options') with ordinality x(o,ord))) from jsonb_array_elements(snap) q)) returning * into a;
 insert into private.attempt_snapshots values(a.id,snap,jsonb_build_object('show_results',t.show_results,'show_answers',t.show_answers,'show_explanations',t.show_explanations),(select sum((q->>'marks')::numeric) from jsonb_array_elements(snap) q));
 return a;
end $$;
create or replace function public.save_attempt_answer(target_attempt uuid,target_question uuid,option_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; q jsonb;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid() for update;
 if private.active_role() is distinct from 'student' or a.id is null or not private.test_access(a.test_id) or a.status<>'in_progress' or a.expires_at<=now() then raise exception 'Attempt is unavailable or expired'; end if;
 select x into q from private.attempt_snapshots s,jsonb_array_elements(s.questions) x where s.attempt_id=a.id and x->>'id'=target_question::text;
 if q is null or option_ids is null or (q->>'type'<>'multiple_mcq' and cardinality(option_ids)>1) or cardinality(option_ids)<>(select count(distinct x) from unnest(option_ids) x) or exists(select 1 from unnest(option_ids) x where not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=x::text)) then raise exception 'Invalid answer payload'; end if;
 insert into public.attempt_answers(attempt_id,question_id,selected_option_ids) values(a.id,target_question,option_ids) on conflict(attempt_id,question_id) do update set selected_option_ids=excluded.selected_option_ids,answered_at=now();
end $$;
create or replace function public.submit_test_attempt(target_attempt uuid) returns numeric language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; q jsonb; chosen uuid[]; keys uuid[]; good boolean; earned numeric; total numeric:=0; right_n integer:=0; wrong_n integer:=0; blank_n integer:=0; negative numeric:=0;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid() for update;
 if private.active_role() is distinct from 'student' or a.id is null or not private.enrolled((select program_id from public.tests where id=a.test_id)) then raise exception 'Attempt access denied'; end if;
 if a.status<>'in_progress' then return a.score; end if;
 for q in select x from private.attempt_snapshots s,jsonb_array_elements(s.questions) x where s.attempt_id=a.id loop
 select selected_option_ids into chosen from public.attempt_answers where attempt_id=a.id and question_id=(q->>'id')::uuid;
 select array_agg(x::uuid order by x::uuid) into keys from jsonb_array_elements_text(q->'correct_ids') x;
 if coalesce(cardinality(chosen),0)=0 then blank_n:=blank_n+1; earned:=0; good:=null;
 else good:=keys=(select array_agg(x order by x) from unnest(chosen) x); if good then right_n:=right_n+1; earned:=(q->>'marks')::numeric; else wrong_n:=wrong_n+1; earned:=-(q->>'negative_marks')::numeric; negative:=negative-earned; end if; end if;
 total:=total+earned; update public.attempt_answers set is_correct=good,marks_awarded=earned where attempt_id=a.id and question_id=(q->>'id')::uuid;
 end loop;
 update public.test_attempts set score=total,status='submitted',submitted_at=now(),correct_count=right_n,incorrect_count=wrong_n,unanswered_count=blank_n,negative_marks_total=negative where id=a.id;
 return total;
end $$;
create function public.core_attempt_history(target_test uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'test_id',a.test_id,'status',a.status,'started_at',a.started_at,'expires_at',a.expires_at,'submitted_at',a.submitted_at,'score',case when (s.review_settings->>'show_results')::boolean then a.score else null end) order by a.started_at desc),'[]') from public.test_attempts a join private.attempt_snapshots s on s.attempt_id=a.id where private.active_role()='student' and a.student_id=auth.uid() and (target_test is null or a.test_id=target_test) and private.enrolled((select program_id from public.tests where id=a.test_id))
$$;
create function public.core_attempt_payload(target_attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; s private.attempt_snapshots;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid();
 if private.active_role() is distinct from 'student' or a.id is null or not private.test_access(a.test_id) then raise exception 'Attempt access denied'; end if;
 if a.status='in_progress' and a.expires_at<=now() then perform public.submit_test_attempt(a.id); select * into a from public.test_attempts where id=a.id; end if;
 select * into s from private.attempt_snapshots where attempt_id=a.id;
 return jsonb_build_object('id',a.id,'status',a.status,'expires_at',a.expires_at,'option_order',a.option_order,'questions',case when a.status='in_progress' then (select jsonb_agg(q-'correct_ids'-'explanation'-'explanation_image_path') from jsonb_array_elements(s.questions) q) else '[]'::jsonb end,'answers',(select coalesce(jsonb_object_agg(question_id,selected_option_ids),'{}') from public.attempt_answers where attempt_id=a.id));
end $$;
create or replace function public.get_test_review(target_attempt uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',a.status,'results_visible',(s.review_settings->>'show_results')::boolean,'score',case when (s.review_settings->>'show_results')::boolean then a.score end,'total_marks',s.total_marks,'answers',case when (s.review_settings->>'show_answers')::boolean then (select jsonb_agg(jsonb_build_object('question_id',q->>'id','prompt',q->>'prompt','options',q->'options','stem_image_path',q->>'stem_image_path','selected_option_ids',coalesce(to_jsonb(aa.selected_option_ids),'[]'),'correct_option_ids',q->'correct_ids','marks_awarded',coalesce(aa.marks_awarded,0),'explanation',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation' end,'explanation_image_path',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation_image_path' end)) from jsonb_array_elements(s.questions) q left join public.attempt_answers aa on aa.attempt_id=a.id and aa.question_id=(q->>'id')::uuid) else '[]'::jsonb end)
 from public.test_attempts a join private.attempt_snapshots s on s.attempt_id=a.id where a.id=target_attempt and a.student_id=auth.uid() and private.active_role()='student' and a.status<>'in_progress' and private.enrolled((select program_id from public.tests where id=a.test_id))
$$;

-- Private images are authorized against immutable attempt snapshots, not public answer rows.
insert into storage.buckets(id,name,public,allowed_mime_types,file_size_limit) values('question-media','question-media',false,array['image/png','image/jpeg','image/webp'],10485760) on conflict(id) do nothing;
create function private.image_access(path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_admin() or (private.active_role()='teacher' and (split_part(path,'/',1)=auth.uid()::text or exists(select 1 from public.questions q where (q.stem_image_path=path or q.explanation_image_path=path) and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions'))))
 or (private.active_role()='student' and exists(select 1 from private.attempt_snapshots s join public.test_attempts a on a.id=s.attempt_id,jsonb_array_elements(s.questions) q where a.student_id=auth.uid() and private.enrolled((select program_id from public.tests where id=a.test_id)) and (q->>'stem_image_path'=path or (a.status<>'in_progress' and (s.review_settings->>'show_answers')::boolean and (s.review_settings->>'show_explanations')::boolean and q->>'explanation_image_path'=path))))
$$;
create policy question_image_read on storage.objects for select to authenticated using(bucket_id='question-media' and private.image_access(name));
create policy question_image_upload on storage.objects for insert to authenticated with check(bucket_id='question-media' and public.is_teacher() and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists learning_storage_permitted_read on storage.objects;
drop policy if exists learning_storage_authorized_insert on storage.objects;
create policy learning_storage_permitted_read on storage.objects for select to authenticated using(bucket_id in ('learning-content','class-recordings') and (public.is_admin() or exists(select 1 from public.learning_content c where c.storage_bucket=storage.objects.bucket_id and c.storage_path=storage.objects.name and private.content_access(c.id))));
create policy learning_storage_authorized_insert on storage.objects for insert to authenticated with check(bucket_id='learning-content' and public.is_teacher() and split_part(name,'/',1)=auth.uid()::text);

-- Default EXECUTE is revoked for every helper and new public RPC.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.active_role(),private.enrolled(uuid,uuid),private.content_access(uuid,boolean),private.test_access(uuid,boolean),private.teacher_batches(uuid[]),private.image_access(text) to authenticated;
revoke all on function public.core_save_question(jsonb),public.core_save_test(jsonb,uuid[],uuid[]),public.core_attempt_history(uuid),public.core_attempt_payload(uuid) from public,anon;
grant execute on function public.core_save_question(jsonb),public.core_save_test(jsonb,uuid[],uuid[]),public.core_attempt_history(uuid),public.core_attempt_payload(uuid) to authenticated;

create function public.core_save_content(value jsonb,batch_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.learning_content; old public.learning_content;
begin
 c:=jsonb_populate_record(null::public.learning_content,value); c.id:=coalesce(c.id,gen_random_uuid());
 select * into old from public.learning_content where id=c.id for update;
 if not public.teacher_has_assignment(c.exam_id,c.program_id,c.subject_id,'content') or not private.teacher_batches(batch_ids) or (old.id is not null and not private.content_access(old.id,true)) then raise exception 'Content permission denied'; end if;
 perform private.validate_taxonomy(c.exam_id,c.program_id,c.subject_id,c.chapter_id,c.topic_id);
 if c.program_id is null or c.subject_id is null or length(btrim(coalesce(c.title,'')))=0 then raise exception 'Title, program and subject are required'; end if;
 if exists(select 1 from unnest(batch_ids) b where not exists(select 1 from public.batches x where x.id=b and x.program_id=c.program_id)) then raise exception 'Batch belongs to another program'; end if;
 if c.storage_path is not null and (c.storage_bucket<>'learning-content' or not exists(select 1 from storage.objects o where o.bucket_id=c.storage_bucket and o.name=c.storage_path and (public.is_admin() or o.owner_id=auth.uid()::text or c.storage_path=old.storage_path))) then raise exception 'Uploaded file is unavailable'; end if;
 if c.kind<>'note' and c.storage_path is null and coalesce(c.external_url,'') !~ '^https://' then raise exception 'Provide an uploaded file or HTTPS source'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c.program_id::text,1));
 insert into public.learning_content(id,slug,title,kind,description,exam_id,program_id,subject_id,chapter_id,topic_id,faculty_id,external_url,storage_bucket,storage_path,mime_type,byte_size,status,allow_download,display_order)
 values(c.id,coalesce(old.slug,'content-'||c.id),c.title,c.kind,c.description,c.exam_id,c.program_id,c.subject_id,c.chapter_id,c.topic_id,c.faculty_id,c.external_url,c.storage_bucket,c.storage_path,c.mime_type,c.byte_size,coalesce(c.status,'draft'),coalesce(c.allow_download,false),case when old.program_id=c.program_id then old.display_order else coalesce((select max(display_order)+1 from public.learning_content where program_id=c.program_id),0) end)
 on conflict(id) do update set title=excluded.title,kind=excluded.kind,description=excluded.description,exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,faculty_id=excluded.faculty_id,external_url=excluded.external_url,storage_bucket=excluded.storage_bucket,storage_path=excluded.storage_path,mime_type=excluded.mime_type,byte_size=excluded.byte_size,status=excluded.status,allow_download=excluded.allow_download,display_order=excluded.display_order,updated_at=now();
 delete from public.content_batch_access where content_id=c.id; insert into public.content_batch_access select c.id,x from unnest(batch_ids) x;
 return c.id;
end $$;
create function public.core_move_content(target uuid,direction integer) returns void language plpgsql security definer set search_path='' as $$
declare c public.learning_content; other public.learning_content;
begin
 if direction not in (-1,1) or not private.content_access(target,true) then raise exception 'Content permission denied'; end if;
 select * into c from public.learning_content where id=target;
 perform pg_advisory_xact_lock(hashtextextended(c.program_id::text,1));
 -- Normalize legacy duplicate orders once under the same lock.
 with ordered as(select id,row_number() over(order by display_order,created_at,id)-1 as pos from public.learning_content where program_id=c.program_id) update public.learning_content x set display_order=o.pos from ordered o where x.id=o.id;
 select * into c from public.learning_content where id=target;
 select * into other from public.learning_content where program_id=c.program_id and display_order=c.display_order+direction;
 if other.id is not null then
 if not private.content_access(other.id,true) then raise exception 'Adjacent content belongs to another assignment'; end if;
 update public.learning_content set display_order=case when id=c.id then other.display_order else c.display_order end where id in (c.id,other.id);
 end if;
end $$;
alter table public.chapters add column if not exists description text;
alter table public.topics add column if not exists description text;
alter table public.batches add constraint core_batch_dates check(ends_on is null or starts_on is null or ends_on>=starts_on),add constraint core_batch_access_dates check(access_expires_at is null or access_starts_at is null or access_expires_at>access_starts_at);
create function public.core_program_subjects(target_program uuid,subject_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required'; end if;
 delete from public.program_subjects where program_id=target_program;
 insert into public.program_subjects(program_id,subject_id,display_order) select target_program,x,ord-1 from unnest(subject_ids) with ordinality a(x,ord);
end $$;
revoke all on function public.core_save_content(jsonb,uuid[]),public.core_move_content(uuid,integer),public.core_program_subjects(uuid,uuid[]) from public,anon;
grant execute on function public.core_save_content(jsonb,uuid[]),public.core_move_content(uuid,integer),public.core_program_subjects(uuid,uuid[]) to authenticated;

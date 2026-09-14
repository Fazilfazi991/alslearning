-- Configurable Exams & Quizzes completion. Existing attempts and question
-- content remain immutable; new attempts snapshot all rules they depend on.
alter type public.test_kind add value if not exists 'practice';

alter table public.tests
  add column if not exists internal_description text not null default '',
  add column if not exists instructions text not null default '',
  add column if not exists pass_percentage numeric(5,2),
  alter column question_count set default 0;

alter table public.tests drop constraint if exists tests_question_count_check;
alter table public.tests add constraint tests_question_count_check check(question_count >= 0);
alter table public.tests add constraint tests_pass_percentage_check check(pass_percentage is null or pass_percentage between 0 and 100);
alter table public.tests add constraint tests_pass_rule_check check(target_score is null or pass_percentage is null);
alter table public.tests add constraint tests_description_length_check check(char_length(internal_description) <= 5000);
alter table public.tests add constraint tests_instructions_length_check check(char_length(instructions) <= 10000);

alter table public.test_attempts
  add column if not exists marked_for_review uuid[] not null default '{}';

create index if not exists test_attempts_student_test_started_idx
  on public.test_attempts(student_id,test_id,started_at desc);
create index if not exists tests_program_status_availability_idx
  on public.tests(program_id,status,available_from,available_until);
create index if not exists questions_test_scope_idx
  on public.questions(exam_id,program_id,subject_id,chapter_id,status);

create or replace function private.snapshot_questions(ids uuid[],negative numeric)
returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',q.id,'prompt',q.prompt,'prompt_rich',q.prompt_rich,'explanation_rich',q.explanation_rich,
 'subject_id',q.subject_id,'subject_name',s.name,'chapter_id',q.chapter_id,'chapter_name',c.name,
 'stem_media',(select coalesce(jsonb_agg(to_jsonb(m) order by m.position),'[]') from public.question_media m where m.question_id=q.id and m.kind='stem'),
 'solution_media',(select coalesce(jsonb_agg(to_jsonb(m) order by m.position),'[]') from public.question_media m where m.question_id=q.id and m.kind='solution'),
 'type',q.type,'marks',q.marks,'negative_marks',negative,'stem_image_path',q.stem_image_path,
 'explanation',q.explanation,'explanation_image_path',q.explanation_image_path,
 'options',(select jsonb_agg(jsonb_build_object('id',o.id,'content',o.content,'content_rich',o.content_rich) order by o.display_order) from public.question_options o where o.question_id=q.id),
 'correct_ids',(select jsonb_agg(k.option_id order by k.option_id) from public.question_answer_keys k where k.question_id=q.id)
 ) order by array_position(ids,q.id)),'[]')
 from public.questions q join public.subjects s on s.id=q.subject_id
 left join public.chapters c on c.id=q.chapter_id where q.id=any(ids)
$$;
revoke all on function private.snapshot_questions(uuid[],numeric) from public,anon,authenticated,service_role;

create or replace function public.core_save_test(value jsonb, question_ids uuid[], batch_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare t public.tests; old public.tests; selected uuid[]:='{}'; sample uuid[]; total numeric;
begin
 t:=jsonb_populate_record(null::public.tests,value); t.id:=coalesce(t.id,gen_random_uuid());
 t.title:=btrim(coalesce(t.title,'')); t.status:=coalesce(t.status,'draft');
 t.type:=coalesce(t.type,'mock'); t.selection_mode:=coalesce(t.selection_mode,'manual');
 t.selection_rules:=coalesce(t.selection_rules,'{}'); t.duration_minutes:=coalesce(t.duration_minutes,30);
 t.question_count:=coalesce(t.question_count,0); t.default_negative_marks:=coalesce(t.default_negative_marks,0);
 select * into old from public.tests where id=t.id for update;
 if old.id is not null and not private.test_access(old.id,true) then raise exception 'Test permission denied'; end if;
 if old.id is null and not public.is_admin() and not public.teacher_has_assignment(t.exam_id,t.program_id,t.subject_id,'tests') then raise exception 'Test permission denied'; end if;
 if length(t.title)=0 then raise exception 'Test title is required'; end if;
 if t.duration_minutes<1 or t.default_negative_marks<0 or (t.max_attempts is not null and t.max_attempts<1) then raise exception 'Invalid test rules'; end if;
 if t.available_from is not null and t.available_until is not null and t.available_until<=t.available_from then raise exception 'Availability end must follow start'; end if;
 if exists(select 1 from unnest(coalesce(batch_ids,'{}')) b where not exists(select 1 from public.batches x where x.id=b and x.program_id=t.program_id)) then raise exception 'Batch belongs to another program'; end if;

 if t.status='active' then
  if t.program_id is null or t.exam_id is null then raise exception 'Published tests require an exam and program'; end if;
  perform private.validate_taxonomy(t.exam_id,t.program_id,t.subject_id,t.chapter_id,t.topic_id);
  perform private.validate_test_scopes(t);
  if t.selection_mode='generated' and t.selection_rules ? 'scopes' then
   select sum((s->>'count')::integer) into t.question_count from jsonb_array_elements(t.selection_rules->'scopes') s;
  end if;
  if t.selection_mode='generated' then
   sample:=private.draw_test_questions(t);
   if coalesce(cardinality(sample),0)<>t.question_count then raise exception 'Not enough active questions match this rule'; end if;
  else
   selected:=coalesce(question_ids,'{}'); t.question_count:=cardinality(selected);
   if cardinality(selected)=0 or cardinality(selected)<>(select count(distinct x) from unnest(selected) x) then raise exception 'Select distinct active questions'; end if;
   if exists(select 1 from unnest(selected) x where not exists(select 1 from public.questions q where q.id=x and private.test_scope_matches(q,t))) then raise exception 'Question is draft, unavailable or outside this taxonomy'; end if;
  end if;
 elsif t.exam_id is not null or t.program_id is not null or t.subject_id is not null or t.selection_rules ? 'scopes' then
  if t.exam_id is null or t.program_id is null then raise exception 'Choose both exam and program when setting a Draft scope'; end if;
  perform private.validate_taxonomy(t.exam_id,t.program_id,t.subject_id,t.chapter_id,t.topic_id);
  if t.selection_rules ? 'scopes' then perform private.validate_test_scopes(t); end if;
  if t.selection_mode='manual' and cardinality(coalesce(question_ids,'{}'))>0 then
   selected:=question_ids; t.question_count:=cardinality(selected);
   if cardinality(selected)<>(select count(distinct x) from unnest(selected) x) or exists(select 1 from unnest(selected) x where not exists(select 1 from public.questions q where q.id=x and private.test_scope_matches(q,t))) then raise exception 'Question is draft, unavailable or outside this taxonomy'; end if;
  elsif t.selection_mode='generated' and t.selection_rules ? 'scopes' then
   select coalesce(sum((s->>'count')::integer),0) into t.question_count from jsonb_array_elements(t.selection_rules->'scopes') s;
  end if;
 end if;
 if t.selection_mode='manual' then select sum(marks) into total from public.questions where id=any(selected); else total:=null; end if;
 insert into public.tests(id,slug,title,type,exam_id,program_id,subject_id,chapter_id,topic_id,question_count,duration_minutes,total_marks,default_negative_marks,target_score,max_attempts,available_from,available_until,randomize_questions,randomize_options,show_results,show_answers,show_explanations,selection_mode,selection_rules,status,internal_description,instructions,pass_percentage)
 values(t.id,coalesce(old.slug,'test-'||t.id),t.title,t.type,t.exam_id,t.program_id,t.subject_id,t.chapter_id,t.topic_id,t.question_count,t.duration_minutes,total,t.default_negative_marks,t.target_score,t.max_attempts,t.available_from,t.available_until,coalesce(t.randomize_questions,false),coalesce(t.randomize_options,false),coalesce(t.show_results,true),coalesce(t.show_answers,true),coalesce(t.show_explanations,true),t.selection_mode,t.selection_rules,t.status,coalesce(t.internal_description,''),coalesce(t.instructions,''),t.pass_percentage)
 on conflict(id) do update set title=excluded.title,type=excluded.type,exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,question_count=excluded.question_count,duration_minutes=excluded.duration_minutes,total_marks=excluded.total_marks,default_negative_marks=excluded.default_negative_marks,target_score=excluded.target_score,max_attempts=excluded.max_attempts,available_from=excluded.available_from,available_until=excluded.available_until,randomize_questions=excluded.randomize_questions,randomize_options=excluded.randomize_options,show_results=excluded.show_results,show_answers=excluded.show_answers,show_explanations=excluded.show_explanations,selection_mode=excluded.selection_mode,selection_rules=excluded.selection_rules,status=excluded.status,internal_description=excluded.internal_description,instructions=excluded.instructions,pass_percentage=excluded.pass_percentage,updated_at=now();
 delete from public.test_questions where test_id=t.id; delete from public.test_batches where test_id=t.id;
 if t.selection_mode='manual' then insert into public.test_questions(test_id,question_id,display_order) select t.id,x,ord-1 from unnest(selected) with ordinality a(x,ord); end if;
 insert into public.test_batches(test_id,batch_id) select t.id,x from unnest(coalesce(batch_ids,'{}')) x;
 return t.id;
end $$;
revoke all on function public.core_save_test(jsonb,uuid[],uuid[]) from public,anon,service_role;
grant execute on function public.core_save_test(jsonb,uuid[],uuid[]) to authenticated;

create or replace function public.start_test_attempt(target_test uuid)
returns public.test_attempts language plpgsql security definer set search_path='' as $$
declare t public.tests; a public.test_attempts; ids uuid[]; snap jsonb;
begin
 if coalesce(private.active_role(),'') is distinct from 'student' then raise exception 'Test access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||target_test::text,0));
 select * into t from public.tests where id=target_test;
 if t.id is null or not private.attempt_access(t.id) then raise exception 'Test access denied'; end if;
 select * into a from public.test_attempts where test_id=target_test and student_id=auth.uid() and status='in_progress' order by started_at desc limit 1 for update;
 if a.id is not null then
  if a.expires_at>now() then return a; end if;
  perform public.submit_test_attempt(a.id);
 end if;
 if not private.test_access(target_test) then raise exception 'Test is not currently available'; end if;
 if t.max_attempts is not null and (select count(*) from public.test_attempts where test_id=target_test and student_id=auth.uid())>=t.max_attempts then raise exception 'Attempt limit reached'; end if;
 if t.selection_mode='generated' then ids:=private.draw_test_questions(t);
 else select array_agg(q.id order by case when t.randomize_questions then random() else tq.display_order end) into ids from public.test_questions tq join public.questions q on q.id=tq.question_id where tq.test_id=t.id and q.status='active'; end if;
 if coalesce(cardinality(ids),0)<>t.question_count then raise exception 'Test bank is no longer ready'; end if;
 snap:=private.snapshot_questions(ids,t.default_negative_marks);
 insert into public.test_attempts(test_id,student_id,question_order,expires_at,option_order)
 values(t.id,auth.uid(),ids,now()+make_interval(mins=>t.duration_minutes),
 (select jsonb_object_agg(q->>'id',(select jsonb_agg(o->>'id' order by case when t.randomize_options then random() else ord end) from jsonb_array_elements(q->'options') with ordinality x(o,ord))) from jsonb_array_elements(snap) q)) returning * into a;
 insert into private.attempt_snapshots values(a.id,snap,jsonb_build_object('show_results',t.show_results,'show_answers',t.show_answers,'show_explanations',t.show_explanations,'target_score',t.target_score,'pass_percentage',t.pass_percentage),(select sum((q->>'marks')::numeric) from jsonb_array_elements(snap) q));
 return a;
end $$;
revoke all on function public.start_test_attempt(uuid) from public,anon,service_role;
grant execute on function public.start_test_attempt(uuid) to authenticated;

create or replace function public.save_attempt_answer(target_attempt uuid,target_question uuid,option_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; q jsonb;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid() for update;
 if coalesce(private.active_role(),'') is distinct from 'student' or a.id is null or not private.attempt_access(a.test_id) or a.status<>'in_progress' or a.expires_at<=now() then raise exception 'Attempt is unavailable or expired'; end if;
 select x into q from private.attempt_snapshots s,jsonb_array_elements(s.questions) x where s.attempt_id=a.id and x->>'id'=target_question::text;
 if q is null or option_ids is null or (q->>'type'<>'multiple_mcq' and cardinality(option_ids)>1) or cardinality(option_ids)<>(select count(distinct x) from unnest(option_ids) x) or exists(select 1 from unnest(option_ids) x where not exists(select 1 from jsonb_array_elements(q->'options') o where o->>'id'=x::text)) then raise exception 'Invalid answer payload'; end if;
 if cardinality(option_ids)=0 then delete from public.attempt_answers where attempt_id=a.id and question_id=target_question;
 else insert into public.attempt_answers(attempt_id,question_id,selected_option_ids) values(a.id,target_question,option_ids) on conflict(attempt_id,question_id) do update set selected_option_ids=excluded.selected_option_ids,answered_at=now(); end if;
end $$;
revoke all on function public.save_attempt_answer(uuid,uuid,uuid[]) from public,anon,service_role;
grant execute on function public.save_attempt_answer(uuid,uuid,uuid[]) to authenticated;

create function public.set_attempt_review_flag(target_attempt uuid,target_question uuid,marked boolean)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare a public.test_attempts;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid() for update;
 if coalesce(private.active_role(),'')<>'student' or a.id is null or a.status<>'in_progress' or a.expires_at<=now() or not target_question=any(a.question_order) then raise exception 'Attempt is unavailable'; end if;
 update public.test_attempts set marked_for_review=case when marked then array(select distinct x from unnest(marked_for_review||target_question) x) else array_remove(marked_for_review,target_question) end where id=a.id returning * into a;
 return a.marked_for_review;
end $$;
revoke all on function public.set_attempt_review_flag(uuid,uuid,boolean) from public,anon,service_role;
grant execute on function public.set_attempt_review_flag(uuid,uuid,boolean) to authenticated;

create or replace function public.core_attempt_payload(target_attempt uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.test_attempts; s private.attempt_snapshots;
begin
 select * into a from public.test_attempts where id=target_attempt and student_id=auth.uid();
 if coalesce(private.active_role(),'')<>'student' or a.id is null or not private.attempt_access(a.test_id) then raise exception 'Attempt access denied'; end if;
 if a.status='in_progress' and a.expires_at<=now() then perform public.submit_test_attempt(a.id); select * into a from public.test_attempts where id=a.id; end if;
 select * into s from private.attempt_snapshots where attempt_id=a.id;
 return jsonb_build_object('id',a.id,'status',a.status,'expires_at',a.expires_at,'option_order',a.option_order,'marked_for_review',a.marked_for_review,
 'questions',case when a.status='in_progress' then (select jsonb_agg(q-'correct_ids'-'explanation'-'explanation_image_path'-'explanation_rich'-'solution_media') from jsonb_array_elements(s.questions) q) else '[]'::jsonb end,
 'answers',(select coalesce(jsonb_object_agg(question_id,selected_option_ids),'{}') from public.attempt_answers where attempt_id=a.id));
end $$;
revoke all on function public.core_attempt_payload(uuid) from public,anon,service_role;
grant execute on function public.core_attempt_payload(uuid) to authenticated;

create or replace function public.core_attempt_history(target_test uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'test_id',a.test_id,'test_title',t.title,'status',a.status,'started_at',a.started_at,'expires_at',a.expires_at,'submitted_at',a.submitted_at,
 'score',case when (s.review_settings->>'show_results')::boolean then a.score else null end,'total_marks',s.total_marks,'correct',case when (s.review_settings->>'show_results')::boolean then a.correct_count end,'incorrect',case when (s.review_settings->>'show_results')::boolean then a.incorrect_count end,'unanswered',case when (s.review_settings->>'show_results')::boolean then a.unanswered_count end,
 'attempt_number',(select count(*) from public.test_attempts prior where prior.test_id=a.test_id and prior.student_id=a.student_id and prior.started_at<=a.started_at)) order by a.started_at desc),'[]')
 from public.test_attempts a join public.tests t on t.id=a.test_id join private.attempt_snapshots s on s.attempt_id=a.id
 where coalesce(private.active_role(),'')='student' and a.student_id=auth.uid() and (target_test is null or a.test_id=target_test) and private.attempt_access(a.test_id)
$$;
revoke all on function public.core_attempt_history(uuid) from public,anon,service_role;
grant execute on function public.core_attempt_history(uuid) to authenticated;

create or replace function public.core_test_summary(test_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',t.id,'title',t.title,'slug',t.slug,'type',t.type,'instructions',t.instructions,'max_attempts',t.max_attempts,'duration_minutes',t.duration_minutes,'question_count',t.question_count,'total_marks',t.total_marks,'default_negative_marks',t.default_negative_marks,'target_score',t.target_score,'pass_percentage',t.pass_percentage,'available_from',t.available_from,'available_until',t.available_until,
 'subjects',(select coalesce(jsonb_agg(distinct s.name),'[]') from public.subjects s where s.id=t.subject_id or exists(select 1 from jsonb_array_elements(coalesce(t.selection_rules->'scopes','[]')) x where x->>'subject_id'=s.id::text)),
 'attempts_used',(select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid()),
 'can_start',private.test_access(t.id) and (t.max_attempts is null or (select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid())<t.max_attempts))
 from public.tests t where t.slug=test_slug and coalesce(private.active_role(),'')='student' and private.attempt_access(t.id)
 and (t.status='active' or exists(select 1 from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid()))
$$;
revoke all on function public.core_test_summary(text) from public,anon,service_role;
grant execute on function public.core_test_summary(text) to authenticated;

create function public.core_student_test_catalog()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'slug',x.slug,'title',x.title,'type',x.type,'duration_minutes',x.duration_minutes,'question_count',x.question_count,'total_marks',x.total_marks,'available_from',x.available_from,'available_until',x.available_until,'program_id',x.program_id,'subjects',x.subjects,'attempts_used',x.attempts_used,'max_attempts',x.max_attempts,'last_score',x.last_score,'state',x.state) order by case x.state when 'in_progress' then 0 when 'available' then 1 when 'upcoming' then 2 when 'completed' then 3 else 4 end,x.available_from nulls first,x.title),'[]') from (
  select t.*,
   (select coalesce(jsonb_agg(distinct s.name),'[]') from public.subjects s where s.id=t.subject_id or exists(select 1 from jsonb_array_elements(coalesce(t.selection_rules->'scopes','[]')) r where r->>'subject_id'=s.id::text)) subjects,
   (select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid()) attempts_used,
   (select a.score from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid() and a.status<>'in_progress' order by a.started_at desc limit 1) last_score,
   case when exists(select 1 from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid() and a.status='in_progress') then 'in_progress'
    when t.available_from is not null and t.available_from>now() then 'upcoming'
    when t.available_until is not null and t.available_until<=now() then 'closed'
    when (select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid())>0 and t.max_attempts is not null and (select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid())>=t.max_attempts then 'completed'
    else 'available' end state
  from public.tests t where t.status='active' and coalesce(private.active_role(),'')='student' and private.attempt_access(t.id)
 ) x
$$;
revoke all on function public.core_student_test_catalog() from public,anon,service_role;
grant execute on function public.core_student_test_catalog() to authenticated;

create function public.core_test_question_page(scope jsonb,page_number integer default 0,page_size integer default 20,search_text text default '')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.tests; result jsonb; safe_page integer:=greatest(coalesce(page_number,0),0); safe_size integer:=least(greatest(coalesce(page_size,20),1),50);
begin
 if coalesce(private.active_role(),'') not in ('admin','teacher') then raise exception 'Test authoring access denied'; end if;
 t:=jsonb_populate_record(null::public.tests,coalesce(scope,'{}'));
 if t.exam_id is null or t.program_id is null then return jsonb_build_object('rows','[]'::jsonb,'total',0,'scope_total',0,'by_subject','{}'::jsonb); end if;
 with scoped as (
  select q.id,q.exam_id,q.program_id,q.subject_id,q.chapter_id,q.topic_id,q.type,q.status,q.difficulty,q.marks,q.prompt,q.source_label,q.source_reference
  from public.questions q where private.test_scope_matches(q,t) and public.teacher_has_assignment(q.exam_id,t.program_id,q.subject_id,'tests')
  and (coalesce(t.selection_rules->>'difficulty','')='' or q.difficulty=t.selection_rules->>'difficulty')
 ), eligible as (
  select * from scoped q where
  (scope->>'view_subject_id' is null or q.subject_id=(scope->>'view_subject_id')::uuid)
  and (scope->>'view_chapter_id' is null or q.chapter_id=(scope->>'view_chapter_id')::uuid)
  and (coalesce(btrim(search_text),'')='' or q.prompt ilike '%'||btrim(search_text)||'%' or coalesce(q.source_label,'') ilike '%'||btrim(search_text)||'%' or coalesce(q.source_reference,'') ilike '%'||btrim(search_text)||'%')
 ), page_rows as (select * from eligible order by source_label nulls last,id offset safe_page*safe_size limit safe_size)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by source_label nulls last,id) from page_rows p),'[]'),'total',(select count(*) from eligible),'scope_total',(select count(*) from scoped),'by_subject',coalesce((select jsonb_object_agg(subject_id,n) from (select subject_id,count(*) n from scoped group by subject_id)c),'{}')) into result;
 return result;
end $$;
revoke all on function public.core_test_question_page(jsonb,integer,integer,text) from public,anon,service_role;
grant execute on function public.core_test_question_page(jsonb,integer,integer,text) to authenticated;

create function public.core_admin_test_results(target_test uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when not private.test_access(target_test,true) then null else jsonb_build_object(
  'attempt_count',(select count(*) from public.test_attempts a where a.test_id=target_test),
  'average_score',(select round(avg(a.score),2) from public.test_attempts a where a.test_id=target_test and a.status<>'in_progress'),
  'attempts',(select coalesce(jsonb_agg(jsonb_build_object('student',coalesce(p.full_name,p.email,'Student'),'attempt_number',(select count(*) from public.test_attempts prior where prior.test_id=a.test_id and prior.student_id=a.student_id and prior.started_at<=a.started_at),'started_at',a.started_at,'submitted_at',a.submitted_at,'score',a.score,'correct',a.correct_count,'incorrect',a.incorrect_count,'unanswered',a.unanswered_count,'status',a.status) order by a.started_at desc),'[]') from public.test_attempts a join public.profiles p on p.id=a.student_id where a.test_id=target_test)
 ) end
$$;
revoke all on function public.core_admin_test_results(uuid) from public,anon,service_role;
grant execute on function public.core_admin_test_results(uuid) to authenticated;

create or replace function public.get_test_review(target_attempt uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',a.status,'results_visible',(s.review_settings->>'show_results')::boolean,
 'score',case when (s.review_settings->>'show_results')::boolean then a.score end,'total_marks',s.total_marks,
 'correct',case when (s.review_settings->>'show_results')::boolean then a.correct_count end,'incorrect',case when (s.review_settings->>'show_results')::boolean then a.incorrect_count end,'unanswered',case when (s.review_settings->>'show_results')::boolean then a.unanswered_count end,'negative_marks',case when (s.review_settings->>'show_results')::boolean then a.negative_marks_total end,
 'passed',case when not (s.review_settings->>'show_results')::boolean then null when s.review_settings->>'target_score' is not null then a.score>=(s.review_settings->>'target_score')::numeric when s.review_settings->>'pass_percentage' is not null then a.score/nullif(s.total_marks,0)*100>=(s.review_settings->>'pass_percentage')::numeric else null end,
 'answers',case when (s.review_settings->>'show_answers')::boolean then (select jsonb_agg(jsonb_build_object('question_id',q->>'id','prompt',q->>'prompt','prompt_rich',q->'prompt_rich','stem_media',q->'stem_media','solution_media',case when (s.review_settings->>'show_explanations')::boolean then q->'solution_media' end,'explanation_rich',case when (s.review_settings->>'show_explanations')::boolean then q->'explanation_rich' end,'options',q->'options','stem_image_path',q->>'stem_image_path','selected_option_ids',coalesce(to_jsonb(aa.selected_option_ids),'[]'),'correct_option_ids',q->'correct_ids','marks_awarded',coalesce(aa.marks_awarded,0),'explanation',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation' end,'explanation_image_path',case when (s.review_settings->>'show_explanations')::boolean then q->>'explanation_image_path' end)) from jsonb_array_elements(s.questions) q left join public.attempt_answers aa on aa.attempt_id=a.id and aa.question_id=(q->>'id')::uuid) else '[]'::jsonb end)
 from public.test_attempts a join private.attempt_snapshots s on s.attempt_id=a.id where a.id=target_attempt and a.student_id=auth.uid() and coalesce(private.active_role(),'')='student' and a.status<>'in_progress' and private.attempt_access(a.test_id)
$$;
revoke all on function public.get_test_review(uuid) from public,anon,service_role;
grant execute on function public.get_test_review(uuid) to authenticated;

-- Reuse the existing selection_rules JSON; no new tables or public grants.
create function private.test_scope_matches(q public.questions,t public.tests)
returns boolean language sql stable set search_path='' as $$
 select q.status='active' and q.type<>'match_following' and q.exam_id=t.exam_id
 and (q.program_id is null or q.program_id=t.program_id)
 and (t.subject_id is null or q.subject_id=t.subject_id)
 and (t.chapter_id is null or q.chapter_id=t.chapter_id)
 and (t.topic_id is null or q.topic_id=t.topic_id)
 and (not (coalesce(t.selection_rules,'{}') ? 'scopes') or exists(
   select 1 from jsonb_array_elements(t.selection_rules->'scopes') s
   where q.subject_id=(s->>'subject_id')::uuid
   and (jsonb_array_length(s->'chapter_ids')=0 or exists(
     select 1 from jsonb_array_elements_text(s->'chapter_ids') c where q.chapter_id=c::uuid))))
$$;
revoke all on function private.test_scope_matches(public.questions,public.tests) from public,anon,authenticated;

create function private.validate_test_scopes(t public.tests)
returns void language plpgsql set search_path='' as $$
declare s jsonb; su uuid; chapters uuid[];
begin
 if not (coalesce(t.selection_rules,'{}') ? 'scopes') then return; end if;
 if t.subject_id is not null or t.chapter_id is not null or t.topic_id is not null
 or jsonb_typeof(t.selection_rules->'scopes') is distinct from 'array'
 or jsonb_array_length(t.selection_rules->'scopes')=0 then raise exception 'Invalid multiple-subject scope'; end if;
 if (select count(*)<>count(distinct s->>'subject_id') from jsonb_array_elements(t.selection_rules->'scopes') s) then raise exception 'Duplicate subject scope'; end if;
 for s in select * from jsonb_array_elements(t.selection_rules->'scopes') loop
  su:=(s->>'subject_id')::uuid;
  if su is null or not public.teacher_has_assignment(t.exam_id,t.program_id,su,'tests') then raise exception 'Subject scope permission denied'; end if;
  perform private.validate_taxonomy(t.exam_id,t.program_id,su,null,null);
  if jsonb_typeof(s->'chapter_ids') is distinct from 'array' then raise exception 'Invalid section scope'; end if;
  select array_agg(c::uuid) into chapters from jsonb_array_elements_text(s->'chapter_ids') c;
  if exists(select 1 from unnest(chapters) c where not exists(select 1 from public.chapters x where x.id=c and x.subject_id=su and (x.program_id is null or x.program_id=t.program_id))) then raise exception 'Section outside subject scope'; end if;
  if t.selection_mode='generated' and (coalesce(s->>'count','') !~ '^[1-9][0-9]*$') then raise exception 'Each subject needs a positive integer question count'; end if;
 end loop;
end $$;
revoke all on function private.validate_test_scopes(public.tests) from public,anon,authenticated;

create function private.draw_test_questions(t public.tests)
returns uuid[] language plpgsql set search_path='' as $$
declare ids uuid[]:='{}'; sample uuid[]; s jsonb; amount integer;
begin
 if coalesce(t.selection_rules,'{}') ? 'scopes' then
  for s in select * from jsonb_array_elements(t.selection_rules->'scopes') loop
   amount:=(s->>'count')::integer;
   if amount is null or amount<1 then raise exception 'Invalid subject question count'; end if;
   select array_agg(id) into sample from (
    select q.id from public.questions q where private.test_scope_matches(q,t)
    and q.subject_id=(s->>'subject_id')::uuid
    and (coalesce(t.selection_rules->>'difficulty','')='' or q.difficulty=t.selection_rules->>'difficulty')
    order by random() limit amount) q;
   if coalesce(cardinality(sample),0)<>amount then raise exception 'Not enough active questions in subject scope'; end if;
   ids:=ids||sample;
  end loop;
 else
  select array_agg(id) into ids from (
   select q.id from public.questions q where private.test_scope_matches(q,t)
   and (coalesce(t.selection_rules->>'difficulty','')='' or q.difficulty=t.selection_rules->>'difficulty')
   order by random() limit t.question_count) q;
 end if;
 if t.randomize_questions then select array_agg(id order by random()) into ids from unnest(ids) id; end if;
 return ids;
end $$;
revoke all on function private.draw_test_questions(public.tests) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.core_save_test(value jsonb, question_ids uuid[], batch_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tests; old public.tests; selected uuid[]; total numeric;
begin
 t:=jsonb_populate_record(null::public.tests,value); t.id:=coalesce(t.id,gen_random_uuid());
 select * into old from public.tests where id=t.id for update;
 if not public.teacher_has_assignment(t.exam_id,t.program_id,t.subject_id,'tests') or not private.teacher_batches(batch_ids) or (old.id is not null and not private.test_access(old.id,true)) then raise exception 'Test permission denied'; end if;
 perform private.validate_taxonomy(t.exam_id,t.program_id,t.subject_id,t.chapter_id,t.topic_id);
 if t.program_id is null or t.exam_id is null or length(btrim(coalesce(t.title,'')))=0 or t.duration_minutes is null or t.duration_minutes<1 or t.max_attempts is null or t.max_attempts<1 or t.default_negative_marks<0 then raise exception 'Invalid test configuration'; end if;
 if t.available_from is not null and t.available_until<=t.available_from then raise exception 'Availability end must follow start'; end if;
 if exists(select 1 from unnest(batch_ids) b where not exists(select 1 from public.batches x where x.id=b and x.program_id=t.program_id)) then raise exception 'Batch belongs to another program'; end if;
 perform private.validate_test_scopes(t);
 if t.selection_mode='generated' and coalesce(t.selection_rules,'{}') ? 'scopes' then
 select sum((s->>'count')::integer) into t.question_count from jsonb_array_elements(t.selection_rules->'scopes') s;
 end if;
 if t.selection_mode='generated' then
 selected:=private.draw_test_questions(t);
 if coalesce(cardinality(selected),0)<>t.question_count then raise exception 'Not enough active questions match this rule'; end if;
 else selected:=question_ids; end if;
 if coalesce(cardinality(selected),0)=0 or cardinality(selected)<>(select count(distinct x) from unnest(selected) x) then raise exception 'Select distinct active questions'; end if;
 if exists(select 1 from unnest(selected) x where not exists(select 1 from public.questions q where q.id=x and private.test_scope_matches(q,t))) then raise exception 'Question is draft, unavailable or outside this taxonomy'; end if;
 select sum(marks) into total from public.questions where id=any(selected);
 insert into public.tests(id,slug,title,type,exam_id,program_id,subject_id,chapter_id,topic_id,question_count,duration_minutes,total_marks,default_negative_marks,max_attempts,available_from,available_until,randomize_questions,randomize_options,show_results,show_answers,show_explanations,selection_mode,selection_rules,status)
 values(t.id,coalesce(old.slug,'test-'||t.id),t.title,t.type,t.exam_id,t.program_id,t.subject_id,t.chapter_id,t.topic_id,cardinality(selected),t.duration_minutes,total,t.default_negative_marks,t.max_attempts,t.available_from,t.available_until,coalesce(t.randomize_questions,false),coalesce(t.randomize_options,false),coalesce(t.show_results,true),coalesce(t.show_answers,true),coalesce(t.show_explanations,true),coalesce(t.selection_mode,'manual'),coalesce(t.selection_rules,'{}'),coalesce(t.status,'draft'))
 on conflict(id) do update set title=excluded.title,type=excluded.type,exam_id=excluded.exam_id,program_id=excluded.program_id,subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_id=excluded.topic_id,question_count=excluded.question_count,duration_minutes=excluded.duration_minutes,total_marks=excluded.total_marks,default_negative_marks=excluded.default_negative_marks,max_attempts=excluded.max_attempts,available_from=excluded.available_from,available_until=excluded.available_until,randomize_questions=excluded.randomize_questions,randomize_options=excluded.randomize_options,show_results=excluded.show_results,show_answers=excluded.show_answers,show_explanations=excluded.show_explanations,selection_mode=excluded.selection_mode,selection_rules=excluded.selection_rules,status=excluded.status,updated_at=now();
 delete from public.test_questions where test_id=t.id; delete from public.test_batches where test_id=t.id;
 insert into public.test_questions(test_id,question_id,display_order) select t.id,x,ord-1 from unnest(selected) with ordinality a(x,ord);
 insert into public.test_batches(test_id,batch_id) select t.id,x from unnest(batch_ids) x;
 return t.id;
end $function$
;
CREATE OR REPLACE FUNCTION public.start_test_attempt(target_test uuid)
 RETURNS test_attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tests; a public.test_attempts; ids uuid[]; snap jsonb;
begin
 if coalesce(private.active_role(),'') is distinct from 'student' or not private.test_access(target_test) then raise exception 'Test access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||target_test::text,0));
 select * into t from public.tests where id=target_test;
 select * into a from public.test_attempts where test_id=target_test and student_id=auth.uid() and status='in_progress' for update;
 if a.id is not null then
 if a.expires_at>now() then return a; end if;
 perform public.submit_test_attempt(a.id);
 end if;
 if (select count(*) from public.test_attempts where test_id=target_test and student_id=auth.uid())>=t.max_attempts then raise exception 'Attempt limit reached'; end if;
 if t.selection_mode='generated' then
 ids:=private.draw_test_questions(t);
 else select array_agg(q.id order by case when t.randomize_questions then random() else tq.display_order end) into ids from public.test_questions tq join public.questions q on q.id=tq.question_id where tq.test_id=t.id and q.status='active'; end if;
 if coalesce(cardinality(ids),0)<>t.question_count then raise exception 'Test bank is no longer ready'; end if;
 snap:=private.snapshot_questions(ids,t.default_negative_marks);
 insert into public.test_attempts(test_id,student_id,question_order,expires_at,option_order) values(t.id,auth.uid(),ids,least(now()+make_interval(mins=>t.duration_minutes),coalesce(t.available_until,'infinity')),
 (select jsonb_object_agg(q->>'id',(select jsonb_agg(o->>'id' order by case when t.randomize_options then random() else ord end) from jsonb_array_elements(q->'options') with ordinality x(o,ord))) from jsonb_array_elements(snap) q)) returning * into a;
 insert into private.attempt_snapshots values(a.id,snap,jsonb_build_object('show_results',t.show_results,'show_answers',t.show_answers,'show_explanations',t.show_explanations),(select sum((q->>'marks')::numeric) from jsonb_array_elements(snap) q));
 return a;
end $function$
;

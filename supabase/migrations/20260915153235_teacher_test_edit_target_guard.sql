-- Editing an authorized Test must keep its new academic scope within the Teacher's assignment.
-- Keep the existing original-Test access check and all publication validation.
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
 if not public.is_admin() and not public.teacher_has_assignment(t.exam_id,t.program_id,t.subject_id,'tests') then raise exception 'Test permission denied'; end if;
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

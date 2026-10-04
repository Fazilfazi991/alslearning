-- Keep score visibility consistent with canonical attempt history. No eligibility changes.
create or replace function public.core_student_test_catalog()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'slug',x.slug,'title',x.title,'type',x.type,'duration_minutes',x.duration_minutes,'question_count',x.question_count,'total_marks',x.total_marks,'available_from',x.available_from,'available_until',x.available_until,'program_id',x.program_id,'subjects',x.subjects,'attempts_used',x.attempts_used,'max_attempts',x.max_attempts,'last_score',x.last_score,'state',x.state) order by case x.state when 'in_progress' then 0 when 'available' then 1 when 'upcoming' then 2 when 'completed' then 3 else 4 end,x.available_from nulls first,x.title),'[]') from (
  select t.*,
   (select coalesce(jsonb_agg(distinct s.name),'[]') from public.subjects s where s.id=t.subject_id or exists(select 1 from jsonb_array_elements(coalesce(t.selection_rules->'scopes','[]')) r where r->>'subject_id'=s.id::text)) subjects,
   (select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid()) attempts_used,
   (select case when (s.review_settings->>'show_results')::boolean then a.score else null end from public.test_attempts a join private.attempt_snapshots s on s.attempt_id=a.id where a.test_id=t.id and a.student_id=auth.uid() and a.status<>'in_progress' order by a.started_at desc limit 1) last_score,
   case when exists(select 1 from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid() and a.status='in_progress') then 'in_progress'
    when t.available_from is not null and t.available_from>now() then 'upcoming'
    when t.available_until is not null and t.available_until<=now() then 'closed'
    when (select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid())>0 and t.max_attempts is not null and (select count(*) from public.test_attempts a where a.test_id=t.id and a.student_id=auth.uid())>=t.max_attempts then 'completed'
    else 'available' end state
  from public.tests t where t.status='active' and coalesce(private.active_role(),'')='student' and private.attempt_access(t.id)
 ) x
$$;

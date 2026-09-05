create or replace function public.submit_test_attempt(target_attempt uuid)
returns numeric language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); total numeric(8,2);
begin
  if uid is null or not exists(select 1 from public.test_attempts a where a.id=target_attempt and a.student_id=uid and a.status='in_progress') then raise exception 'Attempt is unavailable'; end if;
  with base as (
    select aa.attempt_id,aa.question_id,
      (select coalesce(array_agg(o.id order by o.id),'{}'::uuid[]) from public.question_options o where o.question_id=aa.question_id and o.is_correct)
      = (select coalesce(array_agg(x order by x),'{}'::uuid[]) from (select distinct unnest(aa.selected_option_ids)x) chosen) as correct,
      coalesce(tq.marks_override,q.marks) as positive_marks,
      coalesce(tq.negative_marks_override,t.default_negative_marks,q.negative_marks) as negative_marks
    from public.attempt_answers aa
    join public.test_attempts a on a.id=aa.attempt_id
    join public.tests t on t.id=a.test_id
    join public.test_questions tq on tq.test_id=t.id and tq.question_id=aa.question_id
    join public.questions q on q.id=aa.question_id
    where aa.attempt_id=target_attempt and a.student_id=uid
  )
  update public.attempt_answers aa set is_correct=base.correct,marks_awarded=case when base.correct then base.positive_marks else -base.negative_marks end
  from base where aa.attempt_id=base.attempt_id and aa.question_id=base.question_id;
  select coalesce(sum(marks_awarded),0) into total from public.attempt_answers where attempt_id=target_attempt;
  update public.test_attempts set score=total,status='submitted',submitted_at=now() where id=target_attempt and student_id=uid;
  return total;
end $$;
revoke all on function public.submit_test_attempt(uuid) from public,anon;
grant execute on function public.submit_test_attempt(uuid) to authenticated;

create table public.question_answer_keys(
  question_id uuid not null references public.questions(id) on delete cascade,
  option_id uuid not null references public.question_options(id) on delete cascade,
  primary key(question_id,option_id)
);
insert into public.question_answer_keys(question_id,option_id) select question_id,id from public.question_options where is_correct;
alter table public.question_answer_keys enable row level security;
grant select,insert,delete on public.question_answer_keys to authenticated;
create policy answer_keys_staff_read on public.question_answer_keys for select to authenticated using(exists(select 1 from public.questions q where q.id=question_id and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions')));
create policy answer_keys_staff_insert on public.question_answer_keys for insert to authenticated with check(exists(select 1 from public.questions q where q.id=question_id and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions')));
create policy answer_keys_staff_delete on public.question_answer_keys for delete to authenticated using(exists(select 1 from public.questions q where q.id=question_id and public.teacher_has_assignment(q.exam_id,q.program_id,q.subject_id,'questions')));
alter table public.question_options drop column is_correct;

create or replace function public.submit_test_attempt(target_attempt uuid)
returns numeric language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); total numeric(8,2);
begin
  if uid is null or not exists(select 1 from public.test_attempts a where a.id=target_attempt and a.student_id=uid and a.status='in_progress') then raise exception 'Attempt is unavailable'; end if;
  with base as (
    select aa.attempt_id,aa.question_id,
      (select coalesce(array_agg(k.option_id order by k.option_id),'{}'::uuid[]) from public.question_answer_keys k where k.question_id=aa.question_id)
      = (select coalesce(array_agg(x order by x),'{}'::uuid[]) from (select distinct unnest(aa.selected_option_ids)x) chosen) as correct,
      coalesce(tq.marks_override,q.marks) positive_marks,coalesce(tq.negative_marks_override,t.default_negative_marks,q.negative_marks) negative_marks
    from public.attempt_answers aa join public.test_attempts a on a.id=aa.attempt_id join public.tests t on t.id=a.test_id join public.test_questions tq on tq.test_id=t.id and tq.question_id=aa.question_id join public.questions q on q.id=aa.question_id
    where aa.attempt_id=target_attempt and a.student_id=uid
  ) update public.attempt_answers aa set is_correct=base.correct,marks_awarded=case when base.correct then base.positive_marks else -base.negative_marks end from base where aa.attempt_id=base.attempt_id and aa.question_id=base.question_id;
  select coalesce(sum(marks_awarded),0) into total from public.attempt_answers where attempt_id=target_attempt;
  update public.test_attempts set score=total,status='submitted',submitted_at=now() where id=target_attempt and student_id=uid;return total;
end $$;

create or replace function public.submit_checkpoint_response(target_checkpoint uuid, option_ids uuid[])
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); qid uuid; correct boolean;
begin
  if uid is null or not exists(select 1 from public.video_checkpoints vc join public.learning_content c on c.id=vc.video_id where vc.id=target_checkpoint and c.status='active' and public.has_program_access(c.program_id)) then raise exception 'Checkpoint is unavailable'; end if;
  select question_id into qid from public.video_checkpoints where id=target_checkpoint;
  select coalesce(array_agg(option_id order by option_id),'{}'::uuid[])=(select coalesce(array_agg(x order by x),'{}'::uuid[]) from (select distinct unnest(option_ids)x) chosen) into correct from public.question_answer_keys where question_id=qid;
  insert into public.checkpoint_responses(checkpoint_id,student_id,selected_option_ids,is_correct) values(target_checkpoint,uid,option_ids,correct) on conflict(checkpoint_id,student_id) do update set selected_option_ids=excluded.selected_option_ids,is_correct=excluded.is_correct,attempt_count=public.checkpoint_responses.attempt_count+1,answered_at=now();return correct;
end $$;

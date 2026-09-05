-- Launch-readiness additions: server-authoritative attempts, real notifications,
-- and a single controlled participant-insert path.

alter table public.tests
  add column if not exists show_results boolean not null default true;

alter table public.test_attempts
  add column if not exists expires_at timestamptz,
  add column if not exists correct_count integer,
  add column if not exists incorrect_count integer,
  add column if not exists unanswered_count integer,
  add column if not exists negative_marks_total numeric(8,2);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('upcoming_class','recorded_class','material','test','system')),
  title text not null check(length(btrim(title)) between 1 and 180),
  body text not null default '',
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_created_idx on public.notifications(recipient_id,created_at desc);
alter table public.notifications enable row level security;
revoke all on table public.notifications from anon,authenticated;
grant select,update,delete on table public.notifications to authenticated;
create policy notifications_own_read on public.notifications for select to authenticated
  using(recipient_id=(select auth.uid()) or public.is_admin());
create policy notifications_own_update on public.notifications for update to authenticated
  using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create policy notifications_admin_delete on public.notifications for delete to authenticated
  using(public.is_admin());

-- Presence creation is only available through set_live_presence(), whose body
-- verifies auth.uid() and can_join_live(). Removing this direct policy also
-- removes the overlapping permissive INSERT advisor warning.
drop policy if exists live_participants_self_insert on public.live_participants;

create or replace function public.start_test_attempt(target_test uuid)
returns public.test_attempts language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); chosen public.tests; result public.test_attempts; qids uuid[];
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into chosen from public.tests t
  where t.id=target_test and t.status='active' and public.has_program_access(t.program_id)
    and (t.available_from is null or t.available_from<=now())
    and (t.available_until is null or t.available_until>now());
  if chosen.id is null then raise exception 'Test is unavailable'; end if;
  select * into result from public.test_attempts a
    where a.test_id=target_test and a.student_id=uid and a.status='in_progress'
    order by a.started_at desc limit 1;
  if result.id is not null then return result; end if;
  if chosen.max_attempts is not null and
    (select count(*) from public.test_attempts a where a.test_id=target_test and a.student_id=uid)>=chosen.max_attempts
  then raise exception 'Attempt limit reached'; end if;
  select coalesce(array_agg(question_id order by case when chosen.randomize_questions then random() else display_order end),'{}'::uuid[])
    into qids from public.test_questions where test_id=target_test;
  if cardinality(qids)=0 then raise exception 'Test has no questions'; end if;
  insert into public.test_attempts(test_id,student_id,question_order,expires_at)
    values(target_test,uid,qids,now()+make_interval(mins=>chosen.duration_minutes)) returning * into result;
  return result;
end $$;
revoke all on function public.start_test_attempt(uuid) from public,anon;
grant execute on function public.start_test_attempt(uuid) to authenticated;

drop policy if exists answers_own_insert on public.attempt_answers;
drop policy if exists answers_own_update on public.attempt_answers;
create or replace function public.save_attempt_answer(target_attempt uuid,target_question uuid,option_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); a public.test_attempts;
begin
  select * into a from public.test_attempts where id=target_attempt and student_id=uid and status='in_progress';
  if a.id is null then raise exception 'Attempt is unavailable'; end if;
  if a.expires_at is not null and now()>a.expires_at then raise exception 'Attempt has expired'; end if;
  if not target_question=any(a.question_order) then raise exception 'Question is not part of this attempt'; end if;
  if exists(select 1 from unnest(option_ids) oid where not exists(select 1 from public.question_options o where o.id=oid and o.question_id=target_question))
    then raise exception 'Invalid answer option'; end if;
  insert into public.attempt_answers(attempt_id,question_id,selected_option_ids,answered_at)
    values(target_attempt,target_question,option_ids,now())
    on conflict(attempt_id,question_id) do update set selected_option_ids=excluded.selected_option_ids,answered_at=now(),is_correct=null,marks_awarded=null;
end $$;
revoke all on function public.save_attempt_answer(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.save_attempt_answer(uuid,uuid,uuid[]) to authenticated;

create or replace function public.submit_test_attempt(target_attempt uuid)
returns numeric language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); total numeric(8,2); stats record;
begin
  if uid is null or not exists(select 1 from public.test_attempts a where a.id=target_attempt and a.student_id=uid and a.status='in_progress')
    then raise exception 'Attempt is unavailable'; end if;
  with base as (
    select aa.attempt_id,aa.question_id,
      (select coalesce(array_agg(k.option_id order by k.option_id),'{}'::uuid[]) from public.question_answer_keys k where k.question_id=aa.question_id)
      = (select coalesce(array_agg(x order by x),'{}'::uuid[]) from (select distinct unnest(aa.selected_option_ids)x) chosen) as correct,
      coalesce(tq.marks_override,q.marks) positive_marks,
      coalesce(tq.negative_marks_override,t.default_negative_marks,q.negative_marks) negative_marks
    from public.attempt_answers aa join public.test_attempts a on a.id=aa.attempt_id
    join public.tests t on t.id=a.test_id join public.test_questions tq on tq.test_id=t.id and tq.question_id=aa.question_id
    join public.questions q on q.id=aa.question_id where aa.attempt_id=target_attempt and a.student_id=uid
  ) update public.attempt_answers aa set is_correct=base.correct,
    marks_awarded=case when base.correct then base.positive_marks else -base.negative_marks end
    from base where aa.attempt_id=base.attempt_id and aa.question_id=base.question_id;
  select coalesce(sum(aa.marks_awarded),0) as score,
    count(*) filter(where aa.is_correct) as correct_count,
    count(*) filter(where not aa.is_correct) as incorrect_count,
    greatest(0,cardinality(a.question_order)-count(aa.question_id)) as unanswered_count,
    coalesce(-sum(aa.marks_awarded) filter(where aa.marks_awarded<0),0) as negative_total
    into stats from public.test_attempts a left join public.attempt_answers aa on aa.attempt_id=a.id where a.id=target_attempt group by a.question_order;
  total:=stats.score;
  update public.test_attempts set score=total,status='submitted',submitted_at=now(),correct_count=stats.correct_count,
    incorrect_count=stats.incorrect_count,unanswered_count=stats.unanswered_count,negative_marks_total=stats.negative_total where id=target_attempt and student_id=uid;
  return total;
end $$;
revoke all on function public.submit_test_attempt(uuid) from public,anon;
grant execute on function public.submit_test_attempt(uuid) to authenticated;

comment on function public.start_test_attempt(uuid) is 'SECURITY DEFINER protects authoritative start/expiry and validates authenticated enrollment, availability and attempt limits. authenticated only.';
comment on function public.submit_test_attempt(uuid) is 'SECURITY DEFINER reads protected answer keys; validates attempt ownership and exposes only aggregate scoring. authenticated only.';
comment on function public.save_attempt_answer(uuid,uuid,uuid[]) is 'SECURITY DEFINER enforces attempt ownership, membership and server expiry before persisting an answer. authenticated only.';

create or replace function public.get_test_review(target_attempt uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when a.id is null or not t.show_results then null else jsonb_build_object(
    'score',a.score,'correct',a.correct_count,'incorrect',a.incorrect_count,'unanswered',a.unanswered_count,
    'negative_marks',a.negative_marks_total,'submitted_at',a.submitted_at,
    'answers',case when t.show_answers then coalesce((select jsonb_agg(jsonb_build_object(
      'question_id',q.id,'prompt',q.prompt,'selected_option_ids',coalesce(aa.selected_option_ids,'{}'::uuid[]),
      'correct_option_ids',(select coalesce(jsonb_agg(k.option_id),'[]'::jsonb) from public.question_answer_keys k where k.question_id=q.id),
      'is_correct',aa.is_correct,'marks_awarded',aa.marks_awarded,
      'explanation',case when t.show_explanations then q.explanation else null end
    ) order by tq.display_order) from public.test_questions tq join public.questions q on q.id=tq.question_id left join public.attempt_answers aa on aa.attempt_id=a.id and aa.question_id=q.id where tq.test_id=t.id),'[]'::jsonb) else '[]'::jsonb end)
  end from public.test_attempts a join public.tests t on t.id=a.test_id
  where a.id=target_attempt and a.student_id=(select auth.uid()) and a.status in ('submitted','graded')
$$;
revoke all on function public.get_test_review(uuid) from public,anon;
grant execute on function public.get_test_review(uuid) to authenticated;
comment on function public.get_test_review(uuid) is 'SECURITY DEFINER exposes protected keys only to the owning student after submission and only when test review settings permit it. authenticated only.';

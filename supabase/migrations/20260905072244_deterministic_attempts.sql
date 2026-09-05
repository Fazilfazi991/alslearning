alter table public.test_attempts add column option_order jsonb not null default '{}'::jsonb;

create or replace function public.start_test_attempt(target_test uuid)
returns public.test_attempts language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); chosen public.tests; result public.test_attempts; qids uuid[]; options jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into chosen from public.tests t where t.id=target_test and t.status='active' and public.has_program_access(t.program_id)
    and (t.available_from is null or t.available_from<=now()) and (t.available_until is null or t.available_until>now());
  if chosen.id is null then raise exception 'Test is unavailable'; end if;
  select * into result from public.test_attempts a where a.test_id=target_test and a.student_id=uid and a.status='in_progress' order by a.started_at desc limit 1;
  if result.id is not null then return result; end if;
  if chosen.max_attempts is not null and (select count(*) from public.test_attempts a where a.test_id=target_test and a.student_id=uid)>=chosen.max_attempts then raise exception 'Attempt limit reached'; end if;
  select coalesce(array_agg(question_id order by case when chosen.randomize_questions then random() else display_order end),'{}'::uuid[]) into qids from public.test_questions where test_id=target_test;
  if cardinality(qids)=0 then raise exception 'Test has no questions'; end if;
  select coalesce(jsonb_object_agg(q.id,(select jsonb_agg(o.id order by case when chosen.randomize_options then random() else o.display_order end) from public.question_options o where o.question_id=q.id)),'{}'::jsonb)
    into options from public.questions q where q.id=any(qids);
  insert into public.test_attempts(test_id,student_id,question_order,option_order,expires_at) values(target_test,uid,qids,options,now()+make_interval(mins=>chosen.duration_minutes)) returning * into result;
  return result;
end $$;

create or replace function public.finalize_expired_test_attempts(target_test uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); row record; finalized integer:=0;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  for row in select id from public.test_attempts where student_id=uid and test_id=target_test and status='in_progress' and expires_at<=now() loop
    perform public.submit_test_attempt(row.id); finalized:=finalized+1;
  end loop;
  return finalized;
end $$;
revoke all on function public.start_test_attempt(uuid),public.finalize_expired_test_attempts(uuid) from public,anon;
grant execute on function public.start_test_attempt(uuid),public.finalize_expired_test_attempts(uuid) to authenticated;
comment on function public.finalize_expired_test_attempts(uuid) is 'Lazy server-side expiry finalization for the authenticated student when a test is accessed; scoring remains answer-key protected.';

create index if not exists attempt_student_test_status_expiry_idx on public.test_attempts(student_id,test_id,status,expires_at);
create index if not exists live_messages_session_created_idx on public.live_messages(session_id,created_at);
create index if not exists live_responses_poll_idx on public.live_question_responses(live_question_id,responded_at);

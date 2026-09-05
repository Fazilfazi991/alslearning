alter table public.live_sessions
  alter column student_audio_enabled set default false,
  alter column student_video_enabled set default false;

alter table public.live_participants
  add column if not exists audio_publish_allowed boolean not null default false,
  add column if not exists screen_publish_allowed boolean not null default false,
  add column if not exists presence_started_at timestamptz,
  add column if not exists attendance_seconds bigint not null default 0 check(attendance_seconds >= 0);

create table public.live_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.live_attachments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  object_provider text not null check(object_provider in ('supabase','r2')),
  bucket text not null,
  object_key text not null,
  file_name text not null,
  mime_type text,
  byte_size bigint check(byte_size is null or byte_size >= 0),
  created_at timestamptz not null default now(),
  unique(object_provider,bucket,object_key)
);

alter table public.live_messages enable row level security;
alter table public.live_attachments enable row level security;
grant select,insert,delete on public.live_messages,public.live_attachments to authenticated;

create or replace function public.can_join_live(target_session uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(
    select 1 from public.live_sessions s
    where s.id=target_session and (
      public.is_admin() or s.faculty_id=(select auth.uid()) or exists(
        select 1 from public.enrollments e
        where e.student_id=(select auth.uid()) and e.batch_id=s.batch_id and e.status='active'
          and (e.access_starts_at is null or e.access_starts_at <= now())
          and (e.access_expires_at is null or e.access_expires_at > now())
      )
    )
  )
$$;

create policy live_messages_member_read on public.live_messages for select to authenticated using(public.can_join_live(session_id));
create policy live_messages_member_insert on public.live_messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.can_join_live(session_id));
create policy live_messages_owner_delete on public.live_messages for delete to authenticated using(sender_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));
create policy live_attachments_member_read on public.live_attachments for select to authenticated using(public.can_join_live(session_id));
create policy live_attachments_member_insert on public.live_attachments for insert to authenticated with check(uploader_id=(select auth.uid()) and public.can_join_live(session_id));
create policy live_attachments_owner_delete on public.live_attachments for delete to authenticated using(uploader_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));

create policy live_participants_self_insert on public.live_participants for insert to authenticated with check(user_id=(select auth.uid()) and public.can_join_live(session_id) and presenter=false and audio_publish_allowed=false and screen_publish_allowed=false);

create or replace function public.set_live_presence(target_session uuid, joined boolean)
returns public.live_participants language plpgsql security invoker set search_path='' as $$
declare result public.live_participants;
begin
  if not public.can_join_live(target_session) then raise exception 'Not eligible for this live session'; end if;
  insert into public.live_participants(session_id,user_id,joined_at,presence_started_at,left_at)
  values(target_session,(select auth.uid()),case when joined then now() end,case when joined then now() end,null)
  on conflict(session_id,user_id) do update set
    joined_at=coalesce(public.live_participants.joined_at,case when joined then now() end),
    presence_started_at=case when joined then coalesce(public.live_participants.presence_started_at,now()) else null end,
    left_at=case when joined then null else now() end,
    attendance_seconds=public.live_participants.attendance_seconds + case when not joined and public.live_participants.presence_started_at is not null then greatest(0,extract(epoch from now()-public.live_participants.presence_started_at)::bigint) else 0 end
  returning * into result;
  return result;
end $$;
revoke all on function public.set_live_presence(uuid,boolean) from public,anon;
grant execute on function public.set_live_presence(uuid,boolean) to authenticated;

create or replace function public.set_raised_hand(target_session uuid, raised boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.can_join_live(target_session) then raise exception 'Not eligible for this live session'; end if;
  update public.live_participants set raised_hand=raised where session_id=target_session and user_id=(select auth.uid());
end $$;
revoke all on function public.set_raised_hand(uuid,boolean) from public,anon;
grant execute on function public.set_raised_hand(uuid,boolean) to authenticated;

create or replace function public.submit_test_attempt(target_attempt uuid)
returns numeric language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); total numeric(8,2);
begin
  if uid is null or not exists(select 1 from public.test_attempts a where a.id=target_attempt and a.student_id=uid and a.status='in_progress') then raise exception 'Attempt is unavailable'; end if;
  update public.attempt_answers aa set
    is_correct=(select coalesce(array_agg(o.id order by o.id) filter(where o.is_correct),'{}'::uuid[]) = coalesce(array_agg(x order by x) filter(where x is not null),'{}'::uuid[]) from public.question_options o left join unnest(aa.selected_option_ids) x on x=o.id where o.question_id=aa.question_id),
    marks_awarded=case when (select coalesce(array_agg(o.id order by o.id) filter(where o.is_correct),'{}'::uuid[]) = coalesce(array_agg(x order by x) filter(where x is not null),'{}'::uuid[]) from public.question_options o left join unnest(aa.selected_option_ids) x on x=o.id where o.question_id=aa.question_id)
      then coalesce(tq.marks_override,q.marks) else -coalesce(tq.negative_marks_override,t.default_negative_marks,q.negative_marks) end
  from public.test_attempts a join public.tests t on t.id=a.test_id join public.test_questions tq on tq.test_id=t.id and tq.question_id=aa.question_id join public.questions q on q.id=aa.question_id
  where aa.attempt_id=target_attempt and a.id=target_attempt and a.student_id=uid;
  select coalesce(sum(marks_awarded),0) into total from public.attempt_answers where attempt_id=target_attempt;
  update public.test_attempts set score=total,status='submitted',submitted_at=now() where id=target_attempt and student_id=uid;
  return total;
end $$;
revoke all on function public.submit_test_attempt(uuid) from public,anon;
grant execute on function public.submit_test_attempt(uuid) to authenticated;

create or replace function public.submit_checkpoint_response(target_checkpoint uuid, option_ids uuid[])
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid=(select auth.uid()); correct boolean;
begin
  if uid is null or not exists(select 1 from public.video_checkpoints vc join public.learning_content c on c.id=vc.video_id where vc.id=target_checkpoint and c.status='active' and public.has_program_access(c.program_id)) then raise exception 'Checkpoint is unavailable'; end if;
  select coalesce(array_agg(id order by id) filter(where is_correct),'{}'::uuid[])=coalesce((select array_agg(x order by x) from unnest(option_ids)x),'{}'::uuid[]) into correct from public.question_options where question_id=(select question_id from public.video_checkpoints where id=target_checkpoint);
  insert into public.checkpoint_responses(checkpoint_id,student_id,selected_option_ids,is_correct)
  values(target_checkpoint,uid,option_ids,correct)
  on conflict(checkpoint_id,student_id) do update set selected_option_ids=excluded.selected_option_ids,is_correct=excluded.is_correct,attempt_count=public.checkpoint_responses.attempt_count+1,answered_at=now();
  return correct;
end $$;
revoke all on function public.submit_checkpoint_response(uuid,uuid[]) from public,anon;
grant execute on function public.submit_checkpoint_response(uuid,uuid[]) to authenticated;

-- Native ALS classroom state for Cloudflare Realtime SFU and private R2.
-- This migration intentionally keeps live_sessions.faculty_id linked to the
-- authenticated profiles table. faculty_members remains a directory only.

alter table public.live_sessions
  add column if not exists join_opens_at timestamptz,
  add column if not exists join_closes_at timestamptz,
  add column if not exists max_receivers integer check (max_receivers is null or max_receivers between 1 and 500),
  add column if not exists ended_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.live_participants
  add column if not exists heartbeat_at timestamptz,
  add column if not exists connection_lease_expires_at timestamptz,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null;

create table public.live_media_connections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_session_id text not null unique,
  status text not null default 'active' check (status in ('active','reconnecting','closed','stale','failed')),
  last_seen_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index live_media_connections_one_active_user
  on public.live_media_connections(session_id,user_id)
  where status in ('active','reconnecting');
create index live_media_connections_class_status
  on public.live_media_connections(session_id,status,last_seen_at);

create table public.live_published_tracks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  connection_id uuid not null references public.live_media_connections(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('microphone','camera','screen')),
  provider_track_name text not null,
  provider_mid text not null,
  status text not null default 'active' check (status in ('active','closing','closed','failed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique(connection_id,provider_track_name)
);
create unique index live_published_tracks_one_active_kind
  on public.live_published_tracks(connection_id,kind)
  where status in ('active','closing');
create index live_published_tracks_class_status
  on public.live_published_tracks(session_id,status,kind);

create table public.live_track_subscriptions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  connection_id uuid not null references public.live_media_connections(id) on delete cascade,
  track_id uuid not null references public.live_published_tracks(id) on delete cascade,
  provider_mid text,
  status text not null default 'active' check (status in ('active','closed','failed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique(connection_id,track_id)
);

create table public.live_attendance_intervals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid not null references public.live_media_connections(id) on delete cascade,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text check (ended_reason is null or ended_reason in ('left','ended','replaced','stale','failed')),
  check (ended_at is null or ended_at >= started_at)
);
create unique index live_attendance_one_open_connection
  on public.live_attendance_intervals(connection_id) where ended_at is null;
create index live_attendance_class_user
  on public.live_attendance_intervals(session_id,user_id,started_at);

alter table public.class_recordings
  add column if not exists owner_id uuid references public.profiles(id) on delete restrict,
  add column if not exists mime_type text,
  add column if not exists total_bytes bigint not null default 0 check (total_bytes >= 0),
  add column if not exists duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds > 0),
  add column if not exists verified_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.profiles(id) on delete set null,
  add column if not exists interrupted_at timestamptz;
create unique index class_recordings_one_active_capture
  on public.class_recordings(session_id)
  where status in ('recording','uploading');

create table public.live_recording_segments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.class_recordings(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  segment_number integer not null check (segment_number between 1 and 1000),
  status text not null default 'recording' check (status in ('recording','uploading','validating','ready','interrupted','failed','aborted')),
  object_key text not null unique,
  upload_id text not null,
  mime_type text not null,
  part_size integer not null check (part_size >= 5 * 1024 * 1024),
  total_bytes bigint not null default 0 check (total_bytes >= 0),
  duration_seconds numeric(12,3) check (duration_seconds is null or duration_seconds > 0),
  object_etag text,
  started_at timestamptz not null default now(),
  stopped_at timestamptz,
  verified_at timestamptz,
  error_message text,
  unique(recording_id,segment_number)
);
create index live_recording_segments_recording_status
  on public.live_recording_segments(recording_id,status,segment_number);

create table public.live_recording_parts (
  segment_id uuid not null references public.live_recording_segments(id) on delete cascade,
  part_number integer not null check (part_number between 1 and 10000),
  byte_length integer not null check (byte_length > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  etag text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(segment_id,part_number)
);

create table public.live_usage_summaries (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id uuid references public.live_media_connections(id) on delete set null,
  sampled_from timestamptz not null,
  sampled_to timestamptz not null,
  audio_bytes bigint not null default 0 check (audio_bytes >= 0),
  video_bytes bigint not null default 0 check (video_bytes >= 0),
  screen_bytes bigint not null default 0 check (screen_bytes >= 0),
  packets_lost bigint not null default 0,
  jitter_ms numeric(12,3),
  rtt_ms numeric(12,3),
  candidate_type text,
  reconnect_count integer not null default 0 check (reconnect_count >= 0),
  created_at timestamptz not null default now(),
  check (sampled_to > sampled_from),
  unique(connection_id,sampled_from,sampled_to)
);
create index live_usage_summaries_class_time
  on public.live_usage_summaries(session_id,sampled_to);

create or replace function public.can_join_live(target_session uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1
    from public.live_sessions s
    join public.profiles p on p.id=(select auth.uid()) and p.is_active
    where s.id=target_session and (
      p.role='admin'
      or (
        p.role='teacher' and s.faculty_id=p.id
        and (s.program_id is null or public.teacher_has_assignment(null,s.program_id,s.subject_id,null))
      )
      or (
        p.role='student' and s.status <> 'cancelled' and exists(
          select 1 from public.enrollments e
          where e.student_id=p.id and e.status='active'
            and (s.program_id is null or e.program_id=s.program_id)
            and (s.batch_id is null or e.batch_id=s.batch_id)
            and (e.access_starts_at is null or e.access_starts_at <= now())
            and (e.access_expires_at is null or e.access_expires_at > now())
        ) and not exists(select 1 from public.live_participants lp where lp.session_id=s.id and lp.user_id=p.id and lp.removed_at is not null)
      )
    )
  )
$$;
revoke all on function public.can_join_live(uuid) from public,anon;
grant execute on function public.can_join_live(uuid) to authenticated;

create or replace function public.heartbeat_live_connection(target_connection uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target_session uuid;
begin
  select c.session_id into target_session from public.live_media_connections c
  where c.id=target_connection and c.user_id=(select auth.uid()) and c.status in ('active','reconnecting');
  if target_session is null or not public.can_join_live(target_session) then
    raise exception 'Live connection is unavailable' using errcode='42501';
  end if;
  update public.live_media_connections set last_seen_at=now(),status='active' where id=target_connection;
  update public.live_attendance_intervals set heartbeat_at=now()
    where connection_id=target_connection and ended_at is null;
  update public.live_participants set heartbeat_at=now(),connection_lease_expires_at=now()+interval '45 seconds'
    where session_id=target_session and user_id=(select auth.uid());
end $$;
revoke all on function public.heartbeat_live_connection(uuid) from public,anon;
grant execute on function public.heartbeat_live_connection(uuid) to authenticated;

create or replace function public.close_stale_live_attendance(target_session uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if not exists(select 1 from public.live_sessions s where s.id=target_session and (public.is_admin() or s.faculty_id=(select auth.uid()))) then
    raise exception 'Classroom management required' using errcode='42501';
  end if;
  update public.live_attendance_intervals a set ended_at=a.heartbeat_at+interval '45 seconds',ended_reason='stale'
    where a.session_id=target_session and a.ended_at is null and a.heartbeat_at < now()-interval '45 seconds';
  get diagnostics changed=row_count;
  update public.live_media_connections c set status='stale',closed_at=now()
    where c.session_id=target_session and c.status in ('active','reconnecting') and c.last_seen_at < now()-interval '45 seconds';
  return changed;
end $$;
revoke all on function public.close_stale_live_attendance(uuid) from public,anon;
grant execute on function public.close_stale_live_attendance(uuid) to authenticated;

create or replace function public.refresh_live_attendance(target_session uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.live_sessions s where s.id=target_session and (public.is_admin() or s.faculty_id=(select auth.uid()))) then
    raise exception 'Classroom management required' using errcode='42501';
  end if;
  perform public.close_stale_live_attendance(target_session);
  update public.live_participants p set attendance_seconds=coalesce((
    select floor(sum(extract(epoch from (coalesce(a.ended_at,now())-a.started_at))))::integer
    from public.live_attendance_intervals a where a.session_id=target_session and a.user_id=p.user_id
  ),0) where p.session_id=target_session;
end $$;
revoke all on function public.refresh_live_attendance(uuid) from public,anon;
grant execute on function public.refresh_live_attendance(uuid) to authenticated;

create or replace function public.live_poll_payload(target_session uuid)
returns table(
  id uuid, question_id uuid, launched_at timestamptz, closed_at timestamptz,
  show_results boolean, prompt text, options jsonb, response_count bigint, own_selected uuid[]
) language sql stable security definer set search_path='' as $$
  select lq.id,lq.question_id,lq.launched_at,lq.closed_at,lq.show_results,q.prompt,
    coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'content',o.content,'display_order',o.display_order) order by o.display_order)
      from public.question_options o where o.question_id=q.id),'[]'::jsonb),
    case when lq.show_results or public.is_admin() or s.faculty_id=(select auth.uid())
      then (select count(*) from public.live_question_responses r where r.live_question_id=lq.id) else 0 end,
    coalesce((select r.selected_option_ids from public.live_question_responses r where r.live_question_id=lq.id and r.student_id=(select auth.uid())),'{}'::uuid[])
  from public.live_questions lq join public.questions q on q.id=lq.question_id join public.live_sessions s on s.id=lq.session_id
  where lq.session_id=target_session and public.can_join_live(target_session)
  order by lq.launched_at desc nulls last
$$;
revoke all on function public.live_poll_payload(uuid) from public,anon;
grant execute on function public.live_poll_payload(uuid) to authenticated;

create or replace function public.live_participant_roster(target_session uuid)
returns table(
  user_id uuid, full_name text, presenter boolean, audio_publish_allowed boolean,
  screen_publish_allowed boolean, raised_hand boolean, joined_at timestamptz,
  left_at timestamptz, heartbeat_at timestamptz, attendance_seconds bigint
) language sql stable security definer set search_path='' as $$
  select lp.user_id,p.full_name,lp.presenter,lp.audio_publish_allowed,lp.screen_publish_allowed,
    lp.raised_hand,lp.joined_at,lp.left_at,lp.heartbeat_at,lp.attendance_seconds
  from public.live_participants lp join public.profiles p on p.id=lp.user_id
  where lp.session_id=target_session and lp.removed_at is null and (
    public.is_admin() or exists(select 1 from public.live_sessions s where s.id=target_session and s.faculty_id=(select auth.uid()))
  ) order by lp.joined_at
$$;
revoke all on function public.live_participant_roster(uuid) from public,anon;
grant execute on function public.live_participant_roster(uuid) to authenticated;

create or replace function public.live_message_payload(target_session uuid)
returns table(id uuid, body text, created_at timestamptz, sender_id uuid, sender_name text)
language sql stable security definer set search_path='' as $$
  select x.id,x.body,x.created_at,x.sender_id,x.sender_name from (
    select m.id,m.body,m.created_at,m.sender_id,p.full_name as sender_name
    from public.live_messages m join public.profiles p on p.id=m.sender_id
    where m.session_id=target_session and public.can_join_live(target_session)
    order by m.created_at desc limit 200
  ) x order by x.created_at
$$;
revoke all on function public.live_message_payload(uuid) from public,anon;
grant execute on function public.live_message_payload(uuid) to authenticated;

create or replace function public.live_session_payload(target_session uuid)
returns table(
  id uuid, title text, faculty_id uuid, status public.session_status, starts_at timestamptz, ends_at timestamptz,
  program_id uuid, batch_id uuid, subject_id uuid, recording_enabled boolean, provider text,
  program_name text, batch_name text, subject_name text, teacher_name text
) language sql stable security definer set search_path='' as $$
  select s.id,s.title,s.faculty_id,s.status,s.starts_at,s.ends_at,s.program_id,s.batch_id,s.subject_id,
    s.recording_enabled,s.provider,pr.name,b.name,su.name,p.full_name
  from public.live_sessions s
  left join public.programs pr on pr.id=s.program_id left join public.batches b on b.id=s.batch_id
  left join public.subjects su on su.id=s.subject_id join public.profiles p on p.id=s.faculty_id
  where s.id=target_session and public.can_join_live(target_session)
$$;
revoke all on function public.live_session_payload(uuid) from public,anon;
grant execute on function public.live_session_payload(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['live_media_connections','live_published_tracks','live_track_subscriptions','live_attendance_intervals','live_recording_segments','live_recording_parts','live_usage_summaries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on table public.%I to authenticated',t);
  end loop;
end $$;

create policy live_connections_member_read on public.live_media_connections for select to authenticated
  using(public.can_join_live(session_id));
create policy live_connections_self_insert on public.live_media_connections for insert to authenticated
  with check(user_id=(select auth.uid()) and public.can_join_live(session_id));
create policy live_connections_self_update on public.live_media_connections for update to authenticated
  using(user_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())))
  with check(user_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));

create policy live_tracks_member_read on public.live_published_tracks for select to authenticated
  using(public.can_join_live(session_id));
create policy live_tracks_owner_insert on public.live_published_tracks for insert to authenticated
  with check(owner_id=(select auth.uid()) and public.can_join_live(session_id));
create policy live_tracks_owner_update on public.live_published_tracks for update to authenticated
  using(owner_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())))
  with check(owner_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));

create policy live_subscriptions_member_read on public.live_track_subscriptions for select to authenticated
  using(public.can_join_live(session_id));
create policy live_subscriptions_owner_insert on public.live_track_subscriptions for insert to authenticated
  with check(exists(select 1 from public.live_media_connections c where c.id=connection_id and c.user_id=(select auth.uid())) and public.can_join_live(session_id));
create policy live_subscriptions_owner_update on public.live_track_subscriptions for update to authenticated
  using(exists(select 1 from public.live_media_connections c where c.id=connection_id and c.user_id=(select auth.uid())))
  with check(exists(select 1 from public.live_media_connections c where c.id=connection_id and c.user_id=(select auth.uid())));

create policy live_attendance_self_read on public.live_attendance_intervals for select to authenticated
  using(user_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));
create policy live_attendance_self_insert on public.live_attendance_intervals for insert to authenticated
  with check(user_id=(select auth.uid()) and public.can_join_live(session_id));
create policy live_attendance_self_update on public.live_attendance_intervals for update to authenticated
  using(user_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())))
  with check(user_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));

drop policy if exists recordings_ready_read on public.class_recordings;
create policy recordings_authorized_read on public.class_recordings for select to authenticated using(
  owner_id=(select auth.uid()) or public.is_admin()
  or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
  or (status='published' and published_at is not null and public.can_join_live(session_id))
);
create policy recordings_teacher_insert on public.class_recordings for insert to authenticated with check(
  owner_id=(select auth.uid()) and exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
  or public.is_admin()
);
create policy recordings_teacher_update on public.class_recordings for update to authenticated using(
  owner_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
) with check(
  owner_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
);

create policy recording_segments_owner_read on public.live_recording_segments for select to authenticated
  using(owner_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.class_recordings r where r.id=recording_id and r.status='published' and public.can_join_live(r.session_id)));
create policy recording_segments_owner_insert on public.live_recording_segments for insert to authenticated
  with check(owner_id=(select auth.uid()) and exists(select 1 from public.class_recordings r where r.id=recording_id and r.owner_id=(select auth.uid())) or public.is_admin());
create policy recording_segments_owner_update on public.live_recording_segments for update to authenticated
  using(owner_id=(select auth.uid()) or public.is_admin()) with check(owner_id=(select auth.uid()) or public.is_admin());

create policy recording_parts_owner_read on public.live_recording_parts for select to authenticated
  using(exists(select 1 from public.live_recording_segments s where s.id=segment_id and (s.owner_id=(select auth.uid()) or public.is_admin())));
create policy recording_parts_owner_insert on public.live_recording_parts for insert to authenticated
  with check(exists(select 1 from public.live_recording_segments s where s.id=segment_id and s.owner_id=(select auth.uid())) or public.is_admin());
create policy recording_parts_owner_update on public.live_recording_parts for update to authenticated
  using(exists(select 1 from public.live_recording_segments s where s.id=segment_id and s.owner_id=(select auth.uid())) or public.is_admin())
  with check(exists(select 1 from public.live_recording_segments s where s.id=segment_id and s.owner_id=(select auth.uid())) or public.is_admin());

create policy usage_self_insert on public.live_usage_summaries for insert to authenticated
  with check(user_id=(select auth.uid()) and public.can_join_live(session_id));
create policy usage_authorized_read on public.live_usage_summaries for select to authenticated
  using(user_id=(select auth.uid()) or public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())));

-- Broadcast and Presence channels use topics of the form class:<live session UUID>.
-- The class UUID is only a locator; can_join_live remains the authorization check.
create policy live_class_realtime_receive on realtime.messages for select to authenticated using(
  realtime.messages.extension in ('broadcast','presence') and exists(
    select 1 from public.live_sessions s
    where realtime.topic()=('class:'||s.id::text) and public.can_join_live(s.id)
  )
);
create policy live_class_realtime_send on realtime.messages for insert to authenticated with check(
  realtime.messages.extension in ('broadcast','presence') and exists(
    select 1 from public.live_sessions s
    where realtime.topic()=('class:'||s.id::text) and public.can_join_live(s.id)
  )
);

-- Poll responses are insert-only for students. Closing time and membership are
-- checked server-side instead of trusting a client-side disabled button.
drop policy if exists live_responses_own_insert on public.live_question_responses;
drop policy if exists live_responses_own_update on public.live_question_responses;
create policy live_responses_open_poll_insert on public.live_question_responses for insert to authenticated with check(
  student_id=(select auth.uid()) and exists(
    select 1 from public.live_questions q
    where q.id=live_question_id and q.launched_at is not null and q.closed_at is null and public.can_join_live(q.session_id)
      and cardinality(selected_option_ids)=1
      and exists(select 1 from public.question_options o where o.question_id=q.question_id and o.id=selected_option_ids[1])
  )
);

drop policy if exists live_questions_teacher_insert on public.live_questions;
drop policy if exists live_questions_teacher_update on public.live_questions;
create policy live_questions_assigned_teacher_insert on public.live_questions for insert to authenticated with check(
  public.is_admin() or exists(
    select 1 from public.live_sessions s join public.questions q on q.id=question_id
    where s.id=session_id and s.faculty_id=(select auth.uid()) and q.subject_id=s.subject_id
      and public.teacher_has_assignment(null,s.program_id,s.subject_id,null)
  )
);
create policy live_questions_assigned_teacher_update on public.live_questions for update to authenticated using(
  public.is_admin() or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()) and public.teacher_has_assignment(null,s.program_id,s.subject_id,null))
) with check(
  public.is_admin() or exists(
    select 1 from public.live_sessions s join public.questions q on q.id=question_id
    where s.id=session_id and s.faculty_id=(select auth.uid()) and q.subject_id=s.subject_id
      and public.teacher_has_assignment(null,s.program_id,s.subject_id,null)
  )
);

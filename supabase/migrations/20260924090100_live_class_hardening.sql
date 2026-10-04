-- Follow-up hardening discovered by authenticated local acceptance tests.
-- This intentionally remains separate from the two original classroom migrations.

-- Existing pre-classroom recordings did not have an owner column. Preserve those
-- rows while assigning the class's Teacher as the recovery/review owner.
update public.class_recordings r
set owner_id = s.faculty_id
from public.live_sessions s
where s.id = r.session_id and r.owner_id is null;

alter table public.class_recordings
  alter column owner_id set not null,
  add column client_validated_at timestamptz,
  add column client_reported_duration_seconds numeric check (client_reported_duration_seconds is null or client_reported_duration_seconds > 0),
  add column client_reported_seekable boolean,
  add column client_reported_has_audio boolean,
  add column client_reported_has_video boolean;

alter table public.live_recording_segments
  add column client_validated_at timestamptz,
  add column client_reported_duration_seconds numeric check (client_reported_duration_seconds is null or client_reported_duration_seconds > 0),
  add column client_reported_seekable boolean,
  add column client_reported_has_audio boolean,
  add column client_reported_has_video boolean;

-- Students cannot directly read question_options because that table also holds
-- answer-sensitive data. The old poll INSERT policy therefore rejected every
-- valid response when its option lookup ran under the Student's RLS context.
-- Keep the narrow lookup in the non-exposed private schema and bind it to the
-- authenticated caller and current classroom eligibility.
create or replace function private.can_submit_live_poll(
  target_live_question uuid,
  target_option_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and cardinality(target_option_ids) = 1
    and exists (
      select 1
      from public.live_questions q
      join public.question_options o
        on o.question_id = q.question_id
       and o.id = target_option_ids[1]
      where q.id = target_live_question
        and q.launched_at is not null
        and q.closed_at is null
        and public.can_join_live(q.session_id)
    )
$$;

revoke all on function private.can_submit_live_poll(uuid,uuid[]) from public,anon,service_role;
grant execute on function private.can_submit_live_poll(uuid,uuid[]) to authenticated;

drop policy if exists live_responses_open_poll_insert on public.live_question_responses;
create policy live_responses_open_poll_insert
on public.live_question_responses
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and (select private.can_submit_live_poll(live_question_id,selected_option_ids))
);

-- The classroom subscribed to these tables, but none had been added to the
-- supabase_realtime publication. Without this, the eight-second fallback was
-- the only refresh mechanism and the private channel never delivered changes.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'live_messages',
    'live_participants',
    'live_questions',
    'live_question_responses',
    'live_published_tracks'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',relation_name);
    end if;
  end loop;
end
$$;

create index if not exists live_messages_session_created_id
  on public.live_messages(session_id,created_at desc,id);

create or replace function public.live_message_page(
  target_session uuid,
  before_created_at timestamptz default null,
  before_id uuid default null,
  page_size integer default 50
)
returns table(id uuid,body text,created_at timestamptz,sender_id uuid,sender_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select page.id,page.body,page.created_at,page.sender_id,page.sender_name
  from (
    select m.id,m.body,m.created_at,m.sender_id,p.full_name as sender_name
    from public.live_messages m
    join public.profiles p on p.id = m.sender_id
    where m.session_id = target_session
      and public.can_join_live(target_session)
      and (
        before_created_at is null
        or (m.created_at,m.id) < (before_created_at,coalesce(before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
      )
    order by m.created_at desc,m.id desc
    limit least(greatest(page_size,1),100)
  ) page
  order by page.created_at,page.id
$$;

create or replace function public.live_messages_since(
  target_session uuid,
  after_created_at timestamptz,
  after_id uuid,
  page_size integer default 100
)
returns table(id uuid,body text,created_at timestamptz,sender_id uuid,sender_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id,m.body,m.created_at,m.sender_id,p.full_name
  from public.live_messages m
  join public.profiles p on p.id = m.sender_id
  where m.session_id = target_session
    and public.can_join_live(target_session)
    and (m.created_at,m.id) > (after_created_at,after_id)
  order by m.created_at,m.id
  limit least(greatest(page_size,1),100)
$$;

revoke all on function public.live_message_page(uuid,timestamptz,uuid,integer) from public,anon;
grant execute on function public.live_message_page(uuid,timestamptz,uuid,integer) to authenticated;
revoke all on function public.live_messages_since(uuid,timestamptz,uuid,integer) from public,anon;
grant execute on function public.live_messages_since(uuid,timestamptz,uuid,integer) to authenticated;

-- Provider cleanup is a state machine, not a one-shot request. Keep unresolved
-- mids retryable and let an authenticated class manager reconcile connections
-- whose heartbeat or underlying ALS eligibility has become invalid.
alter table public.live_published_tracks
  add column cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  add column cleanup_retry_at timestamptz,
  add column last_cleanup_error text;

alter table public.live_track_subscriptions
  drop constraint if exists live_track_subscriptions_status_check,
  add constraint live_track_subscriptions_status_check check (status in ('active','closing','closed','failed')),
  add column cleanup_attempts integer not null default 0 check (cleanup_attempts >= 0),
  add column cleanup_retry_at timestamptz,
  add column last_cleanup_error text;

create index live_published_tracks_cleanup_retry
  on public.live_published_tracks(session_id,cleanup_retry_at)
  where status in ('closing','failed');
create index live_track_subscriptions_cleanup_retry
  on public.live_track_subscriptions(session_id,cleanup_retry_at)
  where status in ('closing','failed');

drop policy if exists live_subscriptions_owner_update on public.live_track_subscriptions;
create policy live_subscriptions_owner_update on public.live_track_subscriptions
for update to authenticated
using (
  exists(select 1 from public.live_media_connections c where c.id=connection_id and c.user_id=(select auth.uid()))
  or public.is_admin()
  or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
)
with check (
  exists(select 1 from public.live_media_connections c where c.id=connection_id and c.user_id=(select auth.uid()))
  or public.is_admin()
  or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid()))
);

create or replace function private.live_user_is_eligible(target_session uuid,target_user uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.live_sessions s
    join public.profiles p on p.id=target_user and p.is_active
    where s.id=target_session
      and s.status='live'
      and (
        p.role='admin'
        or (
          p.role='teacher'
          and s.faculty_id=p.id
          and (
            s.program_id is null
            or exists(
              select 1 from public.faculty_assignments f
              where f.faculty_id=p.id
                and (f.program_id is null or f.program_id=s.program_id)
                and (f.subject_id is null or f.subject_id=s.subject_id)
            )
          )
        )
        or (
          p.role='student'
          and exists(
            select 1 from public.enrollments e
            where e.student_id=p.id and e.status='active'
              and (s.program_id is null or e.program_id=s.program_id)
              and (s.batch_id is null or e.batch_id=s.batch_id)
              and (e.access_starts_at is null or e.access_starts_at <= now())
              and (e.access_expires_at is null or e.access_expires_at > now())
          )
          and not exists(
            select 1 from public.live_participants lp
            where lp.session_id=s.id and lp.user_id=p.id and lp.removed_at is not null
          )
        )
      )
  )
$$;
revoke all on function private.live_user_is_eligible(uuid,uuid) from public,anon,authenticated;

create or replace function public.live_transport_cleanup_candidates(target_session uuid)
returns table(connection_id uuid,user_id uuid,reason text)
language sql
stable
security definer
set search_path=''
as $$
  select c.id,c.user_id,
    case
      when c.last_seen_at < now()-interval '45 seconds' then 'stale'
      else 'authorization_revoked'
    end
  from public.live_media_connections c
  where c.session_id=target_session
    and c.status in ('active','reconnecting','failed')
    and exists(
      select 1 from public.live_sessions s
      where s.id=target_session
        and (public.is_admin() or s.faculty_id=(select auth.uid()))
    )
    and (
      c.last_seen_at < now()-interval '45 seconds'
      or not private.live_user_is_eligible(target_session,c.user_id)
    )
$$;
revoke all on function public.live_transport_cleanup_candidates(uuid) from public,anon;
grant execute on function public.live_transport_cleanup_candidates(uuid) to authenticated;

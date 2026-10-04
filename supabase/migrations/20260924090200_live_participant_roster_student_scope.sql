create or replace function public.live_participant_roster(target_session uuid)
returns table(
  user_id uuid, full_name text, presenter boolean, audio_publish_allowed boolean,
  screen_publish_allowed boolean, raised_hand boolean, joined_at timestamptz,
  left_at timestamptz, heartbeat_at timestamptz, attendance_seconds bigint
) language sql stable security definer set search_path='' as $$
  select lp.user_id,p.full_name,lp.presenter,lp.audio_publish_allowed,lp.screen_publish_allowed,
    lp.raised_hand,lp.joined_at,lp.left_at,lp.heartbeat_at,lp.attendance_seconds
  from public.live_participants lp
  join public.profiles p on p.id=lp.user_id
  where lp.session_id=target_session
    and lp.removed_at is null
    and p.role='student'
    and p.is_active
    and (
      public.is_admin()
      or exists(
        select 1 from public.live_sessions s
        where s.id=target_session and s.faculty_id=(select auth.uid())
      )
    )
  order by lp.joined_at
$$;

revoke all on function public.live_participant_roster(uuid) from public,anon;
grant execute on function public.live_participant_roster(uuid) to authenticated;

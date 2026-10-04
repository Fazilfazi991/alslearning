-- A heartbeat waiting on Teacher End must not resurrect the newer closed row.
create or replace function public.heartbeat_live_connection(target_connection uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target_session uuid;
begin
  select c.session_id into target_session from public.live_media_connections c
  where c.id=target_connection and c.user_id=(select auth.uid());
  if target_session is null or not public.can_join_live(target_session) then
    raise exception 'Live connection is unavailable' using errcode='42501';
  end if;
  -- Recheck the connection status in the write predicate after any row-lock
  -- wait. An earlier SELECT of an active row is not sufficient evidence.
  update public.live_media_connections c set last_seen_at=now(),status='active'
  where c.id=target_connection and c.user_id=(select auth.uid())
    and c.status in ('active','reconnecting')
    and exists(select 1 from public.live_sessions s where s.id=c.session_id and s.status='live');
  if not found then return; end if;
  update public.live_attendance_intervals set heartbeat_at=now()
    where connection_id=target_connection and ended_at is null;
  update public.live_participants set heartbeat_at=now(),connection_lease_expires_at=now()+interval '45 seconds'
    where session_id=target_session and user_id=(select auth.uid()) and left_at is null and removed_at is null;
end $$;
revoke all on function public.heartbeat_live_connection(uuid) from public,anon,service_role;
grant execute on function public.heartbeat_live_connection(uuid) to authenticated;

-- Direct authenticated writes must obey the same terminal-state invariant.
drop policy live_connections_self_insert on public.live_media_connections;
create policy live_connections_self_insert on public.live_media_connections for insert to authenticated
with check(user_id=(select auth.uid()) and public.can_join_live(session_id)
  and exists(select 1 from public.live_sessions s where s.id=session_id and s.status='live'));

drop policy live_connections_self_update on public.live_media_connections;
create policy live_connections_self_update on public.live_media_connections for update to authenticated
using(user_id=(select auth.uid()) or public.is_admin()
  or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())))
with check((user_id=(select auth.uid()) or public.is_admin()
  or exists(select 1 from public.live_sessions s where s.id=session_id and s.faculty_id=(select auth.uid())))
  and (status not in ('active','reconnecting') or (public.can_join_live(session_id)
    and exists(select 1 from public.live_sessions s where s.id=session_id and s.status='live'))));

drop policy live_attendance_self_insert on public.live_attendance_intervals;
create policy live_attendance_self_insert on public.live_attendance_intervals for insert to authenticated
with check(user_id=(select auth.uid()) and public.can_join_live(session_id)
  and exists(select 1 from public.live_media_connections c where c.id=connection_id
    and c.session_id=live_attendance_intervals.session_id and c.user_id=(select auth.uid())
    and c.status in ('active','reconnecting'))
  and exists(select 1 from public.live_sessions s where s.id=session_id and s.status='live'));

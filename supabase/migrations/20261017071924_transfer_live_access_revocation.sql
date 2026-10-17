-- Transfer revokes old-batch LIVE transport in the same enrollment transaction.
-- Provider closure remains owned by the existing transport reconciler; do not
-- falsely mark provider tracks closed before Cloudflare acknowledges closure.
create function private.lms_transfer_live_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_classes uuid[]; closed_at_value timestamptz:=clock_timestamp();
begin
 if new.batch_id is not distinct from old.batch_id then return new; end if;
 select array_agg(id) into old_classes from public.live_sessions
   where batch_id=old.batch_id and program_id=old.program_id and status='live';
 if old_classes is null then return new; end if;
 update public.live_media_connections set status='closed',closed_at=closed_at_value
   where user_id=new.student_id and session_id=any(old_classes) and status in ('active','reconnecting');
 update public.live_attendance_intervals set ended_at=closed_at_value,ended_reason='left'
   where user_id=new.student_id and session_id=any(old_classes) and ended_at is null;
 update public.live_participants set left_at=closed_at_value,connection_lease_expires_at=closed_at_value
   where user_id=new.student_id and session_id=any(old_classes) and left_at is null;
 update public.live_published_tracks set status='closing',cleanup_retry_at=closed_at_value
   where owner_id=new.student_id and session_id=any(old_classes) and status='active';
 update public.live_track_subscriptions set status='closing',cleanup_retry_at=closed_at_value
   where session_id=any(old_classes) and status='active' and connection_id in
     (select id from public.live_media_connections where user_id=new.student_id and session_id=any(old_classes));
 return new;
end $$;
revoke all on function private.lms_transfer_live_access() from public,anon,authenticated,service_role;
create trigger lms_transfer_live_access after update on public.enrollments for each row execute function private.lms_transfer_live_access();

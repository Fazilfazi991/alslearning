-- The secret-authenticated production cleanup only reads and closes live resources.
-- Preserve the restriction on ordinary academic tables and user administration.
grant select, update on public.live_sessions, public.live_media_connections,
  public.live_published_tracks, public.live_track_subscriptions,
  public.live_attendance_intervals to service_role;

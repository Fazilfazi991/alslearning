-- Keep publication and subscription SDP state independent while retaining one
-- application connection and attendance interval per participant.
alter table public.live_media_connections
  alter column provider_session_id drop not null,
  add column if not exists publisher_provider_session_id text;

create unique index if not exists live_media_connections_publisher_provider_session_unique
  on public.live_media_connections(publisher_provider_session_id)
  where publisher_provider_session_id is not null;

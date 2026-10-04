-- Existing publications stay discoverable during deployment. New publishers
-- acknowledge readiness only after applying SDP and sending actual media.
alter table public.live_published_tracks
  add column discovery_ready boolean not null default true;

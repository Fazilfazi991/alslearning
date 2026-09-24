-- Preserve legacy aggregate rows while recording direction and application-level
-- media identity for all new samples. Version 1 rows are intentionally not
-- retroactively reclassified because the original RTP identity was not stored.
alter table public.live_usage_summaries
  add column classification_version smallint not null default 2 check (classification_version in (1,2)),
  add column sent_microphone_bytes bigint not null default 0 check (sent_microphone_bytes >= 0),
  add column sent_camera_bytes bigint not null default 0 check (sent_camera_bytes >= 0),
  add column sent_screen_bytes bigint not null default 0 check (sent_screen_bytes >= 0),
  add column sent_unclassified_bytes bigint not null default 0 check (sent_unclassified_bytes >= 0),
  add column received_microphone_bytes bigint not null default 0 check (received_microphone_bytes >= 0),
  add column received_camera_bytes bigint not null default 0 check (received_camera_bytes >= 0),
  add column received_screen_bytes bigint not null default 0 check (received_screen_bytes >= 0),
  add column received_unclassified_bytes bigint not null default 0 check (received_unclassified_bytes >= 0);

update public.live_usage_summaries set classification_version = 1;

-- Cleanup evidence is additive: historical failed state remains intact while an
-- independent provider observation can prove the session expired or the mid is absent.
alter table public.live_published_tracks
  add column provider_reconciliation_outcome text check (provider_reconciliation_outcome in ('confirmed_closed','confirmed_absent_or_expired','unresolved')),
  add column provider_reconciled_at timestamptz,
  add column provider_reconciliation_http_status integer,
  add column provider_reconciliation_error_code text,
  add column provider_reconciliation_detail text;

alter table public.live_track_subscriptions
  add column provider_reconciliation_outcome text check (provider_reconciliation_outcome in ('confirmed_closed','confirmed_absent_or_expired','unresolved')),
  add column provider_reconciled_at timestamptz,
  add column provider_reconciliation_http_status integer,
  add column provider_reconciliation_error_code text,
  add column provider_reconciliation_detail text;

alter table public.live_recording_segments
  add column object_sha256 text check (object_sha256 is null or object_sha256 ~ '^[0-9a-f]{64}$');

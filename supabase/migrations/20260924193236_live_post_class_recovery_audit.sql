-- Preserve capture stop time and record the actual post-class upload sequence.
alter table public.live_recording_parts
  add column last_signed_at timestamptz;

alter table public.live_recording_segments
  add column completed_at timestamptz;

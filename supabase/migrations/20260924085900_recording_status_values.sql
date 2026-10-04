-- Enum additions must commit before later migrations may use the new values.
alter type public.recording_status add value if not exists 'uploading';
alter type public.recording_status add value if not exists 'interrupted';
alter type public.recording_status add value if not exists 'validating';
alter type public.recording_status add value if not exists 'published';
alter type public.recording_status add value if not exists 'aborted';

-- Session status is authoritative; existing live_sessions RLS still filters delivery.
-- No grants, policies, class rows or credentials are changed.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_sessions'
  ) then
    alter publication supabase_realtime add table public.live_sessions;
  end if;
end
$$;

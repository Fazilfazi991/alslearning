alter type public.recording_status add value if not exists 'requested' before 'recording';
alter table public.enrollments add column if not exists access_starts_at timestamptz not null default now();
alter table public.enrollments add constraint enrollment_access_window_valid check(access_expires_at is null or access_expires_at > access_starts_at);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,role,full_name,email)
  values(new.id,coalesce((new.raw_app_meta_data->>'role')::public.app_role,'student'),coalesce(new.raw_user_meta_data->>'full_name',''),new.email)
  on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

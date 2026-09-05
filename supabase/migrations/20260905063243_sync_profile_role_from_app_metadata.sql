create or replace function private.sync_profile_role() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.raw_app_meta_data->>'role' in ('student','teacher','admin') then
    update public.profiles set role=(new.raw_app_meta_data->>'role')::public.app_role,updated_at=now() where id=new.id;
  end if;
  return new;
end $$;
revoke all on function private.sync_profile_role() from public,anon,authenticated;
drop trigger if exists on_auth_user_role_updated on auth.users;
create trigger on_auth_user_role_updated after update of raw_app_meta_data on auth.users for each row when(old.raw_app_meta_data is distinct from new.raw_app_meta_data) execute function private.sync_profile_role();

update public.profiles p set role=(u.raw_app_meta_data->>'role')::public.app_role,updated_at=now()
from auth.users u where u.id=p.id and u.raw_app_meta_data->>'role' in ('student','teacher','admin') and p.role::text is distinct from u.raw_app_meta_data->>'role';

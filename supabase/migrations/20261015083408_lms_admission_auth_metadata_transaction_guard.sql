-- Auth Admin createUser inserts the identity, then applies app_metadata inside
-- the same transaction (supabase/auth internal/api/admin.go). Handle that update
-- as well as inserts. Clearing admission metadata does not re-enter this trigger.
create trigger on_auth_user_lms_admission after update of raw_app_meta_data on auth.users
for each row when (new.raw_app_meta_data ? 'lms_admission')
execute function private.handle_new_user();

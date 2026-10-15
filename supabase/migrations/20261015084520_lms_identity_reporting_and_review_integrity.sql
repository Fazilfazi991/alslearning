-- Preserve the established Teacher scope and pagination; add stable identity.
create or replace function public.core_teacher_students(page_number integer default 0,
  page_size integer default 25, search_text text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or coalesce(private.active_role(), '') <> 'teacher'
  then raise exception 'Teacher roster access denied'; end if;

  with scoped as (
    select e.id, e.student_id, e.access_expires_at, p.full_name, p.email, p.student_code,
      pr.name as program_name, b.name as batch_name,
      -- "active" mirrors every eligibility condition in private.enrolled.
      case
        when not p.is_active then 'student_inactive'
        when e.status <> 'active' then e.status::text
        when pr.status <> 'active' then 'program_inactive'
        when e.access_starts_at > now() then 'upcoming'
        when e.access_expires_at <= now() then 'expired'
        when e.batch_id is not null and (b.id is null or b.program_id <> e.program_id)
          then 'unavailable'
        when b.status = 'upcoming' then 'upcoming'
        when b.status in ('completed', 'archived') then b.status::text
        when b.status <> 'active' then 'unavailable'
        when b.access_starts_at > now() then 'upcoming'
        when b.access_expires_at <= now()
          or b.access_valid_until < current_date then 'expired'
        else 'active'
      end as access_status
    from public.enrollments e
    join public.profiles p on p.id = e.student_id and p.role = 'student'
    join public.programs pr on pr.id = e.program_id
    left join public.batches b on b.id = e.batch_id
    where private.teacher_student_scope(e.student_id, e.program_id, e.batch_id)
      and (btrim(coalesce(search_text, '')) = '' or
        coalesce(p.full_name, '') ilike '%' || btrim(search_text) || '%' or
        p.email ilike '%' || btrim(search_text) || '%' or
        p.student_code ilike '%' || btrim(search_text) || '%' or
        pr.name ilike '%' || btrim(search_text) || '%')
  ), page_rows as (
    select * from scoped order by coalesce(full_name, email), id
    offset greatest(coalesce(page_number, 0), 0) * least(greatest(coalesce(page_size, 25), 1), 50)
    limit least(greatest(coalesce(page_size, 25), 1), 50)
  )
  select jsonb_build_object(
    'total', (select count(*) from scoped),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'student_id', student_id, 'name', coalesce(full_name, email),
      'email', email, 'student_code', student_code, 'program', program_name, 'batch', batch_name,
      'status', access_status, 'expires_at', access_expires_at
    ) order by coalesce(full_name, email), id) from page_rows), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.core_teacher_students(integer, integer, text)
  from public, anon, service_role;
grant execute on function public.core_teacher_students(integer, integer, text)
  to authenticated;

create policy profile_photo_admin_read on storage.objects for select to authenticated
using (bucket_id='profile-photos' and public.is_admin());
create policy profile_photo_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='profile-photos' and public.is_admin() and exists(select 1 from public.profiles p where p.id::text=(storage.foldername(name))[1] and p.role='student'));
create policy profile_photo_admin_delete on storage.objects for delete to authenticated
using (bucket_id='profile-photos' and public.is_admin());

create function private.lms_segment_scope_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.class_recordings r where r.id=new.recording_id and r.session_id=new.session_id and r.owner_id=new.owner_id) then
    raise exception 'Recording segment must belong to the class and capture owner'; end if;
  if new.object_key !~ ('^recordings/[0-9]{4}/(0[1-9]|1[0-2])/'||new.session_id::text||'/'||new.recording_id::text||'/'||new.id::text||'/teacher-composite\.(webm|mp4)$') then
    raise exception 'Recording object must use the canonical class upload path'; end if;
  if tg_op='UPDATE' and (new.recording_id is distinct from old.recording_id or new.session_id is distinct from old.session_id or new.owner_id is distinct from old.owner_id or new.object_key is distinct from old.object_key or new.segment_number is distinct from old.segment_number) then
    raise exception 'Recording asset identity is immutable'; end if;
  return new;
end $$;
revoke all on function private.lms_segment_scope_guard() from public,anon,authenticated;
create trigger lms_segment_scope_guard before insert or update on public.live_recording_segments for each row execute function private.lms_segment_scope_guard();

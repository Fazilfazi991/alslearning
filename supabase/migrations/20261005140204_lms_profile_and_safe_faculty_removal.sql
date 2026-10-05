-- Directory removal is separate from Auth. Linked Teachers are archived so
-- classes, attendance, authored questions and results keep their identities.
grant delete on public.faculty_members to authenticated;
create policy faculty_members_admin_delete on public.faculty_members
for delete to authenticated using ((select public.is_admin()));

create function public.core_remove_faculty(target_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare member public.faculty_members; removed_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select * into member from public.faculty_members where id=target_id for update;
  if not found then raise exception 'Faculty not found' using errcode='P0002'; end if;
  if member.auth_profile_id is not null then
    update public.profiles set is_active=false where id=member.auth_profile_id and role='teacher';
    if not found then raise exception 'Linked Teacher could not be archived'; end if;
    update public.faculty_members set is_active=false where id=target_id;
    return jsonb_build_object('id',target_id,'action','archived');
  end if;
  begin
    delete from public.faculty_subject_assignments where faculty_id=target_id;
    delete from public.faculty_members where id=target_id returning id into removed_id;
    if removed_id is null then raise exception 'Faculty removal was not confirmed'; end if;
    return jsonb_build_object('id',target_id,'action','deleted');
  exception when foreign_key_violation then
    -- This subtransaction also restores subject assignments if history prevents removal.
    update public.faculty_members set is_active=false where id=target_id;
    return jsonb_build_object('id',target_id,'action','archived');
  end;
end $$;
revoke all on function public.core_remove_faculty(uuid) from public, anon, service_role;
grant execute on function public.core_remove_faculty(uuid) to authenticated;

alter table public.profiles add column phone text, add column avatar_path text;
alter table public.profiles add constraint profile_phone_length check (phone is null or length(phone)<=32);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-photos','profile-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy profile_photo_owner_read on storage.objects for select to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.active_role())='student');
create policy profile_photo_owner_insert on storage.objects for insert to authenticated
with check (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.active_role())='student');
create policy profile_photo_owner_delete on storage.objects for delete to authenticated
using (bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.active_role())='student');

-- Students cannot UPDATE profiles directly: existing Admin permissions cover
-- role/email/access fields. This private helper exposes only personal columns,
-- binds identity to auth.uid(), and accepts an existing photo in the owner's folder.
create function private.save_student_profile(target_name text, target_phone text, target_avatar text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare person public.profiles; new_avatar text;
begin
  select * into person from public.profiles where id=(select auth.uid()) and role='student' and is_active for update;
  if not found then raise exception 'Active Student required' using errcode='42501'; end if;
  if target_name is null or length(btrim(target_name)) not between 1 and 120 then raise exception 'Enter a name of 1–120 characters'; end if;
  if target_phone is not null and (length(target_phone)>32 or target_phone !~ '^[0-9+(). -]*$') then raise exception 'Enter a valid phone number'; end if;
  new_avatar := coalesce(target_avatar,person.avatar_path);
  if target_avatar is not null and (
    target_avatar !~ ('^' || person.id::text || '/[0-9a-f-]+\.(jpg|png|webp)$')
    or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=target_avatar)
  ) then raise exception 'Choose your own uploaded profile photo' using errcode='42501'; end if;
  update public.profiles set full_name=btrim(target_name),phone=nullif(btrim(target_phone),''),avatar_path=new_avatar,updated_at=now() where id=person.id;
  return jsonb_build_object('id',person.id,'full_name',btrim(target_name),'phone',nullif(btrim(target_phone),''),'avatar_path',new_avatar,'previous_avatar_path',person.avatar_path);
end $$;
create function public.save_student_profile(target_name text, target_phone text, target_avatar text default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_student_profile(target_name,target_phone,target_avatar);
$$;
revoke all on function private.save_student_profile(text,text,text), public.save_student_profile(text,text,text) from public,anon,service_role;
grant execute on function private.save_student_profile(text,text,text), public.save_student_profile(text,text,text) to authenticated;

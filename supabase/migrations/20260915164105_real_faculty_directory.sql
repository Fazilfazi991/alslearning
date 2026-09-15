-- Real faculty are academic directory entries. Teacher permissions remain in
-- auth-backed profiles/faculty_assignments and are not granted by this mapping.
create table public.faculty_members (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  full_name text not null check (length(btrim(full_name)) > 0),
  is_active boolean not null default true,
  auth_profile_id uuid unique references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.faculty_subject_assignments (
  faculty_id uuid not null references public.faculty_members(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (faculty_id, subject_id)
);
create index faculty_subject_assignments_subject_idx on public.faculty_subject_assignments(subject_id);

create function private.validate_faculty_login() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.auth_profile_id is not null and not exists (
    select 1 from public.profiles p where p.id = new.auth_profile_id and p.role = 'teacher'
  ) then
    raise exception 'Faculty login must link to a Teacher profile';
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger faculty_login_guard before insert or update on public.faculty_members
for each row execute function private.validate_faculty_login();
revoke all on function private.validate_faculty_login() from public, anon, authenticated;

alter table public.faculty_members enable row level security;
alter table public.faculty_subject_assignments enable row level security;
revoke all on public.faculty_members, public.faculty_subject_assignments from public, anon, authenticated;
grant select, insert, update on public.faculty_members to authenticated;
grant select, insert, delete on public.faculty_subject_assignments to authenticated;
create policy faculty_members_admin_read on public.faculty_members for select to authenticated using ((select public.is_admin()));
create policy faculty_members_admin_insert on public.faculty_members for insert to authenticated with check ((select public.is_admin()));
create policy faculty_members_admin_update on public.faculty_members for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy faculty_subject_admin_read on public.faculty_subject_assignments for select to authenticated using ((select public.is_admin()));
create policy faculty_subject_admin_insert on public.faculty_subject_assignments for insert to authenticated with check ((select public.is_admin()));
create policy faculty_subject_admin_delete on public.faculty_subject_assignments for delete to authenticated using ((select public.is_admin()));

create function public.core_save_faculty(target_id uuid, target_name text, target_active boolean, target_subject_ids uuid[])
returns uuid language plpgsql set search_path = '' as $$
declare saved_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if length(btrim(coalesce(target_name,''))) = 0 or target_active is null then
    raise exception 'Faculty name and active status are required';
  end if;
  if coalesce(array_length(target_subject_ids,1),0) = 0
     or exists (select 1 from unnest(target_subject_ids) x where x is null or not exists (select 1 from public.subjects s where s.id=x)) then
    raise exception 'Choose at least one valid Subject';
  end if;
  if target_id is null then
    insert into public.faculty_members(full_name,is_active) values (btrim(target_name),target_active) returning id into saved_id;
  else
    update public.faculty_members set full_name=btrim(target_name),is_active=target_active where id=target_id returning id into saved_id;
    if saved_id is null then raise exception 'Faculty member not found'; end if;
  end if;
  delete from public.faculty_subject_assignments a where a.faculty_id=saved_id and not (a.subject_id = any(target_subject_ids));
  insert into public.faculty_subject_assignments(faculty_id,subject_id)
  select saved_id,x from (select distinct unnest(target_subject_ids) x) v
  on conflict (faculty_id,subject_id) do nothing;
  return saved_id;
end $$;
revoke all on function public.core_save_faculty(uuid,text,boolean,uuid[]) from public, anon;
grant execute on function public.core_save_faculty(uuid,text,boolean,uuid[]) to authenticated;

-- Stable client source keys make replay safe even if Admin later edits a name.
with supplied(source_key, full_name, subject_slug) as (values
  ('als-real-faculty-patho-01','Aiswarya Babu','pathology'),
  ('als-real-faculty-patho-02','Aiswarya KP','pathology'),
  ('als-real-faculty-patho-03','Dr Deepa','pathology'),
  ('als-real-faculty-patho-04','Dr Athira Sreenivasan','pathology'),
  ('als-real-faculty-micro-01','Mr Ansar','microbiology'),
  ('als-real-faculty-micro-02','Ms Jasna','microbiology'),
  ('als-real-faculty-micro-03','Ms Anju','microbiology'),
  ('als-real-faculty-micro-04','Ms Reshma Renju','microbiology'),
  ('als-real-faculty-micro-05','Mr Sarath','microbiology'),
  ('als-real-faculty-bio-01','Dr Nithya','biochemistry'),
  ('als-real-faculty-bio-02','Mr Vaishakh','biochemistry')
)
insert into public.faculty_members(source_key,full_name)
select source_key,full_name from supplied
on conflict (source_key) do nothing;

with supplied(source_key, subject_slug) as (values
  ('als-real-faculty-patho-01','pathology'),
  ('als-real-faculty-patho-02','pathology'),
  ('als-real-faculty-patho-03','pathology'),
  ('als-real-faculty-patho-04','pathology'),
  ('als-real-faculty-micro-01','microbiology'),
  ('als-real-faculty-micro-02','microbiology'),
  ('als-real-faculty-micro-03','microbiology'),
  ('als-real-faculty-micro-04','microbiology'),
  ('als-real-faculty-micro-05','microbiology'),
  ('als-real-faculty-bio-01','biochemistry'),
  ('als-real-faculty-bio-02','biochemistry')
)
insert into public.faculty_subject_assignments(faculty_id,subject_id)
select f.id,s.id from supplied x
join public.faculty_members f on f.source_key=x.source_key
join public.subjects s on s.slug=x.subject_slug
on conflict (faculty_id,subject_id) do nothing;

do $$
begin
  if (select count(*) from public.faculty_members where source_key like 'als-real-faculty-%') <> 11
     or (select count(*) from public.faculty_subject_assignments a join public.faculty_members f on f.id=a.faculty_id where f.source_key like 'als-real-faculty-%') <> 11 then
    raise exception 'Real faculty seed does not reconcile to 11 members and 11 subject assignments';
  end if;
end $$;

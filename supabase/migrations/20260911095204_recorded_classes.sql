-- On-demand recordings reuse subjects and canonical syllabus sections (chapters).
create table public.recorded_classes (
 id uuid primary key default gen_random_uuid(),
 subject_id uuid not null references public.subjects(id) on delete restrict,
 chapter_id uuid not null references public.chapters(id) on delete restrict,
 topic_label text check(char_length(topic_label) <= 200),
 subtopic text check(char_length(subtopic) <= 200),
 title text not null check(char_length(btrim(title)) between 1 and 250),
 description text check(char_length(description) <= 10000),
 provider text not null default 'youtube' check(provider = 'youtube'),
 provider_video_id text check(provider_video_id ~ '^[A-Za-z0-9_-]{11}$'),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 sort_order integer not null default 0 check(sort_order >= 0),
 duration_seconds integer check(duration_seconds > 0),
 thumbnail_url text check(thumbnail_url ~ '^https://'),
 teacher_id uuid references public.profiles(id) on delete set null,
 import_key text unique,
 published_at timestamptz,
 created_by uuid references public.profiles(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status <> 'published' or provider_video_id is not null),
 check(provider_video_id is not null or status = 'draft')
);
create index recorded_classes_browse_idx on public.recorded_classes(subject_id,chapter_id,status,sort_order,id);
create index recorded_classes_status_idx on public.recorded_classes(status,updated_at desc);
create index recorded_classes_teacher_idx on public.recorded_classes(teacher_id);
create index recorded_classes_creator_idx on public.recorded_classes(created_by);

-- Source URLs must never be exposed through student REST queries, even select *.
create table private.recorded_class_sources (
 recording_id uuid primary key references public.recorded_classes(id) on delete cascade,
 original_source_url text check(char_length(original_source_url) <= 2048)
);
alter table public.recorded_classes enable row level security;
alter table private.recorded_class_sources enable row level security;
revoke all on public.recorded_classes from public,anon,authenticated;
revoke all on private.recorded_class_sources from public,anon,authenticated;
grant select,insert,update on public.recorded_classes to authenticated;
grant select,insert,update on private.recorded_class_sources to authenticated;
create policy recordings_admin on public.recorded_classes for all to authenticated
 using(public.is_admin()) with check(public.is_admin());
create policy recording_sources_admin on private.recorded_class_sources for all to authenticated
 using(public.is_admin()) with check(public.is_admin());

-- Uses the same program, enrollment, batch and expiry checks as core content.
create function private.recorded_subject_access(target_subject uuid,target_chapter uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and private.active_role()='student' and exists(
 select 1 from public.subjects s join public.chapters c on c.subject_id=s.id
 join public.program_subjects ps on ps.subject_id=s.id
 where s.id=target_subject and c.id=target_chapter and s.status='active' and c.status='active'
 and (c.program_id is null or c.program_id=ps.program_id) and private.enrolled(ps.program_id))
$$;
revoke all on function private.recorded_subject_access(uuid,uuid) from public,anon;
grant execute on function private.recorded_subject_access(uuid,uuid) to authenticated;
create policy recordings_student on public.recorded_classes for select to authenticated
 using(status='published' and provider_video_id is not null and private.recorded_subject_access(subject_id,chapter_id));

create function private.validate_recorded_class() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.chapters c where c.id=new.chapter_id and c.subject_id=new.subject_id)
 then raise exception 'Topic must belong to the selected Subject'; end if;
 if new.teacher_id is not null and not exists(select 1 from public.profiles p where p.id=new.teacher_id and p.role='teacher' and p.is_active)
 then raise exception 'Choose an active Teacher'; end if;
 new.updated_at=now();
 if tg_op='UPDATE' then new.created_at=old.created_at; new.created_by=old.created_by; end if;
 if new.status='published' then new.published_at=coalesce(new.published_at,now()); else new.published_at=null; end if;
 return new;
end $$;
revoke all on function private.validate_recorded_class() from public,anon,authenticated;
create trigger validate_recorded_class before insert or update on public.recorded_classes
 for each row execute function private.validate_recorded_class();

-- Canonical atomic authoring path shared by the Admin UI and client import.
create function public.save_recorded_class(value jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid := coalesce(nullif(value->>'id','')::uuid,gen_random_uuid());
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if value ? 'id' and not exists(select 1 from public.recorded_classes where id=target)
 then raise exception 'Recording no longer exists'; end if;
 insert into public.recorded_classes(id,subject_id,chapter_id,topic_label,subtopic,title,description,provider,provider_video_id,status,sort_order,teacher_id,import_key)
 values(target,(value->>'subject_id')::uuid,(value->>'chapter_id')::uuid,nullif(btrim(value->>'topic_label'),''),nullif(btrim(value->>'subtopic'),''),btrim(value->>'title'),nullif(btrim(value->>'description'),''),coalesce(value->>'provider','youtube'),nullif(value->>'provider_video_id',''),coalesce(value->>'status','draft'),coalesce((value->>'sort_order')::integer,0),nullif(value->>'teacher_id','')::uuid,nullif(value->>'import_key',''))
 on conflict(id) do update set subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_label=excluded.topic_label,subtopic=excluded.subtopic,title=excluded.title,description=excluded.description,provider=excluded.provider,provider_video_id=excluded.provider_video_id,status=excluded.status,sort_order=excluded.sort_order,teacher_id=excluded.teacher_id;
 if value ? 'original_source_url' then
 insert into private.recorded_class_sources(recording_id,original_source_url) values(target,nullif(value->>'original_source_url',''))
 on conflict(recording_id) do update set original_source_url=excluded.original_source_url;
 end if;
 return target;
end $$;
create function public.recorded_class_source(target uuid) returns text language sql stable security invoker set search_path='' as $$
 select original_source_url from private.recorded_class_sources where recording_id=target and public.is_admin()
$$;
revoke all on function public.save_recorded_class(jsonb),public.recorded_class_source(uuid) from public,anon;
grant execute on function public.save_recorded_class(jsonb),public.recorded_class_source(uuid) to authenticated;

-- Private native Recorded Classes backed by Cloudflare R2.
alter table public.recorded_classes drop constraint if exists recorded_classes_provider_check;
alter table public.recorded_classes drop constraint if exists recorded_classes_check;
alter table public.recorded_classes drop constraint if exists recorded_classes_check1;

alter table public.recorded_classes
 add column storage_provider text check(storage_provider is null or storage_provider='r2'),
 add column storage_key text check(storage_key is null or char_length(storage_key) between 1 and 1024),
 add column source_storage_key text check(source_storage_key is null or char_length(source_storage_key) between 1 and 1024),
 add column poster_storage_key text check(poster_storage_key is null or char_length(poster_storage_key) between 1 and 1024),
 add column mime_type text check(mime_type is null or mime_type='video/mp4'),
 add column file_size bigint check(file_size is null or file_size > 0),
 add column width integer check(width is null or width > 0),
 add column height integer check(height is null or height > 0),
 add column checksum_sha256 text check(checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
 add column original_provider text check(original_provider is null or original_provider='youtube'),
 add column original_provider_video_id text check(original_provider_video_id is null or original_provider_video_id ~ '^[A-Za-z0-9_-]{11}$'),
 add constraint recorded_classes_provider_check check(provider in ('youtube','native')),
 add constraint recorded_classes_playback_check check(
   status='draft' or
   (provider='youtube' and provider_video_id is not null) or
   (provider='native' and storage_provider='r2' and storage_key is not null)
 ),
 add constraint recorded_classes_native_metadata_check check(
   provider<>'native' or status='draft' or
   (storage_provider='r2' and storage_key is not null and mime_type='video/mp4' and file_size is not null and duration_seconds is not null)
 );

drop policy if exists recordings_student on public.recorded_classes;
create policy recordings_student on public.recorded_classes for select to authenticated
 using(status='published' and
   ((provider='youtube' and provider_video_id is not null) or
    (provider='native' and storage_provider='r2' and storage_key is not null)) and
   private.recorded_subject_access(subject_id,chapter_id));

create table public.recorded_class_interactions (
 id uuid primary key default gen_random_uuid(),
 recorded_class_id uuid not null references public.recorded_classes(id) on delete cascade,
 timestamp_seconds integer not null check(timestamp_seconds >= 0),
 question text not null check(char_length(btrim(question)) between 1 and 2000),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 8),
 correct_option integer not null check(correct_option >= 0),
 explanation text check(char_length(explanation) <= 5000),
 required_before_continue boolean not null default true,
 allow_retry boolean not null default false,
 show_explanation_after_answer boolean not null default true,
 sort_order integer not null default 0 check(sort_order >= 0),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_by uuid references public.profiles(id) on delete set null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(correct_option < jsonb_array_length(options))
);
create index recorded_class_interactions_order_idx on public.recorded_class_interactions(recorded_class_id,status,timestamp_seconds,sort_order,id);

create table public.recorded_class_progress (
 student_id uuid not null references public.profiles(id) on delete cascade,
 recorded_class_id uuid not null references public.recorded_classes(id) on delete cascade,
 last_position_seconds numeric(12,3) not null default 0 check(last_position_seconds >= 0),
 percentage_completed numeric(6,3) not null default 0 check(percentage_completed between 0 and 100),
 last_opened_at timestamptz not null default now(),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(student_id,recorded_class_id)
);

create table public.recorded_class_responses (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id) on delete cascade,
 recorded_class_id uuid not null references public.recorded_classes(id) on delete cascade,
 interaction_id uuid not null references public.recorded_class_interactions(id) on delete cascade,
 selected_option integer not null check(selected_option >= 0),
 is_correct boolean not null,
 attempt_number integer not null check(attempt_number > 0),
 answered_at timestamptz not null default now(),
 unique(student_id,interaction_id,attempt_number)
);
create index recorded_class_responses_lookup_idx on public.recorded_class_responses(student_id,recorded_class_id,interaction_id,answered_at desc);

create table private.recorded_class_uploads (
 id uuid primary key default gen_random_uuid(),
 recorded_class_id uuid not null references public.recorded_classes(id) on delete cascade,
 object_key text not null,
 upload_id text not null,
 content_type text not null check(content_type='video/mp4'),
 file_size bigint not null check(file_size > 0),
 created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 aborted_at timestamptz
);

alter table public.recorded_class_interactions enable row level security;
alter table public.recorded_class_progress enable row level security;
alter table public.recorded_class_responses enable row level security;
alter table private.recorded_class_uploads enable row level security;
revoke all on public.recorded_class_interactions,public.recorded_class_progress,public.recorded_class_responses from public,anon,authenticated;
revoke all on private.recorded_class_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.recorded_class_interactions to authenticated;
grant select on public.recorded_class_progress,public.recorded_class_responses to authenticated;
grant select,insert,update on private.recorded_class_uploads to authenticated;

create policy recorded_interactions_admin on public.recorded_class_interactions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy recorded_progress_own_read on public.recorded_class_progress for select to authenticated
 using(public.is_admin() or (student_id=(select auth.uid()) and private.recorded_subject_access(
   (select subject_id from public.recorded_classes where id=recorded_class_id),
   (select chapter_id from public.recorded_classes where id=recorded_class_id))));
create policy recorded_responses_own_read on public.recorded_class_responses for select to authenticated
 using(public.is_admin() or student_id=(select auth.uid()));
create policy recorded_uploads_admin on private.recorded_class_uploads for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.recorded_class_payload(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.recorded_classes; uid uuid := auth.uid();
begin
 select * into r from public.recorded_classes where id=target;
 if uid is null or r.id is null or r.status<>'published' or not private.recorded_subject_access(r.subject_id,r.chapter_id)
 then raise exception 'Recording unavailable' using errcode='42501'; end if;
 return jsonb_build_object(
  'recording',jsonb_build_object('id',r.id,'provider',r.provider,'storage_provider',r.storage_provider,'duration_seconds',r.duration_seconds,'poster',r.poster_storage_key is not null),
  'interactions',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'timestamp_seconds',i.timestamp_seconds,'question',i.question,'options',i.options,'required_before_continue',i.required_before_continue,'allow_retry',i.allow_retry,'show_explanation_after_answer',i.show_explanation_after_answer) order by i.timestamp_seconds,i.sort_order,i.id),'[]'::jsonb) from public.recorded_class_interactions i where i.recorded_class_id=r.id and i.status='published'),
  'responses',(select coalesce(jsonb_agg(jsonb_build_object('interaction_id',x.interaction_id,'selected_option',x.selected_option,'is_correct',x.is_correct,'attempt_number',x.attempt_number,'answered_at',x.answered_at) order by x.answered_at),'[]'::jsonb) from public.recorded_class_responses x where x.recorded_class_id=r.id and x.student_id=uid),
  'progress',(select to_jsonb(p) from public.recorded_class_progress p where p.student_id=uid and p.recorded_class_id=r.id)
 );
end $$;

create or replace function public.save_recorded_class_progress(target uuid,position_seconds numeric,duration_seconds numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.recorded_classes; uid uuid:=auth.uid(); pct numeric; done boolean;
begin
 select * into r from public.recorded_classes where id=target;
 if uid is null or r.id is null or r.status<>'published' or not private.recorded_subject_access(r.subject_id,r.chapter_id)
 then raise exception 'Recording unavailable' using errcode='42501'; end if;
 if duration_seconds is null or duration_seconds <= 0 then raise exception 'Invalid duration'; end if;
 position_seconds:=greatest(0,least(position_seconds,duration_seconds));
 pct:=least(100,round(position_seconds*100/duration_seconds,3));
 done:=pct>=95 and not exists(
  select 1 from public.recorded_class_interactions i where i.recorded_class_id=target and i.status='published' and i.required_before_continue
  and i.timestamp_seconds<=position_seconds and not exists(select 1 from public.recorded_class_responses x where x.student_id=uid and x.interaction_id=i.id)
 );
 insert into public.recorded_class_progress(student_id,recorded_class_id,last_position_seconds,percentage_completed,last_opened_at,completed_at,updated_at)
 values(uid,target,position_seconds,pct,now(),case when done then now() end,now())
 on conflict(student_id,recorded_class_id) do update set last_position_seconds=excluded.last_position_seconds,percentage_completed=greatest(public.recorded_class_progress.percentage_completed,excluded.percentage_completed),last_opened_at=now(),completed_at=coalesce(public.recorded_class_progress.completed_at,excluded.completed_at),updated_at=now();
 return (select to_jsonb(p) from public.recorded_class_progress p where p.student_id=uid and p.recorded_class_id=target);
end $$;

create or replace function public.answer_recorded_class_interaction(target uuid,selected integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.recorded_class_interactions; r public.recorded_classes; uid uuid:=auth.uid(); attempt integer; correct boolean;
begin
 select * into i from public.recorded_class_interactions where id=target and status='published';
 select * into r from public.recorded_classes where id=i.recorded_class_id and status='published';
 if uid is null or i.id is null or r.id is null or not private.recorded_subject_access(r.subject_id,r.chapter_id)
 then raise exception 'Interaction unavailable' using errcode='42501'; end if;
 if selected < 0 or selected >= jsonb_array_length(i.options) then raise exception 'Invalid option'; end if;
 select coalesce(max(attempt_number),0)+1 into attempt from public.recorded_class_responses where student_id=uid and interaction_id=i.id;
 if attempt>1 and not i.allow_retry then raise exception 'Retry is not allowed'; end if;
 correct:=selected=i.correct_option;
 insert into public.recorded_class_responses(student_id,recorded_class_id,interaction_id,selected_option,is_correct,attempt_number)
 values(uid,r.id,i.id,selected,correct,attempt);
 return jsonb_build_object('is_correct',correct,'attempt_number',attempt,'explanation',case when i.show_explanation_after_answer then i.explanation else null end);
end $$;

revoke all on function public.recorded_class_payload(uuid),public.save_recorded_class_progress(uuid,numeric,numeric),public.answer_recorded_class_interaction(uuid,integer) from public,anon;
grant execute on function public.recorded_class_payload(uuid),public.save_recorded_class_progress(uuid,numeric,numeric),public.answer_recorded_class_interaction(uuid,integer) to authenticated;

create or replace function public.save_recorded_class(value jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare target uuid := coalesce(nullif(value->>'id','')::uuid,gen_random_uuid());
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if value ? 'id' and not exists(select 1 from public.recorded_classes where id=target) then raise exception 'Recording no longer exists'; end if;
 insert into public.recorded_classes(id,subject_id,chapter_id,topic_label,subtopic,title,description,provider,provider_video_id,status,sort_order,teacher_id,import_key,storage_provider,storage_key,source_storage_key,poster_storage_key,mime_type,file_size,width,height,duration_seconds,checksum_sha256,original_provider,original_provider_video_id)
 values(target,(value->>'subject_id')::uuid,(value->>'chapter_id')::uuid,nullif(btrim(value->>'topic_label'),''),nullif(btrim(value->>'subtopic'),''),btrim(value->>'title'),nullif(btrim(value->>'description'),''),coalesce(value->>'provider','youtube'),nullif(value->>'provider_video_id',''),coalesce(value->>'status','draft'),coalesce((value->>'sort_order')::integer,0),nullif(value->>'teacher_id','')::uuid,nullif(value->>'import_key',''),nullif(value->>'storage_provider',''),nullif(value->>'storage_key',''),nullif(value->>'source_storage_key',''),nullif(value->>'poster_storage_key',''),nullif(value->>'mime_type',''),nullif(value->>'file_size','')::bigint,nullif(value->>'width','')::integer,nullif(value->>'height','')::integer,nullif(value->>'duration_seconds','')::integer,nullif(lower(value->>'checksum_sha256'),''),nullif(value->>'original_provider',''),nullif(value->>'original_provider_video_id',''))
 on conflict(id) do update set subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,topic_label=excluded.topic_label,subtopic=excluded.subtopic,title=excluded.title,description=excluded.description,provider=excluded.provider,provider_video_id=excluded.provider_video_id,status=excluded.status,sort_order=excluded.sort_order,teacher_id=excluded.teacher_id,storage_provider=excluded.storage_provider,storage_key=excluded.storage_key,source_storage_key=excluded.source_storage_key,poster_storage_key=excluded.poster_storage_key,mime_type=excluded.mime_type,file_size=excluded.file_size,width=excluded.width,height=excluded.height,duration_seconds=excluded.duration_seconds,checksum_sha256=excluded.checksum_sha256,original_provider=coalesce(excluded.original_provider,public.recorded_classes.original_provider),original_provider_video_id=coalesce(excluded.original_provider_video_id,public.recorded_classes.original_provider_video_id);
 if value ? 'original_source_url' then insert into private.recorded_class_sources(recording_id,original_source_url) values(target,nullif(value->>'original_source_url','')) on conflict(recording_id) do update set original_source_url=excluded.original_source_url; end if;
 return target;
end $$;

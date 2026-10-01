-- Actual engaged native playback, independent of resume/completion.
create table public.playback_watch_events (
 student_id uuid not null references public.profiles(id) on delete cascade,
 event_id uuid not null,
 content_kind text not null check(content_kind in ('lesson','recorded_class')),
 content_id uuid not null,
 started_at timestamptz not null,
 ended_at timestamptz not null,
 elapsed_seconds numeric(8,3) not null check(elapsed_seconds between 0 and 30),
 primary key(student_id,event_id),
 check(ended_at > started_at and ended_at <= started_at + interval '30 seconds')
);
create index playback_watch_events_student_time on public.playback_watch_events(student_id,ended_at);
alter table public.playback_watch_events enable row level security;
revoke all on public.playback_watch_events from public,anon,authenticated;
grant select on public.playback_watch_events to authenticated;
create policy playback_watch_own on public.playback_watch_events for select to authenticated
 using(student_id=(select auth.uid()) and private.active_role()='student');

create function public.record_playback_watch_interval(event_id uuid,content_kind text,content_id uuid,
 started_at timestamptz,ended_at timestamptz,elapsed_seconds numeric) returns numeric
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); accepted numeric; overlap_seconds numeric; r public.recorded_classes; wall numeric;
begin
 if uid is null or private.active_role()<>'student' then raise exception 'Student playback required' using errcode='42501'; end if;
 if event_id is null or content_id is null or content_kind not in ('lesson','recorded_class')
  or started_at is null or ended_at is null or elapsed_seconds is null
  or elapsed_seconds::text in ('NaN','Infinity','-Infinity')
  or ended_at<=started_at or ended_at>started_at+interval '30 seconds'
  or ended_at>clock_timestamp()+interval '2 seconds' or started_at<clock_timestamp()-interval '5 minutes'
  or elapsed_seconds<=0 or elapsed_seconds>30 then raise exception 'Invalid playback interval'; end if;
 if content_kind='lesson' then
  if not exists(select 1 from public.learning_content c where c.id=content_id and c.status='active'
   and c.kind in ('video','recording') and private.content_access(c.id)) then
   raise exception 'Lesson unavailable' using errcode='42501'; end if;
 else
  select * into r from public.recorded_classes c where c.id=content_id;
  if r.id is null or r.status<>'published' or r.provider<>'native' or not private.recorded_subject_access(r.subject_id,r.chapter_id)
   then raise exception 'Recording unavailable' using errcode='42501'; end if;
 end if;
 -- One allocation per Student across simultaneous tabs; retries return the prior allocation.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,871));
 select e.elapsed_seconds into accepted from public.playback_watch_events e where e.student_id=uid and e.event_id=record_playback_watch_interval.event_id;
 if found then return accepted; end if;
 wall:=extract(epoch from ended_at-started_at);
 select coalesce(sum(extract(epoch from least(e.ended_at,record_playback_watch_interval.ended_at)-greatest(e.started_at,record_playback_watch_interval.started_at))),0)
 into overlap_seconds from public.playback_watch_events e where e.student_id=uid
 and e.started_at<record_playback_watch_interval.ended_at and e.ended_at>record_playback_watch_interval.started_at;
 accepted:=greatest(0,least(elapsed_seconds,wall)-overlap_seconds);
 insert into public.playback_watch_events values(uid,event_id,content_kind,content_id,started_at,ended_at,accepted);
 return accepted;
end $$;
revoke all on function public.record_playback_watch_interval(uuid,text,uuid,timestamptz,timestamptz,numeric) from public,anon,service_role;
grant execute on function public.record_playback_watch_interval(uuid,text,uuid,timestamptz,timestamptz,numeric) to authenticated;


-- Focused LMS maintenance; caller owns the migration transaction. No credential changes.
-- All relationships remain UUID foreign keys; never infer batch identity from a name.
create table public.live_batch_subjects (
  batch_id uuid not null references public.batches(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  primary key(batch_id,subject_id)
);
alter table public.live_batch_subjects enable row level security;
revoke all on public.live_batch_subjects from public,anon,authenticated;
grant select,insert,update,delete on public.live_batch_subjects to authenticated;
create policy live_batch_subjects_admin on public.live_batch_subjects to authenticated using(public.is_admin()) with check(public.is_admin());
create policy live_batch_subjects_teacher_read on public.live_batch_subjects for select to authenticated using(
  private.active_role()='teacher' and exists(select 1 from public.batch_faculty f where f.batch_id=live_batch_subjects.batch_id and f.faculty_id=(select auth.uid())));

-- Existing explicit Teacher+Program/Subject assignments are the only backfill source.
insert into public.live_batch_subjects(batch_id,subject_id)
select distinct b.id,ps.subject_id from public.batches b
join public.batch_faculty bf on bf.batch_id=b.id
join public.program_subjects ps on ps.program_id=b.program_id
join public.faculty_assignments f on f.faculty_id=bf.faculty_id
  and (f.program_id is null or f.program_id=b.program_id)
  and (f.subject_id is null or f.subject_id=ps.subject_id)
on conflict do nothing;

create function public.teacher_can_schedule_batch(target_batch uuid,target_program uuid,target_subject uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.batches b join public.programs p on p.id=b.program_id
   where b.id=target_batch and b.program_id=target_program and b.status='active' and p.status='active'
   and (b.ends_on is null or b.ends_on>=(now() at time zone 'Asia/Dubai')::date)
   and (b.access_expires_at is null or b.access_expires_at>now())
   and (b.access_valid_until is null or b.access_valid_until>=(now() at time zone 'Asia/Dubai')::date)
   and exists(select 1 from public.program_subjects ps where ps.program_id=p.id and ps.subject_id=target_subject)
   and (public.is_admin() or (public.teacher_has_live_assignment(target_program,target_subject)
     and exists(select 1 from public.batch_faculty bf where bf.batch_id=b.id and bf.faculty_id=(select auth.uid()))
     and exists(select 1 from public.live_batch_subjects bs where bs.batch_id=b.id and bs.subject_id=target_subject))))
$$;
revoke all on function public.teacher_can_schedule_batch(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.teacher_can_schedule_batch(uuid,uuid,uuid) to authenticated;

create function public.live_class_state(status_value public.session_status,join_open timestamptz,ended timestamptz)
returns text language sql stable security invoker set search_path='' as $$
 select case when status_value='cancelled' then 'cancelled' when status_value='completed' or ended is not null then 'ended'
   when status_value='live' then 'live' when status_value='scheduled' and join_open<=now() then 'join_window_open'
   when status_value='scheduled' then 'scheduled' else 'draft' end
$$;
revoke all on function public.live_class_state(public.session_status,timestamptz,timestamptz) from public,anon,service_role;
grant execute on function public.live_class_state(public.session_status,timestamptz,timestamptz) to authenticated;

alter table public.live_sessions add column started_at timestamptz;

-- Current access and historical classroom access are deliberately different operations.
-- Replay/history remains available for an enrolled Student who belonged at the actual class time.
create function private.live_class_scope(target_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.live_sessions s join public.profiles p on p.id=(select auth.uid()) and p.is_active
 where s.id=target_session and (p.role='admin' or (p.role='teacher' and s.faculty_id=p.id and public.teacher_has_live_assignment(s.program_id,s.subject_id))
 or (p.role='student' and s.status<>'cancelled'
   and not exists(select 1 from public.live_participants lp where lp.session_id=s.id and lp.user_id=p.id and lp.removed_at is not null)
   and (private.enrolled(s.program_id,s.batch_id) or (s.status='completed'
     and private.enrolled(s.program_id) and exists(select 1 from public.student_batch_history h
       where h.student_id=p.id and h.program_id=s.program_id and h.batch_id=s.batch_id
       and h.effective_at<=coalesce(s.started_at,s.starts_at,s.created_at)
       and (h.ended_at is null or h.ended_at>coalesce(s.started_at,s.starts_at,s.created_at))))))))
$$;
revoke all on function private.live_class_scope(uuid) from public,anon,authenticated;
-- Keep the established can_join_live signature for existing recording/chat RLS.
create or replace function public.can_join_live(target_session uuid) returns boolean
language sql stable security definer set search_path='' as $$ select private.live_class_scope(target_session) $$;

create function public.live_class_eligibility(target_session uuid,operation text default 'view') returns boolean
language sql stable security definer set search_path='' as $$
 select operation in ('view','connect','playback') and private.live_class_scope(target_session)
   and exists(select 1 from public.live_sessions s where s.id=target_session
     and case operation when 'connect' then public.live_class_state(s.status,s.join_opens_at,s.ended_at)='live'
       and (private.active_role()<>'student' or private.enrolled(s.program_id,s.batch_id))
       when 'playback' then s.status<>'cancelled' else true end)
$$;
revoke all on function public.live_class_eligibility(uuid,text) from public,anon,service_role;
grant execute on function public.live_class_eligibility(uuid,text) to authenticated;

drop policy live_sessions_scoped_read on public.live_sessions;
create policy live_sessions_scoped_read on public.live_sessions for select to authenticated using(public.live_class_eligibility(id,'view'));
drop policy live_sessions_authorized_insert on public.live_sessions;
create policy live_sessions_authorized_insert on public.live_sessions for insert to authenticated
with check((public.is_admin() or faculty_id=(select auth.uid())) and public.teacher_can_schedule_batch(batch_id,program_id,subject_id));

-- Validate direct writes as well as application scheduling. Historical terminal
-- records are left untouched; mutable academic scope cannot bypass the selector.
create function private.live_batch_scope_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.batch_id is distinct from old.batch_id or new.program_id is distinct from old.program_id
   or new.subject_id is distinct from old.subject_id or new.faculty_id is distinct from old.faculty_id
   or (new.status='live' and old.status is distinct from new.status) then
   if not exists(select 1 from public.batches b where b.id=new.batch_id and b.program_id=new.program_id) then
     raise exception 'Select a compatible canonical Batch' using errcode='23514'; end if;
   if auth.uid() is not null and not public.teacher_can_schedule_batch(new.batch_id,new.program_id,new.subject_id) then
     raise exception 'An active assigned Batch and Subject are required' using errcode='42501'; end if;
 end if;
 if new.status='live' and (tg_op='INSERT' or old.status<>'live') then new.started_at:=clock_timestamp(); end if;
 return new;
end $$;
revoke all on function private.live_batch_scope_guard() from public,anon,authenticated;
create trigger live_batch_scope_guard before insert or update on public.live_sessions for each row execute function private.live_batch_scope_guard();

-- Exact distinct current occupancy, not enrollment-row count or historical membership.
create function private.batch_occupancy(target_batch uuid,at_time timestamptz,exclude_student uuid default null)
returns bigint language sql volatile security definer set search_path='' as $$
 select count(distinct e.student_id) from public.enrollments e join public.profiles p on p.id=e.student_id and p.is_active and p.role='student'
 where e.batch_id=target_batch and e.status='active' and e.student_id is distinct from exclude_student
   and (e.access_starts_at is null or e.access_starts_at<=at_time) and (e.access_expires_at is null or e.access_expires_at>at_time)
   and exists(select 1 from public.student_batch_history h where h.enrollment_id=e.id and h.batch_id=e.batch_id
     and h.effective_at<=at_time and (h.ended_at is null or h.ended_at>at_time))
$$;
revoke all on function private.batch_occupancy(uuid,timestamptz,uuid) from public,anon,authenticated;
create function public.lms_batch_occupancy() returns table(batch_id uuid,occupied bigint,capacity integer)
language sql stable security definer set search_path='' as $$
 select b.id,private.batch_occupancy(b.id,now()),b.max_students from public.batches b where public.is_admin()
$$;
revoke all on function public.lms_batch_occupancy() from public,anon,service_role;
grant execute on function public.lms_batch_occupancy() to authenticated;

create or replace function private.lms_enrollment_capacity_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare batch public.batches;
begin
 if new.batch_id is null or new.status<>'active' then return new; end if;
 if tg_op='UPDATE' and old.student_id=new.student_id and old.program_id=new.program_id
   and old.batch_id is not distinct from new.batch_id and old.status=new.status
   and old.access_starts_at is not distinct from new.access_starts_at and old.access_expires_at is not distinct from new.access_expires_at then return new; end if;
 select * into batch from public.batches where id=new.batch_id for update;
 if not found or batch.program_id<>new.program_id then raise exception 'Select a compatible batch' using errcode='23514'; end if;
 if batch.status not in ('active','upcoming') then raise exception 'This batch is closed' using errcode='23514'; end if;
 if exists(select 1 from public.profiles where id=new.student_id and is_active)
   and (new.access_starts_at is null or new.access_starts_at<=now()) and (new.access_expires_at is null or new.access_expires_at>now())
   and batch.max_students is not null and private.batch_occupancy(batch.id,now(),new.student_id)>=batch.max_students then
   raise exception 'This batch is full. Choose another compatible batch.' using errcode='23514'; end if;
 return new;
end $$;
-- Reactivation also consumes a seat and must take the same batch lock.
create function private.lms_reactivation_capacity_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare batch record;
begin
 if new.role='student' and new.is_active and not old.is_active then
   for batch in select b.id,b.max_students from public.batches b join public.enrollments e on e.batch_id=b.id
     where e.student_id=new.id and e.status='active' and (e.access_starts_at is null or e.access_starts_at<=now())
       and (e.access_expires_at is null or e.access_expires_at>now()) order by b.id for update of b loop
     if batch.max_students is not null and private.batch_occupancy(batch.id,now(),new.id)>=batch.max_students then
       raise exception 'This batch is full. Reactivation was not applied.' using errcode='23514'; end if;
   end loop;
 end if; return new;
end $$;
revoke all on function private.lms_reactivation_capacity_guard() from public,anon,authenticated;
create trigger a_lms_reactivation_capacity_guard before update on public.profiles for each row execute function private.lms_reactivation_capacity_guard();

create or replace function public.lms_transfer_student(target_enrollment uuid,new_batch uuid,effective_at timestamptz,note text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare enrollment public.enrollments; batch public.batches; history_start timestamptz;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select * into enrollment from public.enrollments where id=target_enrollment for update;
 if not found or enrollment.status<>'active' then raise exception 'Choose an active enrollment'; end if;
 if new_batch is not distinct from enrollment.batch_id then raise exception 'This student is already assigned to this batch.'; end if;
 if note is null or length(btrim(note)) not between 1 and 1000 then raise exception 'Enter a transfer reason (1–1000 characters)'; end if;
 select * into batch from public.batches where id=new_batch and program_id=enrollment.program_id and status='active' for update;
 if not found then raise exception 'Choose an active batch in the same Program'; end if;
 select h.effective_at into history_start from public.student_batch_history h where h.enrollment_id=enrollment.id and h.ended_at is null;
 -- Future transfers remain explicit unsupported operations, never early access changes.
 if effective_at is null or effective_at>now() or effective_at<coalesce(history_start,enrollment.access_starts_at) then
   raise exception 'Effective date must be between the current assignment start and now; future transfers must be confirmed when effective'; end if;
 perform set_config('als.transfer_enrollment',enrollment.id::text,true);
 perform set_config('als.transfer_at',effective_at::text,true);
 perform set_config('als.change_reason',btrim(note),true);
 update public.enrollments set batch_id=new_batch,updated_at=clock_timestamp() where id=enrollment.id;
 return enrollment.id;
end $$;

-- The batch editor and assignments commit together; failure never leaves half an assignment.
create function public.lms_save_batch(value jsonb,subject_ids uuid[],teacher_ids uuid[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare target uuid:=(value->>'id')::uuid; program uuid:=(value->>'program_id')::uuid;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if exists(select 1 from unnest(subject_ids) s where not exists(select 1 from public.program_subjects ps where ps.program_id=program and ps.subject_id=s)) then
   raise exception 'Batch subjects must belong to the selected Program'; end if;
 if exists(select 1 from unnest(teacher_ids) t where not exists(select 1 from public.profiles p where p.id=t and p.role='teacher' and p.is_active)) then
   raise exception 'Select active Teacher login accounts'; end if;
 if exists(select 1 from public.batches b where b.id=target and b.program_id<>program) and
   (exists(select 1 from public.enrollments where batch_id=target) or exists(select 1 from public.live_sessions where batch_id=target)) then
   raise exception 'A referenced Batch cannot move to a different Program'; end if;
 insert into public.batches(id,name,slug,batch_code,program_id,status,starts_on,ends_on,access_starts_at,access_expires_at,max_students,schedule)
 values(target,btrim(value->>'name'),value->>'slug',value->>'batch_code',program,(value->>'status')::public.batch_status,
   nullif(value->>'starts_on','')::date,nullif(value->>'ends_on','')::date,nullif(value->>'access_starts_at','')::timestamptz,
   nullif(value->>'access_expires_at','')::timestamptz,nullif(value->>'max_students','')::integer,coalesce(value->'schedule','[]'))
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,batch_code=excluded.batch_code,program_id=excluded.program_id,status=excluded.status,
   starts_on=excluded.starts_on,ends_on=excluded.ends_on,access_starts_at=excluded.access_starts_at,access_expires_at=excluded.access_expires_at,
   max_students=excluded.max_students,schedule=excluded.schedule,updated_at=clock_timestamp();
 delete from public.live_batch_subjects where batch_id=target and not(subject_id=any(subject_ids));
 insert into public.live_batch_subjects select target,unnest(subject_ids) on conflict do nothing;
 delete from public.batch_faculty where batch_id=target and not(faculty_id=any(teacher_ids));
 insert into public.batch_faculty select target,unnest(teacher_ids) on conflict do nothing;
 return target;
end $$;
revoke all on function public.lms_save_batch(jsonb,uuid[],uuid[]) from public,anon,service_role;
grant execute on function public.lms_save_batch(jsonb,uuid[],uuid[]) to authenticated;
create trigger lms_batch_audit after insert or update on public.batches for each row execute function private.lms_audit();

-- Enforce Program compatibility independently of UI and RLS. Preflight must be clean.
create unique index batches_id_program_unique on public.batches(id,program_id);
alter table public.enrollments add constraint enrollments_batch_program_fk foreign key(batch_id,program_id) references public.batches(id,program_id) on delete restrict not valid;
alter table public.enrollments validate constraint enrollments_batch_program_fk;
alter table public.live_sessions add constraint live_sessions_batch_program_fk foreign key(batch_id,program_id) references public.batches(id,program_id) on delete restrict not valid;
alter table public.live_sessions validate constraint live_sessions_batch_program_fk;
alter table public.student_batch_history add constraint student_history_batch_program_fk foreign key(batch_id,program_id) references public.batches(id,program_id) on delete restrict not valid;
alter table public.student_batch_history validate constraint student_history_batch_program_fk;

create function public.live_scheduling_batches() returns table(id uuid,name text,program_id uuid,batch_code text,subject_ids uuid[])
language sql stable security invoker set search_path='' as $$
 select b.id,b.name,b.program_id,b.batch_code,array(select ps.subject_id from public.program_subjects ps
   where ps.program_id=b.program_id and public.teacher_can_schedule_batch(b.id,b.program_id,ps.subject_id))
 from public.batches b where exists(select 1 from public.program_subjects ps where ps.program_id=b.program_id
   and public.teacher_can_schedule_batch(b.id,b.program_id,ps.subject_id)) order by b.name,b.id
$$;
revoke all on function public.live_scheduling_batches() from public,anon,service_role;
grant execute on function public.live_scheduling_batches() to authenticated;

-- All new transport and attendance writes use the exact same connect predicate.
create policy live_connections_current_eligibility on public.live_media_connections as restrictive for insert to authenticated
  with check(public.live_class_eligibility(session_id,'connect'));
create policy live_connections_active_eligibility on public.live_media_connections as restrictive for update to authenticated
  using(true) with check(status not in ('active','reconnecting') or public.live_class_eligibility(session_id,'connect'));
create policy live_attendance_current_eligibility on public.live_attendance_intervals as restrictive for insert to authenticated
  with check(public.live_class_eligibility(session_id,'connect'));
create policy live_publication_current_eligibility on public.live_published_tracks as restrictive for insert to authenticated
  with check(public.live_class_eligibility(session_id,'connect'));
create policy live_subscription_current_eligibility on public.live_track_subscriptions as restrictive for insert to authenticated
  with check(public.live_class_eligibility(session_id,'connect'));

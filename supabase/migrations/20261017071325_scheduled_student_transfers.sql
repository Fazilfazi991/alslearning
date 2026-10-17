-- Future transfers stay pending. Current enrollment/history changes only when
-- the scheduled transaction runs at or after the requested effective instant.
create table public.student_batch_transfers (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id) on delete restrict,
 enrollment_id uuid not null references public.enrollments(id) on delete restrict,
 program_id uuid not null references public.programs(id) on delete restrict,
 from_batch_id uuid references public.batches(id) on delete restrict,
 to_batch_id uuid not null references public.batches(id) on delete restrict,
 effective_at timestamptz not null,reason text not null check(length(btrim(reason)) between 1 and 1000),
 actor_id uuid not null references public.profiles(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','applied','failed','cancelled')),
 created_at timestamptz not null default clock_timestamp(),applied_at timestamptz,failure_reason text,
 foreign key(to_batch_id,program_id) references public.batches(id,program_id) on delete restrict
);
create unique index student_transfer_one_pending on public.student_batch_transfers(enrollment_id) where status='pending';
create index student_transfer_due on public.student_batch_transfers(effective_at,id) where status='pending';
alter table public.student_batch_transfers enable row level security;
revoke all on public.student_batch_transfers from public,anon,authenticated,service_role;
grant select on public.student_batch_transfers to authenticated;
create policy student_transfer_read on public.student_batch_transfers for select to authenticated using(
 public.is_admin() or (student_id=(select auth.uid()) and private.active_role()='student'));
create trigger lms_scheduled_transfer_audit after insert or update on public.student_batch_transfers for each row execute function private.lms_audit();

create function private.lms_apply_transfer(target_enrollment uuid,new_batch uuid,at_time timestamptz,note text,actor uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare enrollment public.enrollments; batch public.batches; history_start timestamptz;
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin' and is_active) then raise exception 'Active Admin required' using errcode='42501'; end if;
 select * into enrollment from public.enrollments where id=target_enrollment for update;
 if not found or enrollment.status<>'active' then raise exception 'Choose an active enrollment'; end if;
 if new_batch is not distinct from enrollment.batch_id then raise exception 'This student is already assigned to this batch.'; end if;
 if note is null or length(btrim(note)) not between 1 and 1000 then raise exception 'Enter a transfer reason (1–1000 characters)'; end if;
 select * into batch from public.batches where id=new_batch and program_id=enrollment.program_id and status='active' for update;
 if not found then raise exception 'Choose an active batch in the same Program'; end if;
 if (batch.access_expires_at is not null and batch.access_expires_at<=now()) or (batch.access_valid_until is not null and batch.access_valid_until<(now() at time zone 'Asia/Dubai')::date) then raise exception 'Target batch access has expired'; end if;
 select h.effective_at into history_start from public.student_batch_history h where h.enrollment_id=enrollment.id and h.ended_at is null;
 if at_time is null or at_time>clock_timestamp() or at_time<coalesce(history_start,enrollment.access_starts_at) then raise exception 'Choose a valid effective transfer time'; end if;
 perform set_config('als.admission_actor',actor::text,true);
 perform set_config('als.transfer_enrollment',enrollment.id::text,true);
 perform set_config('als.transfer_at',at_time::text,true);
 perform set_config('als.change_reason',btrim(note),true);
 update public.enrollments set batch_id=new_batch,updated_at=clock_timestamp() where id=enrollment.id;
 return enrollment.id;
end $$;
revoke all on function private.lms_apply_transfer(uuid,uuid,timestamptz,text,uuid) from public,anon,authenticated,service_role;

create or replace function public.lms_transfer_student(target_enrollment uuid,new_batch uuid,effective_at timestamptz,note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare enrollment public.enrollments;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select * into enrollment from public.enrollments where id=target_enrollment for update;
 if not found or enrollment.status<>'active' then raise exception 'Choose an active enrollment'; end if;
 if new_batch is not distinct from enrollment.batch_id then raise exception 'This student is already assigned to this batch.'; end if;
 if exists(select 1 from public.student_batch_transfers where enrollment_id=target_enrollment and status='pending') then raise exception 'Cancel the pending transfer before creating another'; end if;
 if note is null or length(btrim(note)) not between 1 and 1000 then raise exception 'Enter a transfer reason (1–1000 characters)'; end if;
 if effective_at is null then raise exception 'Enter an effective transfer date'; end if;
 if not exists(select 1 from public.batches b where b.id=new_batch and b.program_id=enrollment.program_id and b.status='active') then raise exception 'Choose an active batch in the same Program'; end if;
 if effective_at>clock_timestamp() then
   insert into public.student_batch_transfers(student_id,enrollment_id,program_id,from_batch_id,to_batch_id,effective_at,reason,actor_id)
   values(enrollment.student_id,enrollment.id,enrollment.program_id,enrollment.batch_id,new_batch,effective_at,btrim(note),auth.uid());
   return enrollment.id;
 end if;
 return private.lms_apply_transfer(target_enrollment,new_batch,effective_at,note,auth.uid());
end $$;
revoke all on function public.lms_transfer_student(uuid,uuid,timestamptz,text) from public,anon,service_role;
grant execute on function public.lms_transfer_student(uuid,uuid,timestamptz,text) to authenticated;

create function public.lms_cancel_student_transfer(target_transfer uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 perform set_config('als.change_reason','Admin cancelled scheduled batch transfer',true);
 update public.student_batch_transfers set status='cancelled' where id=target_transfer and status='pending';
 return found;
end $$;
revoke all on function public.lms_cancel_student_transfer(uuid) from public,anon,service_role;
grant execute on function public.lms_cancel_student_transfer(uuid) to authenticated;

create function private.lms_apply_due_transfers() returns integer
language plpgsql security definer set search_path='' as $$
declare item public.student_batch_transfers; current_batch uuid; applied integer:=0;
begin
 for item in select * from public.student_batch_transfers where status='pending' and effective_at<=clock_timestamp()
   order by effective_at,id limit 50 for update skip locked loop
   begin
     select batch_id into current_batch from public.enrollments where id=item.enrollment_id for update;
     if current_batch is distinct from item.from_batch_id then raise exception 'Current assignment changed'; end if;
     perform private.lms_apply_transfer(item.enrollment_id,item.to_batch_id,item.effective_at,item.reason,item.actor_id);
     update public.student_batch_transfers set status='applied',applied_at=clock_timestamp() where id=item.id;
     applied:=applied+1;
   exception when others then
     -- The failed subtransaction restores the previous enrollment/history/code.
     perform set_config('als.admission_actor',item.actor_id::text,true);
     perform set_config('als.change_reason','Scheduled transfer failed safely; old assignment retained',true);
     update public.student_batch_transfers set status='failed',failure_reason=case when sqlstate='23514' then 'Target batch capacity or assignment is unavailable. The previous batch is retained.' else 'Transfer could not be applied. Ask Admin to review current access and batch compatibility.' end where id=item.id;
   end;
 end loop;
 return applied;
end $$;
revoke all on function private.lms_apply_due_transfers() from public,anon,authenticated,service_role;
-- This is an academic transfer job. Existing media cleanup jobs stay unchanged.
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Scheduled transfers require the existing Supabase Cron extension'; end if;
 perform cron.schedule('als-lms-due-student-transfers','* * * * *','select private.lms_apply_due_transfers()');
end $$;

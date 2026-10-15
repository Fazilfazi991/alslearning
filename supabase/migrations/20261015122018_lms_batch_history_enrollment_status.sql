-- A suspended/cancelled enrollment cannot retain a "Current" batch interval.
-- Reactivation starts a fresh interval; permanent identity and old rows remain.
create or replace function private.lms_enrollment_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare at_time timestamptz; reason_value text; starts_interval boolean;
begin
  if new.batch_id is not null and not exists(select 1 from public.batches where id=new.batch_id and program_id=new.program_id) then
    raise exception 'Batch must belong to the enrolled Program'; end if;
  if tg_op='UPDATE' and (new.student_id<>old.student_id or new.program_id<>old.program_id) then
    raise exception 'Student and Program are permanent enrollment scope; add a separate enrollment'; end if;
  if tg_op='UPDATE' and new.batch_id is distinct from old.batch_id and coalesce(current_setting('als.transfer_enrollment',true),'')<>old.id::text then
    raise exception 'Use Transfer batch to preserve history'; end if;
  starts_interval:=tg_op='INSERT';
  if tg_op='UPDATE' then
    starts_interval:=new.batch_id is distinct from old.batch_id or (old.status<>'active' and new.status='active');
  end if;
  if starts_interval then
    if tg_op='INSERT' then at_time:=least(new.access_starts_at,clock_timestamp());
    elsif new.batch_id is distinct from old.batch_id then at_time:=nullif(current_setting('als.transfer_at',true),'')::timestamptz;
    else at_time:=clock_timestamp(); end if;
    reason_value:=nullif(current_setting('als.change_reason',true),'');
    if tg_op='UPDATE' then
      update public.student_batch_history set ended_at=greatest(at_time,effective_at)
        where enrollment_id=new.id and ended_at is null;
      if old.status<>'active' and new.status='active' then reason_value:=coalesce(reason_value,'Enrollment reactivated'); end if;
    end if;
    insert into public.student_batch_history(student_id,enrollment_id,program_id,batch_id,effective_at,ended_at,reason,actor_id)
    values(new.student_id,new.id,new.program_id,new.batch_id,at_time,
      case when new.status='active' then null else at_time end,reason_value,
      coalesce(auth.uid(),nullif(current_setting('als.admission_actor',true),'')::uuid));
    if new.batch_id is not null then perform private.lms_assign_student_code(new.student_id,new.batch_id); end if;
  elsif tg_op='UPDATE' and old.status='active' and new.status<>'active' then
    update public.student_batch_history set ended_at=greatest(clock_timestamp(),effective_at)
      where enrollment_id=new.id and ended_at is null;
  end if;
  return new;
end $$;
revoke all on function private.lms_enrollment_history() from public,anon,authenticated;

-- Close only intervals whose enrollment is already inactive. Use the existing
-- enrollment timestamp, retaining the interval and its original reason.
with candidates as (
  select h.id,to_jsonb(h) previous_value,greatest(h.effective_at,e.updated_at) ending
  from public.student_batch_history h join public.enrollments e on e.id=h.enrollment_id
  where h.ended_at is null and e.status<>'active'
), changed as (
  update public.student_batch_history h set ended_at=c.ending from candidates c where h.id=c.id
  returning h.id,to_jsonb(h) new_value,c.previous_value
)
insert into public.lms_audit_events(entity_table,entity_id,action,previous_value,new_value,reason)
select 'student_batch_history',id,'inactive_enrollment_history_reconciled',previous_value,new_value,
  'Close a previously open history interval for an already inactive enrollment; no historical rows removed'
from changed;

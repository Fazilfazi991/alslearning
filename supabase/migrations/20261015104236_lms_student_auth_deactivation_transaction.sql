-- LMS status, Auth sign-in restriction and audit commit together. Keep any
-- independent Auth restriction so reactivation cannot silently remove it.
create table private.student_lms_auth_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  previous_banned_until timestamptz,
  applied_until timestamptz not null,
  applied_at timestamptz not null default clock_timestamp()
);
alter table private.student_lms_auth_restrictions enable row level security;
revoke all on private.student_lms_auth_restrictions from public,anon,authenticated,service_role;

create function private.lms_student_auth_state() returns trigger
language plpgsql security definer set search_path='' as $$
declare restriction private.student_lms_auth_restrictions;
  actor uuid:=coalesce(auth.uid(),nullif(current_setting('als.admission_actor',true),'')::uuid);
begin
  if new.role<>'student' then return new; end if;
  if not new.is_active then
    insert into private.student_lms_auth_restrictions(user_id,previous_banned_until,applied_until)
    select new.id,u.banned_until,greatest(coalesce(u.banned_until,'-infinity'::timestamptz),clock_timestamp()+interval '100 years')
    from auth.users u where u.id=new.id on conflict(user_id) do nothing;
    select * into restriction from private.student_lms_auth_restrictions where user_id=new.id for update;
    update auth.users set banned_until=greatest(coalesce(banned_until,'-infinity'::timestamptz),restriction.applied_until)
      where id=new.id;
    insert into public.lms_audit_events(actor_id,entity_table,entity_id,action,new_value,reason)
    values(actor,'profiles',new.id,'auth_sign_in_disabled','{"auth_sign_in_blocked":true}',
      'Student deactivation; existing signed sessions are also denied by active-profile RLS');
  else
    select * into restriction from private.student_lms_auth_restrictions where user_id=new.id for update;
    if found then
      -- Preserve a different Auth ban imposed after LMS deactivation.
      update auth.users set banned_until=restriction.previous_banned_until
        where id=new.id and banned_until is not distinct from restriction.applied_until;
      delete from private.student_lms_auth_restrictions where user_id=new.id;
      insert into public.lms_audit_events(actor_id,entity_table,entity_id,action,new_value,reason)
      values(actor,'profiles',new.id,'auth_lms_restriction_removed','{"lms_auth_restriction":false}',
        'Student reactivation; independent Auth restrictions retained');
    end if;
  end if;
  return new;
end $$;
revoke all on function private.lms_student_auth_state() from public,anon,authenticated,service_role;
create trigger lms_student_auth_state after update of is_active on public.profiles
for each row when(old.is_active is distinct from new.is_active)
execute function private.lms_student_auth_state();

-- Existing inactive Students already have no LMS access. Apply the same Auth
-- sign-in restriction, preserving their previous Auth state for reactivation.
insert into private.student_lms_auth_restrictions(user_id,previous_banned_until,applied_until)
select p.id,u.banned_until,greatest(coalesce(u.banned_until,'-infinity'::timestamptz),clock_timestamp()+interval '100 years')
from public.profiles p join auth.users u on u.id=p.id where p.role='student' and not p.is_active;
update auth.users u set banned_until=r.applied_until
from private.student_lms_auth_restrictions r where u.id=r.user_id;
insert into public.lms_audit_events(entity_table,entity_id,action,new_value,reason)
select 'profiles',user_id,'auth_sign_in_disabled','{"auth_sign_in_blocked":true}',
  'Existing inactive Student Auth access policy applied by LMS migration'
from private.student_lms_auth_restrictions;

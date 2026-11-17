-- Draft forward migration. Requires the combined reviewed account/session and
-- registration setup/recovery migrations. Does not enable setup or resolve an
-- existing operation. Apply only after target-specific compatibility review.
do $$ begin
 if to_regprocedure('private.registration_setup_identity_allowed(uuid,uuid,uuid)') is null
 or to_regprocedure('public.claim_registration_setup(uuid,uuid,text)') is null
 or to_regprocedure('public.issue_registration_setup_replacement(uuid,uuid,uuid,text,uuid)') is null then
  raise exception 'Reviewed registration setup/recovery dependencies are required';
 end if;
end $$;

-- Trusted server derives student/session from verified Auth, never request
-- body. Diagnostics and claiming share one transaction, locks and row version.
create function public.claim_registration_setup_with_status(p_student uuid,p_session uuid,p_digest text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare op private.registration_setup_operations; claimed uuid;
begin
 if p_student is null or p_session is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
  return jsonb_build_object('status','invalid');
 end if;
 perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('als.account:'||p_student::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('als.registration.setup:'||p_student::text,0));
 select * into op from private.registration_setup_operations
 where grant_digest=p_digest and student_id=p_student and session_id=p_session for update;
 if not found then return jsonb_build_object('status','invalid'); end if;
 -- A failed or uncertain guard must not disclose a grant's precise status or
 -- let classification be mistaken for permission to retry.
 if not private.registration_setup_identity_allowed(op.registration_id,p_student,p_session) then
  return jsonb_build_object('status','unavailable');
 end if;
 if op.state in ('claimed','unknown') then return jsonb_build_object('status','unresolved'); end if;
 if op.state in ('provider_confirmed','authorization_denied','provider_rejected','superseded') then
  return jsonb_build_object('status','used');
 end if;
 -- Fail closed for future/unrecognized states. Expiry applies only to a
 -- never-dispatched issued operation, not to unresolved remote writes.
 if op.state<>'issued' then return jsonb_build_object('status','unresolved'); end if;
 if op.expires_at<=clock_timestamp() then return jsonb_build_object('status','expired'); end if;
 update private.registration_setup_operations set state='claimed',claimed_at=clock_timestamp()
 where id=op.id and state='issued' returning id into claimed;
 if claimed is null then return jsonb_build_object('status','unresolved'); end if;
 return jsonb_build_object('status','claimed','operation_id',claimed);
end $$;
revoke all on function public.claim_registration_setup_with_status(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_registration_setup_with_status(uuid,uuid,text) to service_role;

-- Preserve the legacy UUID-or-null interface. Both callers use the exact same
-- atomic primitive; never diagnose a failed legacy claim with a second lookup.
create or replace function public.claim_registration_setup(p_student uuid,p_session uuid,p_digest text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 result := public.claim_registration_setup_with_status(p_student,p_session,p_digest);
 if result->>'status'='claimed' then return (result->>'operation_id')::uuid; end if;
 return null;
end $$;
revoke all on function public.claim_registration_setup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_registration_setup(uuid,uuid,text) to service_role;

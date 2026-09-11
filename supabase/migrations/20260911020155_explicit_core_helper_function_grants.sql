-- Canonical RLS helpers must not depend on project-age default privileges.
-- All five are evaluated in authenticated policies / invoker call chains.
-- Their SECURITY DEFINER/INVOKER modes, owners, bodies and empty search_path
-- remain unchanged. postgres retains owner execution for internal calls.
-- service_role bypasses RLS and does not need direct access to these helpers.
-- Do not grant mutation RPCs or owner-only private helpers here.

revoke execute on function
  public.is_admin(),
  public.is_teacher(),
  public.has_program_access(uuid),
  public.teacher_has_assignment(uuid, uuid, uuid, text),
  public.can_join_live(uuid)
from public, anon, service_role;

grant execute on function
  public.is_admin(),
  public.is_teacher(),
  public.has_program_access(uuid),
  public.teacher_has_assignment(uuid, uuid, uuid, text),
  public.can_join_live(uuid)
to authenticated;

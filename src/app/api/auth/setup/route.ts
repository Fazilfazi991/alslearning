import { NextResponse } from "next/server";
import { registrationPasswordSetupAvailable } from "@/lib/registration-setup-availability";
import { recordUncertainRegistrationPasswordUpdate, recordUncertainRegistrationRevocation } from "@/lib/registration-security-log";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { passwordHelp, validAccountPassword } from "@/lib/account-validation";
import { setupCookie, validSetupGrant } from "@/lib/registration-setup-grant";
export async function POST(request: Request) {
  if (!registrationPasswordSetupAvailable) return NextResponse.json({ error: "Account setup is temporarily unavailable. Please contact admissions." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const data: unknown = await request.json().catch(() => null);
    const password = data && typeof data === "object" ? (data as Record<string, unknown>).password : null;
    if (!validAccountPassword(password)) return NextResponse.json({ error: passwordHelp }, { status: 400 });
    const db = await createClient();
    const [user, claims, store] = await Promise.all([db.auth.getUser(), db.auth.getClaims(), cookies()]);
    const sessionId = claims.data?.claims?.session_id, grant = store.get(setupCookie)?.value;
    if (user.error || !user.data.user || claims.error || typeof sessionId !== "string" || !grant || !validSetupGrant(grant, user.data.user.id, sessionId)) return NextResponse.json({ error: "Your setup link has expired. Ask admissions for a new invitation." }, { status: 401 });
    const profile = await db.from("profiles").select("role,is_active").eq("id", user.data.user.id).single();
    if (profile.error || profile.data?.role !== "student" || !profile.data.is_active) return NextResponse.json({ error: "This account is not available." }, { status: 403 });
    // A provider error after dispatch does not prove the password was unchanged.
    const uncertainUpdate = async () => {
      recordUncertainRegistrationPasswordUpdate(user.data.user!.id);
      store.delete(setupCookie);
      try { if ((await db.auth.signOut({ scope: "local" })).error) recordUncertainRegistrationRevocation(user.data.user!.id); }
      catch { recordUncertainRegistrationRevocation(user.data.user!.id); }
      return NextResponse.json({ error: "Your password may have changed, but setup could not be confirmed. Contact admissions before trying again." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    };
    let updateUncertain = false;
    try { updateUncertain = !!(await db.auth.updateUser({ password })).error; }
    catch { updateUncertain = true; }
    if (updateUncertain) return await uncertainUpdate();
    // The Auth write is external and may have completed after deactivation.
    // A fresh RLS-backed read decides whether success may be reported; it does
    // not cancel or roll back a credential write already sent to Auth.
    let current;
    try { current = await db.from("profiles").select("role,is_active").eq("id", user.data.user.id).maybeSingle(); }
    catch { current = { data: null, error: true }; }
    if (current.error || current.data?.role !== "student" || !current.data.is_active) {
      store.delete(setupCookie);
      try { if ((await db.auth.signOut({ scope: "local" })).error) recordUncertainRegistrationRevocation(user.data.user.id); }
      catch { recordUncertainRegistrationRevocation(user.data.user.id); }
      return NextResponse.json({ error: "The password may have changed, but account access could not be confirmed. Contact admissions." }, { status: current.error ? 503 : 403, headers: { "Cache-Control": "private, no-store" } });
    }
    store.delete(setupCookie);
    try {
      if ((await db.auth.signOut({ scope: "global" })).error) {
        recordUncertainRegistrationRevocation(user.data.user.id);
        return NextResponse.json({ error: "Your password changed, but sign-out could not be confirmed. Contact admissions." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
      }
    } catch {
      recordUncertainRegistrationRevocation(user.data.user.id);
      return NextResponse.json({ error: "Your password changed, but sign-out could not be confirmed. Contact admissions." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Password setup could not be completed. Please try again." }, { status: 503 }); }
}

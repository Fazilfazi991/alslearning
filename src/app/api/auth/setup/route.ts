import { NextResponse } from "next/server";
import { registrationPasswordSetupAvailable } from "@/lib/registration-setup-availability";
import { recordUncertainRegistrationPasswordUpdate, recordUncertainRegistrationRevocation } from "@/lib/registration-security-log";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/request-origin";
import { passwordHelp, validAccountPassword } from "@/lib/account-validation";
import { setupCookie, setupCapabilityDigest } from "@/lib/registration-setup-grant";
import { isAuthWeakPasswordError } from "@supabase/supabase-js";
export async function POST(request: Request) {
  if (!registrationPasswordSetupAvailable) return NextResponse.json({ error: "Account setup is temporarily unavailable. Please contact admissions." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const data: unknown = await request.json().catch(() => null);
    const password = data && typeof data === "object" ? (data as Record<string, unknown>).password : null;
    if (!data || typeof data !== "object" || Object.keys(data).length !== 1 || !validAccountPassword(password)) return NextResponse.json({ error: passwordHelp }, { status: 400 });
    const db = await createClient();
    const [user, claims, store] = await Promise.all([db.auth.getUser(), db.auth.getClaims(), cookies()]);
    const sessionId = claims.data?.claims?.session_id, grant = store.get(setupCookie)?.value;
    const digest = grant ? setupCapabilityDigest(grant) : null;
    if (user.error || !user.data.user || claims.error || claims.data?.claims?.sub !== user.data.user.id || typeof sessionId !== "string" || !digest) return NextResponse.json({ error: "This setup link is unavailable or has already been used. If you submitted a password, it may have changed. Contact admissions before trying again." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const profile = await db.from("profiles").select("role,is_active").eq("id", user.data.user.id).single();
    if (profile.error || profile.data?.role !== "student" || !profile.data.is_active) return NextResponse.json({ error: "This account is not available." }, { status: 403 });
    const root = createAuthAdminClient();
    const claimed = await root.rpc("claim_registration_setup_with_status", { p_student: user.data.user.id, p_session: sessionId, p_digest: digest });
    if (claimed.error) return NextResponse.json({ error: "Account setup is temporarily unavailable. Contact admissions." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    const result: unknown = claimed.data;
    if (!result || typeof result !== "object" || Array.isArray(result)) return NextResponse.json({ error: "Account setup is temporarily unavailable. Contact admissions." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    const { status, operation_id: operation } = result as Record<string, unknown>;
    if (typeof status === "string" && ["invalid", "unavailable", "unresolved", "used", "expired"].includes(status)) {
      console.info(JSON.stringify({ event: "registration_setup_claim_denied", classification: status }));
      return NextResponse.json({ error: "This setup link is unavailable or has already been used. If you submitted a password, it may have changed. Contact admissions before trying again." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }
    if (status !== "claimed" || typeof operation !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operation)) return NextResponse.json({ error: "Account setup is temporarily unavailable. Contact admissions." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    const finish = (outcome: "unknown" | "provider_confirmed" | "provider_rejected") => root.rpc("finish_registration_setup", { p_operation: operation, p_student: user.data.user!.id, p_session: sessionId, p_outcome: outcome });
    // A provider error after dispatch does not prove the password was unchanged.
    const uncertainUpdate = async () => {
      try { await finish("unknown"); } catch { /* Claimed remains non-retryable. */ }
      recordUncertainRegistrationPasswordUpdate(user.data.user!.id);
      store.delete(setupCookie);
      try { if ((await db.auth.signOut({ scope: "local" })).error) recordUncertainRegistrationRevocation(user.data.user!.id); }
      catch { recordUncertainRegistrationRevocation(user.data.user!.id); }
      return NextResponse.json({ error: "Your password may have changed, but setup could not be confirmed. Contact admissions before trying again." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    };
    let probe: Awaited<ReturnType<typeof import("@/lib/registration-local-provider-probe").localRegistrationProviderProbe>> | null = null;
    let updateError: unknown = null;
    try {
      if (process.env.ALS_LOCAL_PROVIDER_REJECTION_QA === "1") probe = await (await import("@/lib/registration-local-provider-probe")).localRegistrationProviderProbe();
      updateError = (await (probe?.db ?? db).auth.updateUser({ password })).error;
    } catch { return await uncertainUpdate(); }
    if (updateError) {
      if (probe && isAuthWeakPasswordError(updateError) && updateError.status === 422 && updateError.code === "weak_password" && probe.confirmedWeakRejection()) {
        let rejected;
        try { rejected = await finish("provider_rejected"); } catch { rejected = { data: null, error: true }; }
        if (rejected.error || rejected.data !== "provider_rejected") return await uncertainUpdate();
        store.delete(setupCookie);
        try { if ((await db.auth.signOut({ scope: "local" })).error) recordUncertainRegistrationRevocation(user.data.user.id); }
        catch { recordUncertainRegistrationRevocation(user.data.user.id); }
        return NextResponse.json({ error: "The password was rejected before it was changed. Contact admissions for a new setup link." }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
      }
      return await uncertainUpdate();
    }
    let completed;
    try { completed = await finish("provider_confirmed"); } catch { completed = { data: null, error: true }; }
    if (completed.error || completed.data !== "provider_confirmed") {
      store.delete(setupCookie);
      try { if ((await db.auth.signOut({ scope: "local" })).error) recordUncertainRegistrationRevocation(user.data.user.id); }
      catch { recordUncertainRegistrationRevocation(user.data.user.id); }
      return NextResponse.json({ error: "The password may have changed, but account access could not be confirmed. Contact admissions." }, { status: completed.data === "authorization_denied" ? 403 : 503, headers: { "Cache-Control": "private, no-store" } });
    }
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
  } catch { return NextResponse.json({ error: "Your password may have changed, but setup could not be confirmed. Contact admissions before trying again." }, { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}

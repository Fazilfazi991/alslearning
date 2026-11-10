import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { registrationPasswordSetupAvailable } from "@/lib/registration-setup-availability";
import { createBufferedAuthClient } from "@/lib/supabase/buffered-auth";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { makeSetupGrant, setupCookie, readRegistrationRecoveryGrant } from "@/lib/registration-setup-grant";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const validToken = (token: string | null, type: string | null) => !!token && token.length <= 1024 && (type === "invite" || type === "recovery");

// GET is deliberately non-consuming: mail scanners often follow links before
// the recipient. Only the student's explicit form submission redeems the OTP.
export async function GET(request: Request) {
  const url = new URL(request.url), token = url.searchParams.get("token_hash"), type = url.searchParams.get("type");
  if (!validToken(token, type)) return NextResponse.redirect(new URL("/login", url), { headers });
  if (!registrationPasswordSetupAvailable) return new Response("Account setup is temporarily unavailable. Please contact admissions.", { status: 503, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  const recovery = url.searchParams.get("registration_recovery") || "";
  if (recovery.length > 4096) return NextResponse.redirect(new URL("/login?error=invalid-link", url), { headers });
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Set up your ALS account</title><style>body{font-family:system-ui,sans-serif;background:#f8f9fc;color:#11131a;margin:0}main{max-width:480px;margin:8vh auto;padding:24px}button{background:#a4226c;color:white;border:0;border-radius:8px;padding:14px 20px;min-height:44px;font:inherit;font-weight:700;cursor:pointer}button:focus-visible{outline:3px solid #2a437f;outline-offset:3px}p{line-height:1.5}</style></head><body><main><p>ALS ACADEMY</p><h1>Set up your student account</h1><p>Continue to verify your secure link and choose a password.</p><form method="post" action="/auth/callback"><input type="hidden" name="token_hash" value="${escapeHtml(token!)}"><input type="hidden" name="type" value="${escapeHtml(type!)}"><input type="hidden" name="registration_recovery" value="${escapeHtml(recovery)}"><button type="submit">Continue to account setup</button></form><p>If this link has expired or has already been used, contact admissions for a replacement.</p></main></body></html>`, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!registrationPasswordSetupAvailable) return new Response("Account setup is temporarily unavailable. Please contact admissions.", { status: 503, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  const invalid = () => NextResponse.redirect(new URL("/login?error=invalid-link", url), { status: 303, headers });
  // Browsers submitting this form send Origin; require an exact match rather
  // than accepting cross-site form submissions or a user-supplied destination.
  if (request.headers.get("origin") !== url.origin) return invalid();
  let form: FormData;
  try { form = await request.formData(); } catch { return invalid(); }
  const token = form.get("token_hash"), type = form.get("type"), recoveryValue = form.get("registration_recovery");
  if (typeof token !== "string" || typeof type !== "string" || !validToken(token, type) || (recoveryValue !== null && (typeof recoveryValue !== "string" || recoveryValue.length > 4096))) return invalid();
  let db: Awaited<ReturnType<typeof createBufferedAuthClient>>["db"] | null = null;
  let verifiedSession = false;
  let verifiedUserId: string | undefined;
  try {
    makeSetupGrant("configuration-check", "configuration-check");
    const recovery = type === "recovery" && process.env.REGISTRATION_RECOVERY_ENABLED === "true" ? readRegistrationRecoveryGrant(recoveryValue || "") : null;
    if (type === "recovery" && !recovery) throw new Error("Recovery unavailable");
    const buffered = await createBufferedAuthClient();
    db = buffered.db;
    const verified = await db.auth.verifyOtp({ token_hash: token, type: type as "invite" | "recovery" });
    if (verified.error || !verified.data.user) throw new Error("Invalid invite");
    verifiedSession = true;
    verifiedUserId = verified.data.user.id;
    const registrations = createAuthAdminClient().from("student_registrations").select("id").eq("student_id", verified.data.user.id).eq("status", "approved");
    const registration = await (recovery ? registrations.eq("id", recovery.registrationId) : registrations.limit(1)).maybeSingle();
    if (registration.error || !registration.data || (recovery && recovery.userId !== verified.data.user.id)) {
      throw new Error("Not an authorized registration");
    }
    const claims = await db.auth.getClaims(), sessionId = claims.data?.claims?.session_id;
    if (claims.error || typeof sessionId !== "string") throw new Error("Missing session");
    const profile = await db.from("profiles").select("role,is_active").eq("id", verified.data.user.id).single();
    if (profile.error || profile.data?.role !== "student" || !profile.data.is_active) throw new Error("Inactive student");
    const response = NextResponse.redirect(new URL("/auth/setup", url), { status: 303, headers });
    buffered.publish(response);
    response.cookies.set(setupCookie, makeSetupGrant(verified.data.user.id, sessionId), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 600 });
    return response;
  } catch {
    if (db && verifiedSession) {
      let uncertain = false;
      try { uncertain = !!(await db.auth.signOut({ scope: "local" })).error; } catch { uncertain = true; }
      if (uncertain) console.error(JSON.stringify({ event: "registration_session_revocation_uncertain", correlation_id: randomUUID(), user_id: verifiedUserId, occurred_at: new Date().toISOString() }));
    }
    return invalid();
  }
}

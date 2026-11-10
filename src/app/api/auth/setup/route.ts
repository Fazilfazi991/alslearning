import { NextResponse } from "next/server";
import { registrationPasswordSetupAvailable } from "@/lib/registration-setup-availability";
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
    const result = await db.auth.updateUser({ password });
    if (result.error) return NextResponse.json({ error: "Password setup could not be completed. Please try again." }, { status: 503 });
    store.delete(setupCookie); await db.auth.signOut({ scope: "global" });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Password setup could not be completed. Please try again." }, { status: 503 }); }
}

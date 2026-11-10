import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeSetupGrant, setupCookie } from "@/lib/registration-setup-grant";

export async function GET(request: Request) {
  const url = new URL(request.url), token = url.searchParams.get("token_hash");
  if (url.searchParams.get("type") !== "invite" || !token || token.length > 1024) return NextResponse.redirect(new URL("/login", url));
  try {
    makeSetupGrant("configuration-check", "configuration-check");
    const db = await createClient();
    const verified = await db.auth.verifyOtp({ token_hash: token, type: "invite" });
    if (verified.error || !verified.data.user) throw new Error("Invalid invite");
    const claims = await db.auth.getClaims(), sessionId = claims.data?.claims?.session_id;
    if (claims.error || typeof sessionId !== "string") throw new Error("Missing session");
    const profile = await db.from("profiles").select("role,is_active").eq("id", verified.data.user.id).single();
    if (profile.error || profile.data?.role !== "student" || !profile.data.is_active) throw new Error("Inactive student");
    const response = NextResponse.redirect(new URL("/auth/setup", url));
    response.cookies.set(setupCookie, makeSetupGrant(verified.data.user.id, sessionId), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 600 });
    response.headers.set("Cache-Control", "private, no-store"); response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { return NextResponse.redirect(new URL("/login?error=invalid-link", url)); }
}

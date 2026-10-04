import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createPasswordClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import { isSameOriginRequest } from "@/lib/request-origin";
import { passwordHelp, validAccountPassword } from "@/lib/account-validation";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    const db = await createClient();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const profile = await db.from("profiles").select("is_active").eq("id", data.user.id).single();
    if (profile.error || !profile.data?.is_active) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const body: unknown = await request.json().catch(() => null);
    const { current_password, password } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    if (typeof current_password !== "string" || !current_password || !validAccountPassword(password)) return NextResponse.json({ error: passwordHelp }, { status: 400 });
    if (password === current_password) return NextResponse.json({ error: "Choose a different password." }, { status: 400 });
    const { url, key } = supabaseConfig();
    // A separate client verifies the current password without replacing SSR cookies.
    const verified = createPasswordClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
      const signed = await verified.auth.signInWithPassword({ email: data.user.email!, password: current_password });
      if (signed.error || signed.data.user?.id !== data.user.id) return NextResponse.json({ error: "The current password is incorrect." }, { status: 401 });
      const changed = await verified.auth.updateUser({ password });
      if (changed.error) return NextResponse.json({ error: "Your password could not be changed. Please retry." }, { status: 503 });
    } finally { await verified.auth.signOut({ scope: "local" }); }
    await db.auth.signOut({ scope: "global" });
    return NextResponse.json({ redirect: "/login", success: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Your password could not be changed. Please retry." }, { status: 503 }); }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const invalid = () => NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { email, password } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  try {
    const db = await createClient();
    const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) return invalid();
    // The canonical profile, never the email or requested portal, controls access.
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role,is_active").eq("id", data.user.id).single();
    if (profileError || !profile?.is_active || !["admin", "teacher", "student"].includes(profile.role)) {
      await db.auth.signOut({ scope: "local" });
      return invalid();
    }
    return NextResponse.json({ redirect: `/${profile.role}` });
  } catch {
    return NextResponse.json({ error: "Could not sign in. Please try again." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    const db = await createClient();
    const auth = await db.auth.getUser();
    if (auth.error || !auth.data.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers });
    const profile = await db.from("profiles").select("id,role,is_active").eq("id", auth.data.user.id).single();
    if (profile.error || !profile.data?.is_active || !["admin", "teacher", "student"].includes(profile.data.role)) {
      return NextResponse.json({ error: "Active account required." }, { status: 403, headers });
    }
    return NextResponse.json({ id: profile.data.id, role: profile.data.role }, { headers });
  } catch {
    return NextResponse.json({ error: "Session verification unavailable." }, { status: 503, headers });
  }
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  const db = await createClient();
  await db.auth.signOut({ scope: "local" });
  const store = await cookies();
  // Clear stale, chunked SSR Auth cookies even when browser sign-out ran first.
  for (const cookie of store.getAll()) {
    if (/^sb-[a-z0-9]+-auth-token(?:\.[0-9]+)?$/.test(cookie.name)) {
      store.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  return NextResponse.json({ signedOut: true }, { headers: { "Cache-Control": "no-store" } });
}

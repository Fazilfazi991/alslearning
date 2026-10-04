import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { runClassroomCleanup } from "@/lib/live-class/staging-cleanup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const expected = process.env.ALS_LIVE_CLEANUP_TOKEN;
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.ALS_STAGING_MODE === "true" || url !== "https://dvmahmkapgtjfqmoottt.supabase.co" || !key || !expected || expected.length < 32 || !supplied ||
    !timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(supplied).digest())) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    return Response.json(await runClassroomCleanup(db));
  } catch {
    console.error("Production live cleanup failed");
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

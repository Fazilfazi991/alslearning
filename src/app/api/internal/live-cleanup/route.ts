import { createHash, timingSafeEqual } from "node:crypto";
import { runStagingCleanup } from "@/lib/live-class/staging-cleanup";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.ALS_STAGING_CLEANUP_TOKEN;
  const supplied = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/)?.[1];
  if (!expected || !supplied || expected.length < 32) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (process.env.ALS_STAGING_MODE !== "true" || !authorized(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    return Response.json(await runStagingCleanup());
  } catch (error) {
    console.error("Staging live cleanup failed", error);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

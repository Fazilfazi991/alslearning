import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecordedClassPlaybackUrl } from "@/lib/recorded-classes-r2";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/recorded-classes/[id]/playback">) {
  const { id } = await context.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await db.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
  if (!profile?.is_active || !["student", "admin"].includes(profile.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: recording } = await db.from("recorded_classes")
    .select("id,provider,storage_provider,storage_key,poster_storage_key,duration_seconds,status")
    .eq("id", id).single();
  if (!recording || recording.provider !== "native" || recording.storage_provider !== "r2" || !recording.storage_key) {
    return NextResponse.json({ error: "Recording unavailable" }, { status: 404 });
  }
  let payload: unknown = { interactions: [], responses: [], progress: null };
  if (profile.role === "student") {
    const result = await db.rpc("recorded_class_payload", { target: id });
    if (result.error) return NextResponse.json({ error: "Recording unavailable" }, { status: 403 });
    payload = result.data;
  }
  try {
    const playback = await getRecordedClassPlaybackUrl(recording.storage_key);
    const poster = recording.poster_storage_key ? await getRecordedClassPlaybackUrl(recording.poster_storage_key) : null;
    return NextResponse.json({ ...(payload as object), playbackUrl: playback.url, expiresAt: playback.expiresAt, posterUrl: poster?.url ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Playback storage is unavailable" }, { status: 503 });
  }
}

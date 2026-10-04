import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reconcileClassTransport } from "./transport-reconciliation";
import { readStagingCleanup } from "./staging-cleanup-read";

const STAGING_REF = "slghshcdaijbcjfoqerq";
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const MAX_ROWS = 500;

function stagingDatabase() {
  if (process.env.ALS_STAGING_MODE !== "true"
    || process.env.SUPABASE_PROJECT_REF !== STAGING_REF
    || process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_URL
    || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Staging cleanup is not configured for the isolated ALS staging project");
  }
  return createClient(STAGING_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function runStagingCleanup(now = new Date()) {
  const db = stagingDatabase();
  const cutoff = Date.parse(process.env.ALS_STAGING_TEST_CUTOFF_UTC || "");
  return runClassroomCleanup(db, now, cutoff);
}

export async function runClassroomCleanup(db: SupabaseClient, now = new Date(), cutoff = NaN) {
  const nowIso = now.toISOString();
  const [live, connections, publications, subscriptions, attendance] = await Promise.all([
    readStagingCleanup("live_sessions", () => db.from("live_sessions").select("id,ends_at,status")
      .in("provider", ["cloudflare", "cloudflare-poc"]).eq("status", "live").limit(MAX_ROWS)),
    readStagingCleanup("live_media_connections", () => db.from("live_media_connections").select("id,session_id,status,last_seen_at")
      .in("status", ["active", "reconnecting", "failed"]).limit(MAX_ROWS)),
    readStagingCleanup("live_published_tracks", () => db.from("live_published_tracks").select("session_id")
      .in("status", ["active", "closing", "failed"]).limit(MAX_ROWS)),
    readStagingCleanup("live_track_subscriptions", () => db.from("live_track_subscriptions").select("session_id")
      .in("status", ["active", "closing", "failed"]).limit(MAX_ROWS)),
    readStagingCleanup("live_attendance_intervals", () => db.from("live_attendance_intervals").select("id,session_id,connection_id")
      .is("ended_at", null).limit(MAX_ROWS)),
  ]);
  for (const query of [live, connections, publications, subscriptions, attendance]) {
    if (query.error) throw query.error;
    if ((query.data || []).length === MAX_ROWS) throw new Error("Staging cleanup result limit reached");
  }

  const expired = (live.data || []).filter(row =>
    (row.ends_at && Date.parse(row.ends_at) <= now.getTime())
      || (Number.isFinite(cutoff) && cutoff <= now.getTime()));
  for (const row of expired) {
    const { error } = await db.from("live_sessions")
      .update({ status: "completed", ended_at: nowIso, updated_at: nowIso })
      .eq("id", row.id).eq("status", "live");
    if (error) throw error;
  }

  const endedIds = new Set(expired.map(row => row.id));
  const classIds = new Set<string>([
    ...endedIds,
    ...(connections.data || []).map(row => row.session_id),
    ...(publications.data || []).map(row => row.session_id),
    ...(subscriptions.data || []).map(row => row.session_id),
    ...(attendance.data || []).map(row => row.session_id),
  ]);
  if (classIds.size) {
    const { data: sessions, error } = await readStagingCleanup("candidate_live_sessions", () => db.from("live_sessions")
      .select("id,status").in("id", [...classIds]));
    if (error) throw error;
    for (const session of sessions || []) {
      if (["completed", "cancelled"].includes(session.status)) endedIds.add(session.id);
    }
  }
  const forcedByClass = new Map<string, Set<string>>();
  const openConnectionIds = new Set((connections.data || []).map(row => row.id));
  const orphanAttendanceIds = (attendance.data || [])
    .filter(row => !openConnectionIds.has(row.connection_id))
    .map(row => row.id);
  if (orphanAttendanceIds.length) {
    const { error } = await db.from("live_attendance_intervals")
      .update({ ended_at: nowIso, ended_reason: "stale" })
      .in("id", orphanAttendanceIds).is("ended_at", null);
    if (error) throw error;
  }
  for (const row of connections.data || []) {
    if (endedIds.has(row.session_id)
      || Date.parse(row.last_seen_at) < now.getTime() - 45_000) {
      const ids = forcedByClass.get(row.session_id) || new Set<string>();
      ids.add(row.id);
      forcedByClass.set(row.session_id, ids);
    }
  }
  const results = [];
  for (const classId of classIds) {
    const forcedConnectionIds = [...(forcedByClass.get(classId) || [])];
    const result = await reconcileClassTransport(db, classId, {
      skipCandidateRpc: true,
      forcedConnectionIds,
    });
    if (endedIds.has(classId)) {
      const { error } = await db.from("live_attendance_intervals")
        .update({ ended_at: nowIso, ended_reason: "ended" })
        .eq("session_id", classId).is("ended_at", null);
      if (error) throw error;
    }
    results.push({ classId, ...result });
  }
  return { expiredClasses: expired.length, closedOrphanAttendance: orphanAttendanceIds.length, inspectedClasses: results.length, results };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeProviderTracks, type ClosableTrack } from "./transport-cleanup";

type CleanupRow = Omit<ClosableTrack, "live_media_connections"> & {
  connection_id: string;
  status: "active" | "closing" | "failed";
  cleanup_attempts: number;
  cleanup_retry_at: string | null;
  live_media_connections?:
    | { provider_session_id: string; status: string }
    | { provider_session_id: string; status: string }[];
};

function due(row: CleanupRow, forced: Set<string>, forceAll: boolean) {
  if (forceAll || forced.has(row.connection_id)) return true;
  const connection = Array.isArray(row.live_media_connections)
    ? row.live_media_connections[0]
    : row.live_media_connections;
  if (connection && !["active", "reconnecting"].includes(connection.status) && row.status === "active") return true;
  if (row.status === "closing") return true;
  return row.status === "failed" && Boolean(row.cleanup_retry_at) && Date.parse(row.cleanup_retry_at!) <= Date.now();
}

function retryAt(attempts: number) {
  const seconds = Math.min(300, 5 * 2 ** Math.min(attempts, 6));
  return new Date(Date.now() + seconds * 1_000).toISOString();
}

async function reconcileRows(db: SupabaseClient, table: "live_published_tracks" | "live_track_subscriptions", rows: CleanupRow[]) {
  if (!rows.length) return { closed: 0, failed: 0 };
  const ids = rows.map(row => row.id);
  const now = new Date().toISOString();
  const { error: closingError } = await db.from(table).update({ status: "closing", last_cleanup_error: null }).in("id", ids);
  if (closingError) throw closingError;
  const result = await closeProviderTracks(rows);
  if (result.closed.length) {
    const { error } = await db.from(table).update({
      status: "closed", closed_at: now, cleanup_retry_at: null, last_cleanup_error: null,
    }).in("id", result.closed);
    if (error) throw error;
  }
  const failed = new Set(result.failed);
  await Promise.all(rows.filter(row => failed.has(row.id)).map(async row => {
    const attempts = row.cleanup_attempts + 1;
    const { error } = await db.from(table).update({
      status: "failed", cleanup_attempts: attempts, cleanup_retry_at: retryAt(attempts),
      last_cleanup_error: "Provider close is unresolved; scheduled for reconciliation",
    }).eq("id", row.id);
    if (error) throw error;
  }));
  return { closed: result.closed.length, failed: result.failed.length };
}

export async function reconcileClassTransport(
  db: SupabaseClient,
  classId: string,
  options: { forceAll?: boolean } = {},
) {
  const { data: candidates, error: candidateError } = await db.rpc("live_transport_cleanup_candidates", { target_session: classId });
  if (candidateError) throw candidateError;
  const forced = new Set<string>((candidates || []).map((candidate: { connection_id: string }) => candidate.connection_id));
  const select = "id,connection_id,provider_mid,status,cleanup_attempts,cleanup_retry_at,live_media_connections!inner(provider_session_id,status)";
  const [publicationQuery, subscriptionQuery] = await Promise.all([
    db.from("live_published_tracks").select(select).eq("session_id", classId).in("status", ["active", "closing", "failed"]),
    db.from("live_track_subscriptions").select(select).eq("session_id", classId).in("status", ["active", "closing", "failed"]).not("provider_mid", "is", null),
  ]);
  if (publicationQuery.error) throw publicationQuery.error;
  if (subscriptionQuery.error) throw subscriptionQuery.error;
  const publications = (publicationQuery.data || []) as unknown as CleanupRow[];
  const subscriptions = (subscriptionQuery.data || []) as unknown as CleanupRow[];
  const publicationResult = await reconcileRows(db, "live_published_tracks", publications.filter(row => due(row, forced, !!options.forceAll)));
  const subscriptionResult = await reconcileRows(db, "live_track_subscriptions", subscriptions.filter(row => due(row, forced, !!options.forceAll)));
  if (forced.size || options.forceAll) {
    const connectionIds = options.forceAll
      ? [...new Set([...publications, ...subscriptions].map(row => row.connection_id))]
      : [...forced];
    if (connectionIds.length) {
      const now = new Date().toISOString();
      await Promise.all([
        db.from("live_media_connections").update({ status: "closed", closed_at: now }).in("id", connectionIds),
        db.from("live_attendance_intervals").update({ ended_at: now, ended_reason: "stale" }).in("connection_id", connectionIds).is("ended_at", null),
      ]);
    }
  }
  return {
    candidates: forced.size,
    closedPublications: publicationResult.closed,
    failedPublications: publicationResult.failed,
    closedSubscriptions: subscriptionResult.closed,
    failedSubscriptions: subscriptionResult.failed,
  };
}

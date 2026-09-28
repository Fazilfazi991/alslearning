import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeProviderTracks, type ClosableTrack } from "./transport-cleanup";

type CleanupRow = Omit<ClosableTrack, "live_media_connections"> & {
  connection_id: string;
  status: "active" | "closing" | "failed";
  cleanup_attempts: number;
  cleanup_retry_at: string | null;
  provider_reconciliation_outcome: "confirmed_closed" | "confirmed_absent_or_expired" | "unresolved" | null;
  live_media_connections?:
    | { provider_session_id: string | null; publisher_provider_session_id?: string | null; status: string }
    | { provider_session_id: string | null; publisher_provider_session_id?: string | null; status: string }[];
};

function due(row: CleanupRow, forced: Set<string>, forceAll: boolean) {
  if (row.provider_reconciliation_outcome === "confirmed_closed" || row.provider_reconciliation_outcome === "confirmed_absent_or_expired") return false;
  if (forceAll || forced.has(row.connection_id)) return true;
  const connection = Array.isArray(row.live_media_connections)
    ? row.live_media_connections[0]
    : row.live_media_connections;
  if (connection && !["active", "reconnecting"].includes(connection.status) && row.status === "active") return true;
  if (row.status === "closing") return true;
  return row.status === "failed" && Boolean(row.cleanup_retry_at) && Date.parse(row.cleanup_retry_at!) <= Date.now();
}

function hasTerminalProviderEvidence(row: CleanupRow) {
  return row.provider_reconciliation_outcome === "confirmed_closed"
    || row.provider_reconciliation_outcome === "confirmed_absent_or_expired";
}

async function normalizeTerminalRows(
  db: SupabaseClient,
  table: "live_published_tracks" | "live_track_subscriptions",
  rows: CleanupRow[],
) {
  const ids = rows.filter(hasTerminalProviderEvidence).map(row => row.id);
  if (!ids.length) return 0;
  const { error } = await db.from(table).update({
    status: "closed",
    closed_at: new Date().toISOString(),
    cleanup_retry_at: null,
    last_cleanup_error: null,
  }).in("id", ids);
  if (error) throw error;
  return ids.length;
}

function retryAt(attempts: number) {
  const seconds = Math.min(300, 5 * 2 ** Math.min(attempts, 6));
  return new Date(Date.now() + seconds * 1_000).toISOString();
}

async function reconcileRows(db: SupabaseClient, table: "live_published_tracks" | "live_track_subscriptions", rows: CleanupRow[]) {
  if (!rows.length) return { closed: 0, expired: 0, failed: 0 };
  const ids = rows.map(row => row.id);
  const now = new Date().toISOString();
  const { error: closingError } = await db.from(table).update({ status: "closing", last_cleanup_error: null }).in("id", ids);
  if (closingError) throw closingError;
  const result = await closeProviderTracks(rows, table === "live_published_tracks" ? "publisher" : "subscriber");
  if (result.closed.length) {
    const { error } = await db.from(table).update({
      status: "closed", closed_at: now, cleanup_retry_at: null, last_cleanup_error: null,
      provider_reconciliation_outcome: "confirmed_closed", provider_reconciled_at: now,
      provider_reconciliation_http_status: 200, provider_reconciliation_error_code: null,
      provider_reconciliation_detail: "Provider close acknowledged or inspection confirmed the mid absent",
    }).in("id", result.closed);
    if (error) throw error;
  }
  if (result.expired.length) {
    const expiredFailedIds = rows.filter(row => row.status === "failed" && result.expired.includes(row.id)).map(row => row.id);
    const expiredActiveIds = result.expired.filter(id => !expiredFailedIds.includes(id));
    const evidence = {
      cleanup_retry_at: null, provider_reconciliation_outcome: "confirmed_absent_or_expired", provider_reconciled_at: now,
      provider_reconciliation_http_status: 410, provider_reconciliation_error_code: "session_error",
      provider_reconciliation_detail: "Cloudflare reports the provider session expired or closed; the session-specific mid is no longer reusable",
    };
    if (expiredActiveIds.length) {
      const { error } = await db.from(table).update({ ...evidence, status: "closed", closed_at: now, last_cleanup_error: null }).in("id", expiredActiveIds);
      if (error) throw error;
    }
    if (expiredFailedIds.length) {
      const { error } = await db.from(table).update(evidence).in("id", expiredFailedIds);
      if (error) throw error;
    }
  }
  const failed = new Set(result.failed);
  await Promise.all(rows.filter(row => failed.has(row.id)).map(async row => {
    const attempts = row.cleanup_attempts + 1;
    const { error } = await db.from(table).update({
      status: "failed", cleanup_attempts: attempts, cleanup_retry_at: retryAt(attempts),
      last_cleanup_error: "Provider close is unresolved; scheduled for reconciliation",
      provider_reconciliation_outcome: "unresolved", provider_reconciled_at: now,
      provider_reconciliation_http_status: null, provider_reconciliation_error_code: null,
      provider_reconciliation_detail: "Provider close and follow-up inspection did not establish a terminal outcome",
    }).eq("id", row.id);
    if (error) throw error;
  }));
  return { closed: result.closed.length, expired: result.expired.length, failed: result.failed.length };
}

export async function reconcileClassTransport(
  db: SupabaseClient,
  classId: string,
  options: { forceAll?: boolean; forcedConnectionIds?: string[]; skipCandidateRpc?: boolean } = {},
) {
  const candidates = options.skipCandidateRpc
    ? []
    : await db.rpc("live_transport_cleanup_candidates", { target_session: classId }).then(result => {
      if (result.error) throw result.error;
      return result.data || [];
    });
  const forced = new Set<string>([
    ...candidates.map((candidate: { connection_id: string }) => candidate.connection_id),
    ...(options.forcedConnectionIds || []),
  ]);
  const select = "id,connection_id,provider_mid,status,cleanup_attempts,cleanup_retry_at,provider_reconciliation_outcome,live_media_connections!inner(provider_session_id,publisher_provider_session_id,status)";
  const [publicationQuery, subscriptionQuery] = await Promise.all([
    db.from("live_published_tracks").select(select).eq("session_id", classId).in("status", ["active", "closing", "failed"]),
    db.from("live_track_subscriptions").select(select).eq("session_id", classId).in("status", ["active", "closing", "failed"]).not("provider_mid", "is", null),
  ]);
  if (publicationQuery.error) throw publicationQuery.error;
  if (subscriptionQuery.error) throw subscriptionQuery.error;
  const publications = (publicationQuery.data || []) as unknown as CleanupRow[];
  const subscriptions = (subscriptionQuery.data || []) as unknown as CleanupRow[];
  const [normalizedPublications, normalizedSubscriptions] = await Promise.all([
    normalizeTerminalRows(db, "live_published_tracks", publications),
    normalizeTerminalRows(db, "live_track_subscriptions", subscriptions),
  ]);
  const publicationResult = await reconcileRows(db, "live_published_tracks", publications.filter(row => due(row, forced, !!options.forceAll)));
  const subscriptionResult = await reconcileRows(db, "live_track_subscriptions", subscriptions.filter(row => due(row, forced, !!options.forceAll)));
  if (forced.size || options.forceAll) {
    const connectionIds = options.forceAll
      ? [...new Set([...publications, ...subscriptions].map(row => row.connection_id))]
      : [...forced];
    if (connectionIds.length) {
      const now = new Date().toISOString();
      const updates = await Promise.all([
        db.from("live_media_connections").update({ status: "closed", closed_at: now }).in("id", connectionIds),
        db.from("live_attendance_intervals").update({ ended_at: now, ended_reason: "stale" }).in("connection_id", connectionIds).is("ended_at", null),
      ]);
      const updateError = updates.find(result => result.error)?.error;
      if (updateError) throw updateError;
    }
  }
  return {
    candidates: forced.size,
    closedPublications: normalizedPublications + publicationResult.closed,
    expiredPublications: publicationResult.expired,
    failedPublications: publicationResult.failed,
    closedSubscriptions: normalizedSubscriptions + subscriptionResult.closed,
    expiredSubscriptions: subscriptionResult.expired,
    failedSubscriptions: subscriptionResult.failed,
  };
}

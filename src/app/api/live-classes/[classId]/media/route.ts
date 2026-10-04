import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertLiveFeature } from "@/lib/live-class/config";
import { assertClassroomMode, authorizeLiveClass, LiveAuthorizationError, mayPublish } from "@/lib/live-class/authorization";
import { cloudflareRealtime, CloudflareRealtimeError, getIceServers, type PublishedTrackKind, type SdpDescription } from "@/lib/live-class/provider";
import { isSameOriginRequest } from "@/lib/request-origin";
import { consumeLiveRateLimit } from "@/lib/live-class/rate-limit";
import { closeProviderTracks } from "@/lib/live-class/transport-cleanup";
import { stagingTestWindowOpen } from "@/lib/live-class/staging-window";
import { terminalSessionStatus } from "@/lib/live-class/session-status";

type Body = {
  action?: "create" | "publish" | "subscribe" | "unsubscribe" | "renegotiate" | "close" | "heartbeat" | "leave" | "stats";
  mode?: "poc" | "classroom";
  connectionId?: string;
  sessionDescription?: SdpDescription;
  publications?: { kind?: PublishedTrackKind; mid?: string }[];
  trackIds?: string[];
  stats?: {
    sampledFrom?: string; sampledTo?: string;
    sentMicrophoneBytes?: number; sentCameraBytes?: number; sentScreenBytes?: number; sentUnclassifiedBytes?: number;
    receivedMicrophoneBytes?: number; receivedCameraBytes?: number; receivedScreenBytes?: number; receivedUnclassifiedBytes?: number;
    packetsLost?: number; jitterMs?: number | null; rttMs?: number | null; candidateType?: string | null; reconnectCount?: number;
  };
};
type Connection = {
  id: string; user_id: string; session_id: string; provider_session_id: string | null;
  publisher_provider_session_id: string | null; status: string;
};
type Track = {
  id: string; session_id: string; owner_id: string; connection_id: string; kind: PublishedTrackKind;
  provider_track_name: string; provider_mid: string; status: string;
  live_media_connections?:
    | { provider_session_id: string | null; publisher_provider_session_id?: string | null }
    | { provider_session_id: string | null; publisher_provider_session_id?: string | null }[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validDescription = (value: unknown): value is SdpDescription => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SdpDescription>;
  return (candidate.type === "offer" || candidate.type === "answer") && typeof candidate.sdp === "string" && candidate.sdp.length > 20 && candidate.sdp.length < 2_000_000;
};
const jsonError = (message: string, status: number, headers?: HeadersInit) => NextResponse.json({ error: message }, { status, headers });
const providerSession = (track: Track) => {
  const value = Array.isArray(track.live_media_connections) ? track.live_media_connections[0] : track.live_media_connections;
  return value?.publisher_provider_session_id || value?.provider_session_id;
};

async function ownedConnection(db: Awaited<ReturnType<typeof createClient>>, classId: string, userId: string, connectionId: string, allowClosed = false) {
  if (!uuid.test(connectionId)) throw new LiveAuthorizationError("Invalid connection", 400);
  const { data } = await db.from("live_media_connections").select("id,user_id,session_id,provider_session_id,publisher_provider_session_id,status")
    .eq("id", connectionId).eq("session_id", classId).eq("user_id", userId).maybeSingle();
  if (!data || (!allowClosed && !["active", "reconnecting"].includes(data.status))) throw new LiveAuthorizationError("Owned media connection is unavailable", 403);
  return data as Connection;
}

async function forceCloseTracks(db: Awaited<ReturnType<typeof createClient>>, tracks: Track[]) {
  const result = await closeProviderTracks(tracks);
  if (result.closed.length) await db.from("live_published_tracks").update({
    status: "closed", closed_at: new Date().toISOString(), cleanup_retry_at: null, last_cleanup_error: null,
  }).in("id", result.closed);
  if (result.expired.length) await db.from("live_published_tracks").update({
    status: "closed", closed_at: new Date().toISOString(), cleanup_retry_at: null, last_cleanup_error: null,
    provider_reconciliation_outcome: "confirmed_absent_or_expired", provider_reconciled_at: new Date().toISOString(),
    provider_reconciliation_http_status: 410, provider_reconciliation_error_code: "session_error",
    provider_reconciliation_detail: "Cloudflare reports the provider session expired or closed",
  }).in("id", result.expired);
  if (result.failed.length) await db.from("live_published_tracks").update({
    status: "failed", cleanup_attempts: 1, cleanup_retry_at: new Date(Date.now() + 10_000).toISOString(),
    last_cleanup_error: "Provider close is unresolved",
  }).in("id", result.failed);
  if (result.failed.length) throw new CloudflareRealtimeError("Cloudflare could not close every requested publication", 502, true);
}

async function closeSubscriptions(
  db: Awaited<ReturnType<typeof createClient>>,
  connection: Pick<Connection, "id" | "provider_session_id">,
) {
  const { data } = await db.from("live_track_subscriptions").select("id,provider_mid")
    .eq("connection_id", connection.id).eq("status", "active");
  if (!data?.length) return;
  const ids = data.map(value => value.id);
  const mids = data.flatMap(value => value.provider_mid ? [value.provider_mid] : []);
  try {
    if (mids.length && connection.provider_session_id) await cloudflareRealtime.closeTracks(connection.provider_session_id, mids);
    await db.from("live_track_subscriptions").update({
      status: "closed", closed_at: new Date().toISOString(), cleanup_retry_at: null, last_cleanup_error: null,
    }).in("id", ids);
  } catch (error) {
    await db.from("live_track_subscriptions").update({
      status: "failed", cleanup_attempts: 1, cleanup_retry_at: new Date(Date.now() + 10_000).toISOString(),
      last_cleanup_error: error instanceof Error ? error.message.slice(0, 500) : "Provider close is unresolved",
    }).in("id", ids);
    throw error;
  }
}

export async function GET(request: Request, context: RouteContext<"/api/live-classes/[classId]/media">) {
  const { classId } = await context.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return jsonError("Unauthorized", 401);
  try {
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode !== "poc" && mode !== "classroom") return jsonError("Classroom mode is required", 400);
    assertLiveFeature(mode);
    const authorization = await authorizeLiveClass(db, auth.user.id, classId, "view");
    assertClassroomMode(authorization.session, mode);
    // A publication event may trigger discovery while Teacher End is in flight.
    // Eligible members receive authoritative terminal state, never new media.
    if (terminalSessionStatus(authorization.session.status)) {
      return NextResponse.json({ tracks: [], status: authorization.session.status }, { headers: { "Cache-Control": "no-store" } });
    }
    await authorizeLiveClass(db, auth.user.id, classId, "connect");
    const { data, error } = await db.from("live_published_tracks")
      .select("id,owner_id,kind,created_at").eq("session_id", classId).eq("status", "active").order("created_at");
    if (error) throw error;
    return NextResponse.json({ tracks: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LiveAuthorizationError) return jsonError(error.message, error.status);
    return jsonError("Class media discovery failed", 502);
  }
}

export async function POST(request: Request, context: RouteContext<"/api/live-classes/[classId]/media">) {
  if (!isSameOriginRequest(request)) return jsonError("Invalid origin", 403);
  const { classId } = await context.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return jsonError("Unauthorized", 401);
  const rate = consumeLiveRateLimit(`${auth.user.id}:${classId}`);
  if (!rate.allowed) return jsonError("Too many classroom operations", 429, { "Retry-After": String(rate.retryAfterSeconds) });
  let body: Body;
  try { body = await request.json() as Body; } catch { return jsonError("Invalid JSON request", 400); }
  if (!body.action || !body.mode) return jsonError("Invalid media operation", 400);
  if (["create", "publish", "subscribe"].includes(body.action) && !stagingTestWindowOpen()) return jsonError("Staging test window is closed", 403);

  try {
    const configuration = assertLiveFeature(body.mode);
    if (!configuration.realtimeConfigured) return jsonError(`Cloudflare Realtime is not configured (${configuration.missingRealtime.join(", ")})`, 503);
    const teardown = ["heartbeat", "leave", "stats"].includes(body.action);
    const authorization = await authorizeLiveClass(db, auth.user.id, classId, teardown ? "view" : "connect");
    assertClassroomMode(authorization.session, body.mode);
    const ended = terminalSessionStatus(authorization.session.status);
    if (teardown && !ended) await authorizeLiveClass(db, auth.user.id, classId, "connect");
    if (teardown && ended) {
      if (!body.connectionId) return jsonError("Connection is required", 400);
      await ownedConnection(db, classId, auth.user.id, body.connectionId, true);
      if (body.action !== "stats") {
        // End/cleanup owns provider closure. A late heartbeat must never revive
        // the closed connection; repeated leave is an acknowledged no-op.
        return NextResponse.json({ alive: false, left: true, status: authorization.session.status });
      }
    }

    if (body.action === "create") {
      const { data: prior } = await db.from("live_media_connections")
        .select("id,user_id,session_id,provider_session_id,publisher_provider_session_id,status").eq("session_id", classId).eq("user_id", auth.user.id)
        .in("status", ["active", "reconnecting"]).maybeSingle();
      if (!prior && authorization.role === "student" && authorization.session.max_receivers) {
        const { count, error: countError } = await db.from("live_media_connections").select("id", { count: "exact", head: true })
          .eq("session_id", classId).in("status", ["active", "reconnecting"])
          .neq("user_id", authorization.session.faculty_id);
        if (countError) throw countError;
        if ((count || 0) >= authorization.session.max_receivers) throw new LiveAuthorizationError("This class has reached its configured receiver limit", 409);
      }
      if (prior) {
        const { data: oldTracks } = await db.from("live_published_tracks")
          .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id,publisher_provider_session_id)")
          .eq("connection_id", prior.id).eq("status", "active");
        await forceCloseTracks(db, (oldTracks || []) as unknown as Track[]).catch(() => undefined);
        await closeSubscriptions(db, prior as Connection).catch(() => undefined);
        await db.from("live_media_connections").update({ status: "stale", closed_at: new Date().toISOString() }).eq("id", prior.id);
        await db.from("live_attendance_intervals").update({ ended_at: new Date().toISOString(), ended_reason: "replaced" }).eq("connection_id", prior.id).is("ended_at", null);
      }
      const id = crypto.randomUUID();
      const { error } = await db.from("live_media_connections").insert({ id, session_id: classId, user_id: auth.user.id });
      if (error) throw error;
      await db.from("live_attendance_intervals").insert({ session_id: classId, user_id: auth.user.id, connection_id: id });
      const { error: presenceError } = await db.rpc("set_live_presence", { target_session: classId, joined: true });
      if (presenceError) throw presenceError;
      const { error: heartbeatError } = await db.rpc("heartbeat_live_connection", { target_connection: id });
      if (heartbeatError) throw heartbeatError;
      return NextResponse.json({ connectionId: id, iceServers: await getIceServers(), turnConfigured: configuration.turnConfigured });
    }

    if (!body.connectionId) return jsonError("Connection is required", 400);
    const connection = await ownedConnection(db, classId, auth.user.id, body.connectionId, teardown);
    if (["heartbeat", "leave"].includes(body.action) && !["active", "reconnecting"].includes(connection.status)) {
      // Refresh or rejoin can replace this owned connection while an earlier
      // heartbeat/leave is still in flight. Acknowledge it without touching
      // attendance, the replacement connection, or provider publications.
      return NextResponse.json({ alive: false, left: true, status: authorization.session.status });
    }

    if (body.action === "heartbeat") {
      const { error } = await db.rpc("heartbeat_live_connection", { target_connection: connection.id });
      if (error) throw error;
      return NextResponse.json({ alive: true });
    }

    if (body.action === "publish") {
      if (!validDescription(body.sessionDescription) || !body.publications?.length || body.publications.length > 3) return jsonError("Invalid publication", 400);
      const { data: participant } = await db.from("live_participants")
        .select("audio_publish_allowed,presenter,screen_publish_allowed").eq("session_id", classId).eq("user_id", auth.user.id).maybeSingle();
      const seen = new Set<PublishedTrackKind>();
      const publications = body.publications.map(value => {
        if (!value.kind || !["microphone", "camera", "screen"].includes(value.kind) || !value.mid || value.mid.length > 32 || seen.has(value.kind)) {
          throw new LiveAuthorizationError("Invalid or duplicate publication", 400);
        }
        seen.add(value.kind);
        if (!mayPublish(authorization, participant, value.kind)) throw new LiveAuthorizationError(`${value.kind} publishing is not granted`);
        const id = crypto.randomUUID();
        return { id, kind: value.kind, mid: value.mid, trackName: `als-${id}` };
      });
      const { data: existing } = await db.from("live_published_tracks")
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id,publisher_provider_session_id)")
        .eq("connection_id", connection.id).in("kind", publications.map(value => value.kind)).eq("status", "active");
      if (existing?.length) await forceCloseTracks(db, existing as unknown as Track[]);
      let publicationSessionId = connection.publisher_provider_session_id;
      if (!publicationSessionId) {
        publicationSessionId = await cloudflareRealtime.createSession(`${classId}:${auth.user.id}:${connection.id}:publish`);
        const { error: publisherSessionError } = await db.from("live_media_connections")
          .update({ publisher_provider_session_id: publicationSessionId }).eq("id", connection.id).is("publisher_provider_session_id", null);
        if (publisherSessionError) throw publisherSessionError;
      }
      const response = await cloudflareRealtime.publishTracks(publicationSessionId, body.sessionDescription, publications.map(value => ({ mid: value.mid, trackName: value.trackName })));
      const { error } = await db.from("live_published_tracks").insert(publications.map(value => ({
        id: value.id, session_id: classId, connection_id: connection.id, owner_id: auth.user.id, kind: value.kind,
        provider_track_name: value.trackName, provider_mid: value.mid,
      })));
      if (error) {
        await cloudflareRealtime.closeTracks(publicationSessionId, publications.map(value => value.mid)).catch(() => undefined);
        throw error;
      }
      return NextResponse.json({ sessionDescription: response.sessionDescription, tracks: publications.map(value => ({ id: value.id, kind: value.kind, mid: value.mid })) });
    }

    if (body.action === "subscribe") {
      const ids = [...new Set(body.trackIds || [])];
      if (!ids.length || ids.length > 64 || ids.some(id => !uuid.test(id))) return jsonError("Invalid track selection", 400);
      const { data } = await db.from("live_published_tracks")
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id,publisher_provider_session_id)")
        .eq("session_id", classId).eq("status", "active").in("id", ids);
      const tracks = (data || []) as unknown as Track[];
      if (tracks.length !== ids.length) throw new LiveAuthorizationError("A selected publication is unavailable");
      let receivingSessionId = connection.provider_session_id;
      if (!receivingSessionId) {
        receivingSessionId = await cloudflareRealtime.createSession(`${classId}:${auth.user.id}:${connection.id}:receive`);
        const { error: receivingSessionError } = await db.from("live_media_connections")
          .update({ provider_session_id: receivingSessionId }).eq("id", connection.id).is("provider_session_id", null);
        if (receivingSessionError) throw receivingSessionError;
      }
      const response = await cloudflareRealtime.subscribeTracks(receivingSessionId, tracks.map(track => ({
        sessionId: providerSession(track)!, trackName: track.provider_track_name,
      })));
      const subscriptions = tracks.map((track, index) => ({
        session_id: classId, connection_id: connection.id, track_id: track.id,
        provider_mid: response.tracks?.[index]?.mid || null, status: "active", closed_at: null,
      }));
      const { error } = await db.from("live_track_subscriptions").upsert(subscriptions, { onConflict: "connection_id,track_id" });
      if (error) throw error;
      return NextResponse.json({
        sessionDescription: response.sessionDescription,
        tracks: tracks.map((track, index) => ({ id: track.id, kind: track.kind, ownerId: track.owner_id, mid: response.tracks?.[index]?.mid })),
      });
    }

    if (body.action === "unsubscribe") {
      const ids = [...new Set(body.trackIds || [])];
      if (!ids.length || ids.length > 64 || ids.some(id => !uuid.test(id))) return jsonError("Invalid subscription selection", 400);
      const { data } = await db.from("live_track_subscriptions").select("id,track_id,provider_mid,status")
        .eq("connection_id", connection.id).eq("session_id", classId).eq("status", "active").in("track_id", ids);
      if (!data || data.length !== ids.length || data.some(value => !value.provider_mid)) throw new LiveAuthorizationError("Owned subscriptions are unavailable");
      if (!connection.provider_session_id) throw new LiveAuthorizationError("Receiving media session is unavailable", 409);
      await cloudflareRealtime.closeTracks(connection.provider_session_id, data.map(value => value.provider_mid!));
      await db.from("live_track_subscriptions").update({ status: "closed", closed_at: new Date().toISOString() }).in("id", data.map(value => value.id));
      return NextResponse.json({ unsubscribed: ids });
    }

    if (body.action === "renegotiate") {
      if (!validDescription(body.sessionDescription) || body.sessionDescription.type !== "answer") return jsonError("Invalid negotiation answer", 400);
      if (!connection.provider_session_id) throw new LiveAuthorizationError("Receiving media session is unavailable", 409);
      await cloudflareRealtime.renegotiate(connection.provider_session_id, body.sessionDescription);
      return NextResponse.json({ accepted: true });
    }

    if (body.action === "close") {
      const ids = [...new Set(body.trackIds || [])];
      if (!ids.length || ids.some(id => !uuid.test(id))) return jsonError("Invalid track closure", 400);
      const { data } = await db.from("live_published_tracks")
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id,publisher_provider_session_id)")
        .eq("session_id", classId).eq("owner_id", auth.user.id).eq("status", "active").in("id", ids);
      const tracks = (data || []) as unknown as Track[];
      if (tracks.length !== ids.length) throw new LiveAuthorizationError("Only owned publications may be closed");
      await forceCloseTracks(db, tracks);
      return NextResponse.json({ closed: ids });
    }

    if (body.action === "stats") {
      const stats = body.stats;
      const from = stats?.sampledFrom ? Date.parse(stats.sampledFrom) : NaN;
      const to = stats?.sampledTo ? Date.parse(stats.sampledTo) : NaN;
      if (!stats || !Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 5 * 60_000) return jsonError("Invalid statistics interval", 400);
      const nonnegative = [
        stats.sentMicrophoneBytes, stats.sentCameraBytes, stats.sentScreenBytes, stats.sentUnclassifiedBytes,
        stats.receivedMicrophoneBytes, stats.receivedCameraBytes, stats.receivedScreenBytes, stats.receivedUnclassifiedBytes,
        stats.reconnectCount,
      ];
      if (nonnegative.some(value => !Number.isSafeInteger(value) || value! < 0)) return jsonError("Invalid statistics counters", 400);
      const { error } = await db.from("live_usage_summaries").insert({
        session_id: classId, user_id: auth.user.id, connection_id: connection.id,
        sampled_from: stats.sampledFrom, sampled_to: stats.sampledTo, classification_version: 2,
        sent_microphone_bytes: stats.sentMicrophoneBytes, sent_camera_bytes: stats.sentCameraBytes,
        sent_screen_bytes: stats.sentScreenBytes, sent_unclassified_bytes: stats.sentUnclassifiedBytes,
        received_microphone_bytes: stats.receivedMicrophoneBytes, received_camera_bytes: stats.receivedCameraBytes,
        received_screen_bytes: stats.receivedScreenBytes, received_unclassified_bytes: stats.receivedUnclassifiedBytes,
        audio_bytes: stats.receivedMicrophoneBytes, video_bytes: stats.receivedCameraBytes, screen_bytes: stats.receivedScreenBytes,
        packets_lost: Math.trunc(stats.packetsLost || 0),
        jitter_ms: stats.jitterMs ?? null, rtt_ms: stats.rttMs ?? null,
        candidate_type: stats.candidateType?.slice(0, 32) || null, reconnect_count: stats.reconnectCount,
      });
      if (error) throw error;
      return NextResponse.json({ accepted: true });
    }

    if (body.action === "leave") {
      const { data } = await db.from("live_published_tracks")
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id,publisher_provider_session_id)")
        .eq("connection_id", connection.id).eq("status", "active");
      await forceCloseTracks(db, (data || []) as unknown as Track[]).catch(() => undefined);
      await closeSubscriptions(db, connection).catch(() => undefined);
      const at = new Date().toISOString();
      await Promise.all([
        db.from("live_media_connections").update({ status: "closed", closed_at: at }).eq("id", connection.id),
        db.from("live_attendance_intervals").update({ ended_at: at, ended_reason: "left" }).eq("connection_id", connection.id).is("ended_at", null),
        db.from("live_participants").update({ left_at: at, connection_lease_expires_at: at }).eq("session_id", classId).eq("user_id", auth.user.id),
      ]);
      return NextResponse.json({ left: true });
    }
    return jsonError("Unsupported media operation", 400);
  } catch (error) {
    if (error instanceof LiveAuthorizationError) return jsonError(error.message, error.status);
    if (error instanceof CloudflareRealtimeError) return jsonError(error.message, error.status >= 400 && error.status < 600 ? error.status : 502);
    return jsonError(error instanceof Error && error.message.includes("disabled") ? error.message : "Class media operation failed", 502);
  }
}

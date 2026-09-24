import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertLiveFeature } from "@/lib/live-class/config";
import { assertClassroomMode, authorizeLiveClass, LiveAuthorizationError, mayPublish } from "@/lib/live-class/authorization";
import { cloudflareRealtime, CloudflareRealtimeError, getIceServers, type PublishedTrackKind, type SdpDescription } from "@/lib/live-class/provider";
import { consumeLiveRateLimit } from "@/lib/live-class/rate-limit";

type Body = {
  action?: "create" | "publish" | "subscribe" | "unsubscribe" | "renegotiate" | "close" | "heartbeat" | "leave" | "stats";
  mode?: "poc" | "classroom";
  connectionId?: string;
  sessionDescription?: SdpDescription;
  publications?: { kind?: PublishedTrackKind; mid?: string }[];
  trackIds?: string[];
  stats?: {
    sampledFrom?: string; sampledTo?: string; audioBytes?: number; videoBytes?: number; screenBytes?: number;
    packetsLost?: number; jitterMs?: number | null; rttMs?: number | null; candidateType?: string | null; reconnectCount?: number;
  };
};
type Connection = { id: string; user_id: string; session_id: string; provider_session_id: string; status: string };
type Track = {
  id: string; session_id: string; owner_id: string; connection_id: string; kind: PublishedTrackKind;
  provider_track_name: string; provider_mid: string; status: string;
  live_media_connections?: { provider_session_id: string } | { provider_session_id: string }[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validDescription = (value: unknown): value is SdpDescription => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SdpDescription>;
  return (candidate.type === "offer" || candidate.type === "answer") && typeof candidate.sdp === "string" && candidate.sdp.length > 20 && candidate.sdp.length < 2_000_000;
};
const jsonError = (message: string, status: number, headers?: HeadersInit) => NextResponse.json({ error: message }, { status, headers });
const sameOrigin = (request: Request) => !request.headers.get("origin") || request.headers.get("origin") === new URL(request.url).origin;
const providerSession = (track: Track) => {
  const value = Array.isArray(track.live_media_connections) ? track.live_media_connections[0] : track.live_media_connections;
  return value?.provider_session_id;
};

async function ownedConnection(db: Awaited<ReturnType<typeof createClient>>, classId: string, userId: string, connectionId: string) {
  if (!uuid.test(connectionId)) throw new LiveAuthorizationError("Invalid connection", 400);
  const { data } = await db.from("live_media_connections").select("id,user_id,session_id,provider_session_id,status")
    .eq("id", connectionId).eq("session_id", classId).eq("user_id", userId).maybeSingle();
  if (!data || !["active", "reconnecting"].includes(data.status)) throw new LiveAuthorizationError("Owned media connection is unavailable", 403);
  return data as Connection;
}

async function forceCloseTracks(db: Awaited<ReturnType<typeof createClient>>, tracks: Track[]) {
  const grouped = new Map<string, { mids: string[]; ids: string[] }>();
  for (const track of tracks) {
    const sessionId = providerSession(track);
    if (!sessionId) continue;
    const value = grouped.get(sessionId) || { mids: [], ids: [] };
    value.mids.push(track.provider_mid);
    value.ids.push(track.id);
    grouped.set(sessionId, value);
  }
  for (const [sessionId, value] of grouped) {
    const response = await cloudflareRealtime.closeTracks(sessionId, value.mids);
    const closed = value.ids.filter((_, index) => !response.tracks?.[index]?.errorCode);
    const failed = value.ids.filter((_, index) => Boolean(response.tracks?.[index]?.errorCode));
    if (closed.length) await db.from("live_published_tracks").update({ status: "closed", closed_at: new Date().toISOString() }).in("id", closed);
    if (failed.length) await db.from("live_published_tracks").update({ status: "failed", closed_at: new Date().toISOString() }).in("id", failed);
    if (failed.length) throw new CloudflareRealtimeError("Cloudflare could not close every requested publication", 502, true);
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
    const authorization = await authorizeLiveClass(db, auth.user.id, classId, "connect");
    assertClassroomMode(authorization.session, mode);
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
  if (!sameOrigin(request)) return jsonError("Invalid origin", 403);
  const { classId } = await context.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return jsonError("Unauthorized", 401);
  const rate = consumeLiveRateLimit(`${auth.user.id}:${classId}`);
  if (!rate.allowed) return jsonError("Too many classroom operations", 429, { "Retry-After": String(rate.retryAfterSeconds) });
  let body: Body;
  try { body = await request.json() as Body; } catch { return jsonError("Invalid JSON request", 400); }
  if (!body.action || !body.mode) return jsonError("Invalid media operation", 400);

  try {
    const configuration = assertLiveFeature(body.mode);
    if (!configuration.realtimeConfigured) return jsonError(`Cloudflare Realtime is not configured (${configuration.missingRealtime.join(", ")})`, 503);
    const authorization = await authorizeLiveClass(db, auth.user.id, classId, "connect");
    assertClassroomMode(authorization.session, body.mode);

    if (body.action === "create") {
      const { data: prior } = await db.from("live_media_connections")
        .select("id,user_id,session_id,provider_session_id,status").eq("session_id", classId).eq("user_id", auth.user.id)
        .in("status", ["active", "reconnecting"]).maybeSingle();
      if (!prior && authorization.session.max_receivers) {
        const { count } = await db.from("live_media_connections").select("id", { count: "exact", head: true })
          .eq("session_id", classId).in("status", ["active", "reconnecting"]);
        if ((count || 0) >= authorization.session.max_receivers) throw new LiveAuthorizationError("This class has reached its configured receiver limit", 409);
      }
      if (prior) {
        const { data: oldTracks } = await db.from("live_published_tracks")
          .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id)")
          .eq("connection_id", prior.id).eq("status", "active");
        await forceCloseTracks(db, (oldTracks || []) as unknown as Track[]).catch(() => undefined);
        await db.from("live_media_connections").update({ status: "stale", closed_at: new Date().toISOString() }).eq("id", prior.id);
        await db.from("live_attendance_intervals").update({ ended_at: new Date().toISOString(), ended_reason: "replaced" }).eq("connection_id", prior.id).is("ended_at", null);
      }
      const id = crypto.randomUUID();
      const cloudflareSessionId = await cloudflareRealtime.createSession(`${classId}:${auth.user.id}:${id}`);
      const { error } = await db.from("live_media_connections").insert({ id, session_id: classId, user_id: auth.user.id, provider_session_id: cloudflareSessionId });
      if (error) throw error;
      await db.from("live_attendance_intervals").insert({ session_id: classId, user_id: auth.user.id, connection_id: id });
      const { error: presenceError } = await db.rpc("set_live_presence", { target_session: classId, joined: true });
      if (presenceError) throw presenceError;
      const { error: heartbeatError } = await db.rpc("heartbeat_live_connection", { target_connection: id });
      if (heartbeatError) throw heartbeatError;
      return NextResponse.json({ connectionId: id, iceServers: await getIceServers(), turnConfigured: configuration.turnConfigured });
    }

    if (!body.connectionId) return jsonError("Connection is required", 400);
    const connection = await ownedConnection(db, classId, auth.user.id, body.connectionId);

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
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id)")
        .eq("connection_id", connection.id).in("kind", publications.map(value => value.kind)).eq("status", "active");
      if (existing?.length) await forceCloseTracks(db, existing as unknown as Track[]);
      const response = await cloudflareRealtime.publishTracks(connection.provider_session_id, body.sessionDescription, publications.map(value => ({ mid: value.mid, trackName: value.trackName })));
      const { error } = await db.from("live_published_tracks").insert(publications.map(value => ({
        id: value.id, session_id: classId, connection_id: connection.id, owner_id: auth.user.id, kind: value.kind,
        provider_track_name: value.trackName, provider_mid: value.mid,
      })));
      if (error) {
        await cloudflareRealtime.closeTracks(connection.provider_session_id, publications.map(value => value.mid)).catch(() => undefined);
        throw error;
      }
      return NextResponse.json({ sessionDescription: response.sessionDescription, tracks: publications.map(value => ({ id: value.id, kind: value.kind, mid: value.mid })) });
    }

    if (body.action === "subscribe") {
      const ids = [...new Set(body.trackIds || [])];
      if (!ids.length || ids.length > 64 || ids.some(id => !uuid.test(id))) return jsonError("Invalid track selection", 400);
      const { data } = await db.from("live_published_tracks")
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id)")
        .eq("session_id", classId).eq("status", "active").in("id", ids);
      const tracks = (data || []) as unknown as Track[];
      if (tracks.length !== ids.length) throw new LiveAuthorizationError("A selected publication is unavailable");
      const response = await cloudflareRealtime.subscribeTracks(connection.provider_session_id, tracks.map(track => ({
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
      await cloudflareRealtime.closeTracks(connection.provider_session_id, data.map(value => value.provider_mid!));
      await db.from("live_track_subscriptions").update({ status: "closed", closed_at: new Date().toISOString() }).in("id", data.map(value => value.id));
      return NextResponse.json({ unsubscribed: ids });
    }

    if (body.action === "renegotiate") {
      if (!validDescription(body.sessionDescription) || body.sessionDescription.type !== "answer") return jsonError("Invalid negotiation answer", 400);
      await cloudflareRealtime.renegotiate(connection.provider_session_id, body.sessionDescription);
      return NextResponse.json({ accepted: true });
    }

    if (body.action === "close") {
      const ids = [...new Set(body.trackIds || [])];
      if (!ids.length || ids.some(id => !uuid.test(id))) return jsonError("Invalid track closure", 400);
      const { data } = await db.from("live_published_tracks")
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id)")
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
      const nonnegative = [stats.audioBytes, stats.videoBytes, stats.screenBytes, stats.reconnectCount];
      if (nonnegative.some(value => !Number.isSafeInteger(value) || value! < 0)) return jsonError("Invalid statistics counters", 400);
      const { error } = await db.from("live_usage_summaries").insert({
        session_id: classId, user_id: auth.user.id, connection_id: connection.id,
        sampled_from: stats.sampledFrom, sampled_to: stats.sampledTo, audio_bytes: stats.audioBytes,
        video_bytes: stats.videoBytes, screen_bytes: stats.screenBytes, packets_lost: Math.trunc(stats.packetsLost || 0),
        jitter_ms: stats.jitterMs ?? null, rtt_ms: stats.rttMs ?? null,
        candidate_type: stats.candidateType?.slice(0, 32) || null, reconnect_count: stats.reconnectCount,
      });
      if (error) throw error;
      return NextResponse.json({ accepted: true });
    }

    if (body.action === "leave") {
      const { data } = await db.from("live_published_tracks")
        .select("id,session_id,owner_id,connection_id,kind,provider_track_name,provider_mid,status,live_media_connections!inner(provider_session_id)")
        .eq("connection_id", connection.id).eq("status", "active");
      await forceCloseTracks(db, (data || []) as unknown as Track[]).catch(() => undefined);
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

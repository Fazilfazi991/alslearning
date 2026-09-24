import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { assertLiveFeature } from "@/lib/live-class/config";
import { assertClassroomMode, authorizeLiveClass, LiveAuthorizationError } from "@/lib/live-class/authorization";
import { consumeLiveRateLimit } from "@/lib/live-class/rate-limit";
import { closeProviderTracks, type ClosableTrack } from "@/lib/live-class/transport-cleanup";
import { reconcileClassTransport } from "@/lib/live-class/transport-reconciliation";

type Body = {
  action?: "start" | "end" | "cancel" | "reschedule" | "grant" | "remove" | "reconcile";
  mode?: "poc" | "classroom";
  targetUserId?: string;
  grant?: "microphone" | "presenter";
  granted?: boolean;
  title?: string;
  startsAt?: string;
  endsAt?: string;
};
// PostgreSQL's uuid type accepts the full canonical 8-4-4-4-12 form. Do not
// reject database-issued or synthetic UUIDs solely because their version or
// variant bits are not encoded like an RFC 4122 random UUID.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request, context: RouteContext<"/api/live-classes/[classId]/control">) {
  if (!isSameOriginRequest(request)) return failure("Invalid origin", 403);
  const { classId } = await context.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return failure("Unauthorized", 401);
  const rate = consumeLiveRateLimit(`control:${auth.user.id}:${classId}`, 45, 60_000);
  if (!rate.allowed) return failure("Too many classroom control requests", 429);
  let body: Body;
  try { body = await request.json() as Body; } catch { return failure("Invalid JSON request", 400); }
  if (!body.action || !body.mode) return failure("Invalid classroom control", 400);
  try {
    assertLiveFeature(body.mode);
    const authorization = await authorizeLiveClass(db, auth.user.id, classId, "manage");
    assertClassroomMode(authorization.session, body.mode);
    const now = new Date().toISOString();

    if (body.action === "start") {
      if (authorization.session.status !== "scheduled") return failure("Only a scheduled class can be started", 409);
      const { error } = await db.from("live_sessions").update({ status: "live", provider: body.mode === "poc" ? "cloudflare-poc" : "cloudflare", updated_at: now }).eq("id", classId).eq("status", "scheduled");
      if (error) throw error;
      return NextResponse.json({ status: "live" });
    }

    if (body.action === "reschedule") {
      if (!["draft", "scheduled"].includes(authorization.session.status)) return failure("A live or ended class cannot be rescheduled", 409);
      const startsAt = body.startsAt ? new Date(body.startsAt) : null;
      const endsAt = body.endsAt ? new Date(body.endsAt) : null;
      if (!body.title?.trim() || body.title.trim().length > 180 || !startsAt || !endsAt || !Number.isFinite(startsAt.valueOf()) || !Number.isFinite(endsAt.valueOf()) || endsAt <= startsAt) return failure("Valid title and UTC class window are required", 400);
      const { error } = await db.from("live_sessions").update({
        title: body.title.trim(), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        join_opens_at: new Date(startsAt.valueOf() - 15 * 60_000).toISOString(), join_closes_at: endsAt.toISOString(), updated_at: now,
      }).eq("id", classId);
      if (error) throw error;
      return NextResponse.json({ status: authorization.session.status });
    }

    if (body.action === "cancel") {
      if (!["draft", "scheduled"].includes(authorization.session.status)) return failure("A live or ended class cannot be cancelled", 409);
      const { error } = await db.from("live_sessions").update({ status: "cancelled", cancelled_at: now, updated_at: now }).eq("id", classId);
      if (error) throw error;
      return NextResponse.json({ status: "cancelled" });
    }

    if (body.action === "end") {
      if (authorization.session.status !== "live") return failure("Only a live class can be ended", 409);
      const ended = await Promise.all([
        db.from("live_sessions").update({ status: "completed", ended_at: now, updated_at: now }).eq("id", classId),
        db.from("live_media_connections").update({ status: "closed", closed_at: now }).eq("session_id", classId).in("status", ["active", "reconnecting"]),
        db.from("live_attendance_intervals").update({ ended_at: now, ended_reason: "ended" }).eq("session_id", classId).is("ended_at", null),
      ]);
      const endError = ended.find(result => result.error)?.error;
      if (endError) throw endError;
      const cleanup = await reconcileClassTransport(db, classId, { forceAll: true });
      return NextResponse.json({ status: "completed", ...cleanup });
    }

    if (body.action === "reconcile") {
      if (!["live", "completed"].includes(authorization.session.status)) return NextResponse.json({ candidates: 0, closedPublications: 0, failedPublications: 0, closedSubscriptions: 0, failedSubscriptions: 0 });
      return NextResponse.json(await reconcileClassTransport(db, classId));
    }

    if (!body.targetUserId || !uuid.test(body.targetUserId)) return failure("A valid participant is required", 400);
    // The roster function is manager-scoped and security-definer. Using it here
    // avoids depending on profile visibility policies while still excluding
    // removed, inactive, and non-student accounts.
    const { data: roster, error: rosterError } = await db.rpc("live_participant_roster", { target_session: classId });
    if (rosterError) throw rosterError;
    const participant = (roster || []).find((value: { user_id: string }) => value.user_id === body.targetUserId);
    if (!participant) throw new LiveAuthorizationError("Student participant is unavailable", 404);

    if (body.action === "grant") {
      if (!body.grant || typeof body.granted !== "boolean") return failure("Invalid publishing grant", 400);
      const patch = body.grant === "microphone"
        ? { audio_publish_allowed: body.granted }
        : { presenter: body.granted, screen_publish_allowed: body.granted };
      const { error } = await db.from("live_participants").update(patch).eq("session_id", classId).eq("user_id", body.targetUserId);
      if (error) throw error;
      let closed = 0;
      if (!body.granted) {
        const kind = body.grant === "microphone" ? "microphone" : "screen";
        const { data: tracks } = await db.from("live_published_tracks")
          .select("id,provider_mid,live_media_connections!inner(provider_session_id)").eq("session_id", classId)
          .eq("owner_id", body.targetUserId).eq("kind", kind).eq("status", "active");
        const result = await closeProviderTracks((tracks || []) as unknown as ClosableTrack[]);
        closed = result.closed.length;
        if (result.closed.length) await db.from("live_published_tracks").update({ status: "closed", closed_at: now }).in("id", result.closed);
        if (result.failed.length) await db.from("live_published_tracks").update({
          status: "failed", cleanup_attempts: 1, cleanup_retry_at: new Date(Date.now() + 10_000).toISOString(),
          last_cleanup_error: "Grant revocation close is unresolved",
        }).in("id", result.failed);
      }
      return NextResponse.json({ granted: body.granted, kind: body.grant, terminatedPublications: closed });
    }

    if (body.action === "remove") {
      // Revoke ALS authorization before waiting on provider I/O so a hostile
      // client cannot win a new publish/subscribe race during cleanup.
      const revocation = await Promise.all([
        db.from("live_media_connections").update({ status: "closed", closed_at: now }).eq("session_id", classId).eq("user_id", body.targetUserId),
        db.from("live_attendance_intervals").update({ ended_at: now, ended_reason: "ended" }).eq("session_id", classId).eq("user_id", body.targetUserId).is("ended_at", null),
        db.from("live_participants").update({ left_at: now, removed_at: now, removed_by: auth.user.id, audio_publish_allowed: false, presenter: false, screen_publish_allowed: false }).eq("session_id", classId).eq("user_id", body.targetUserId),
      ]);
      const revocationError = revocation.find(result => result.error)?.error;
      if (revocationError) throw revocationError;
      const { data: tracks } = await db.from("live_published_tracks")
        .select("id,provider_mid,live_media_connections!inner(provider_session_id)").eq("session_id", classId)
        .eq("owner_id", body.targetUserId).eq("status", "active");
      const result = await closeProviderTracks((tracks || []) as unknown as ClosableTrack[]);
      if (result.closed.length) await db.from("live_published_tracks").update({ status: "closed", closed_at: now }).in("id", result.closed);
      if (result.failed.length) await db.from("live_published_tracks").update({
        status: "failed", cleanup_attempts: 1, cleanup_retry_at: new Date(Date.now() + 10_000).toISOString(),
        last_cleanup_error: "Participant removal close is unresolved",
      }).in("id", result.failed);
      const { data: subscriptions } = await db.from("live_track_subscriptions")
        .select("id,provider_mid,live_media_connections!inner(provider_session_id,user_id)").eq("session_id", classId).eq("status", "active")
        .eq("live_media_connections.user_id", body.targetUserId);
      const subscriptionResult = await closeProviderTracks((subscriptions || []) as unknown as ClosableTrack[]);
      if (subscriptionResult.closed.length) await db.from("live_track_subscriptions").update({ status: "closed", closed_at: now }).in("id", subscriptionResult.closed);
      if (subscriptionResult.failed.length) await db.from("live_track_subscriptions").update({
        status: "failed", cleanup_attempts: 1, cleanup_retry_at: new Date(Date.now() + 10_000).toISOString(),
        last_cleanup_error: "Participant removal close is unresolved",
      }).in("id", subscriptionResult.failed);
      return NextResponse.json({ removed: true, terminatedPublications: result.closed.length, terminatedSubscriptions: subscriptionResult.closed.length });
    }
    return failure("Unsupported classroom control", 400);
  } catch (error) {
    if (error instanceof LiveAuthorizationError) return failure(error.message, error.status);
    return failure(error instanceof Error && error.message.includes("disabled") ? error.message : "Classroom control failed", 502);
  }
}

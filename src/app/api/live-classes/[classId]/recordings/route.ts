import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { assertLiveFeature } from "@/lib/live-class/config";
import { assertClassroomMode, authorizeLiveClass, LiveAuthorizationError } from "@/lib/live-class/authorization";
import { r2RecordingStorage } from "@/lib/live-class/recording-storage";
import { reconcileMultipartState, validateMultipartCompletion, type AcknowledgedPart } from "@/lib/live-class/recording-parts";
import { consumeLiveRateLimit } from "@/lib/live-class/rate-limit";

type Body = {
  action?: "begin" | "stop" | "sign" | "acknowledge" | "reconcile" | "complete" | "validate" | "interrupt" | "abort" | "review" | "publish" | "unpublish";
  recordingId?: string;
  segmentId?: string;
  contentType?: string;
  partNumber?: number;
  byteLength?: number;
  sha256?: string;
  fullSha256?: string;
  etag?: string;
  durationSeconds?: number;
  seekable?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  mode?: "poc" | "classroom";
};
type Segment = {
  id: string; recording_id: string; session_id: string; owner_id: string; segment_number: number; status: string;
  object_key: string; upload_id: string; mime_type: string; part_size: number; total_bytes: number; object_sha256: string | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = /^[0-9a-f]{64}$/;
const failure = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

async function ownedSegment(db: Awaited<ReturnType<typeof createClient>>, classId: string, userId: string, segmentId: string) {
  if (!uuid.test(segmentId)) throw new LiveAuthorizationError("Invalid recording segment", 400);
  const { data } = await db.from("live_recording_segments").select("id,recording_id,session_id,owner_id,segment_number,status,object_key,upload_id,mime_type,part_size,total_bytes,object_sha256")
    .eq("id", segmentId).eq("session_id", classId).eq("owner_id", userId).maybeSingle();
  if (!data) throw new LiveAuthorizationError("Recording segment is unavailable", 404);
  return data as Segment;
}

export async function GET(request: Request, context: RouteContext<"/api/live-classes/[classId]/recordings">) {
  const { classId } = await context.params;
  const parameters = new URL(request.url).searchParams;
  const recordingId = parameters.get("recordingId") || "";
  const review = parameters.get("review") === "1";
  if (!uuid.test(recordingId)) return failure("Invalid recording", 400);
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return failure("Unauthorized", 401);
  try {
    const authorization = await authorizeLiveClass(db, auth.user.id, classId, "playback");
    if (review && authorization.role !== "admin") throw new LiveAuthorizationError("Admin review is required");
    const { data: recording } = await db.from("class_recordings")
      .select("id,status,published_at,mime_type,duration_seconds").eq("id", recordingId).eq("session_id", classId).maybeSingle();
    if (!recording) throw new LiveAuthorizationError("Recording is unavailable", 404);
    if (!authorization.isClassManager && (recording.status !== "published" || !recording.published_at)) throw new LiveAuthorizationError("Recording is not published");
    let segmentQuery = db.from("live_recording_segments")
      .select("id,segment_number,object_key,mime_type,duration_seconds,client_reported_duration_seconds,total_bytes")
      .eq("recording_id", recordingId);
    segmentQuery = review ? segmentQuery.in("status", ["validating", "ready"]) : segmentQuery.eq("status", "ready");
    const { data: segments, error } = await segmentQuery.order("segment_number");
    if (error || !segments?.length) throw new LiveAuthorizationError("No playable recording segment is ready", 409);
    const signed = await Promise.all(segments.map(async segment => {
      const playback = await r2RecordingStorage.playbackUrl(segment.object_key);
      return { id: segment.id, segmentNumber: segment.segment_number, mimeType: segment.mime_type, durationSeconds: segment.duration_seconds || segment.client_reported_duration_seconds, byteLength: segment.total_bytes, ...playback };
    }));
    return NextResponse.json({ recording: { id: recording.id, status: recording.status, durationSeconds: recording.duration_seconds }, segments: signed }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof LiveAuthorizationError) return failure(error.message, error.status);
    return failure("Recording playback authorization failed", 502);
  }
}

export async function POST(request: Request, context: RouteContext<"/api/live-classes/[classId]/recordings">) {
  if (!isSameOriginRequest(request)) return failure("Invalid origin", 403);
  const { classId } = await context.params;
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return failure("Unauthorized", 401);
  const rate = consumeLiveRateLimit(`recording:${auth.user.id}:${classId}`, 120, 60_000);
  if (!rate.allowed) return failure("Too many recording operations", 429);
  let body: Body;
  try { body = await request.json() as Body; } catch { return failure("Invalid JSON request", 400); }
  if (!body.action || !body.mode) return failure("Invalid recording operation", 400);
  try {
    const configuration = assertLiveFeature("recording");
    assertLiveFeature(body.mode);
    if (!configuration.r2Configured) return failure(`R2 is not configured (${configuration.missingR2.join(", ")})`, 503);
    const managerAction = body.action === "review" || body.action === "publish" || body.action === "unpublish";
    const authorization = await authorizeLiveClass(db, auth.user.id, classId, managerAction ? "manage" : "record");
    assertClassroomMode(authorization.session, body.mode);

    if (body.action === "begin") {
      const contentType = body.contentType?.toLowerCase() || "";
      if (!contentType.startsWith("video/webm") && !contentType.startsWith("video/mp4")) return failure("Unsupported recording container", 400);
      let recordingId = body.recordingId;
      if (recordingId) {
        if (!uuid.test(recordingId)) return failure("Invalid recording", 400);
        const { data } = await db.from("class_recordings").select("id,owner_id,status").eq("id", recordingId).eq("session_id", classId).eq("owner_id", auth.user.id).maybeSingle();
        if (!data || !["recording", "uploading", "interrupted", "failed"].includes(data.status)) throw new LiveAuthorizationError("Recording cannot accept another segment", 409);
      } else {
        const { data: existing } = await db.from("class_recordings").select("id,status").eq("session_id", classId)
          .in("status", ["recording", "uploading", "interrupted", "failed", "validating", "ready"]).limit(1).maybeSingle();
        if (existing) throw new LiveAuthorizationError("This class already has a logical recording; recover or continue its segments", 409);
        recordingId = crypto.randomUUID();
        const { error } = await db.from("class_recordings").insert({ id: recordingId, session_id: classId, owner_id: auth.user.id, status: "recording", mime_type: contentType });
        if (error) throw new LiveAuthorizationError("Another recording already owns this class capture", 409);
      }
      const { data: priorSegments } = await db.from("live_recording_segments").select("segment_number").eq("recording_id", recordingId).order("segment_number", { ascending: false }).limit(1);
      const segmentNumber = (priorSegments?.[0]?.segment_number || 0) + 1;
      const segmentId = crypto.randomUUID();
      const upload = await r2RecordingStorage.begin(classId, recordingId, segmentId, contentType);
      const { error: segmentError } = await db.from("live_recording_segments").insert({
        id: segmentId, recording_id: recordingId, session_id: classId, owner_id: auth.user.id, segment_number: segmentNumber,
        object_key: upload.objectKey, upload_id: upload.uploadId, mime_type: contentType, part_size: upload.partSize,
      });
      if (segmentError) {
        await r2RecordingStorage.abort(upload).catch(() => undefined);
        await db.from("class_recordings").update({ status: "failed", error_message: "Segment state could not be persisted" }).eq("id", recordingId);
        throw segmentError;
      }
      await db.from("class_recordings").update({ status: "recording", error_message: null }).eq("id", recordingId);
      return NextResponse.json({ recordingId, segmentId, segmentNumber, partSize: upload.partSize, contentType });
    }

    if (body.action === "review") {
      if (authorization.role !== "admin" || !body.recordingId || !uuid.test(body.recordingId)) throw new LiveAuthorizationError("Admin review is required");
      const { data: recording } = await db.from("class_recordings")
        .select("id,status,client_validated_at").eq("id", body.recordingId).eq("session_id", classId).maybeSingle();
      if (!recording || recording.status !== "validating" || !recording.client_validated_at) return failure("Teacher validation evidence is incomplete", 409);
      const { data: segments, error: segmentError } = await db.from("live_recording_segments")
        .select("id,status,object_key,total_bytes,object_sha256,client_validated_at,client_reported_duration_seconds")
        .eq("recording_id", recording.id).order("segment_number");
      if (segmentError || !segments?.length || segments.some(segment => segment.status !== "validating" || !segment.client_validated_at || !segment.client_reported_duration_seconds)) {
        return failure("Every uploaded segment needs Teacher playback evidence before Admin review", 409);
      }
      const verified = await Promise.all(segments.map(async segment => ({ segment, object: await r2RecordingStorage.digest(segment.object_key) })));
      if (verified.some(value => value.object.byteLength !== value.segment.total_bytes || value.object.sha256 !== value.segment.object_sha256)) return failure("Remote object bytes changed after upload validation", 409);
      const at = new Date().toISOString();
      await Promise.all(verified.map(value => db.from("live_recording_segments").update({
        status: "ready",
        verified_at: at,
        duration_seconds: value.segment.client_reported_duration_seconds,
        error_message: null,
      }).eq("id", value.segment.id).eq("status", "validating")));
      const { error: recordingError } = await db.from("class_recordings").update({
        status: "ready",
        verified_at: at,
        duration_seconds: verified.reduce((sum, value) => sum + Number(value.segment.client_reported_duration_seconds || 0), 0),
        total_bytes: verified.reduce((sum, value) => sum + value.object.byteLength, 0),
        error_message: null,
      }).eq("id", recording.id).eq("status", "validating");
      if (recordingError) throw recordingError;
      return NextResponse.json({ status: "ready", verifiedAt: at });
    }

    if ((body.action === "publish" || body.action === "unpublish")) {
      if (authorization.role !== "admin" || !body.recordingId || !uuid.test(body.recordingId)) throw new LiveAuthorizationError("Admin review is required to change publication");
      if (body.action === "unpublish") {
        const { error } = await db.from("class_recordings").update({ status: "ready", published_at: null, published_by: null }).eq("id", body.recordingId).eq("session_id", classId).eq("status", "published");
        if (error) throw error;
        return NextResponse.json({ status: "ready" });
      }
      const { data: recording } = await db.from("class_recordings").select("id,verified_at,status").eq("id", body.recordingId).eq("session_id", classId).maybeSingle();
      if (!recording?.verified_at || recording.status !== "ready") return failure("Only a validated recording can be published", 409);
      const at = new Date().toISOString();
      const { error } = await db.from("class_recordings").update({ status: "published", published_at: at, published_by: auth.user.id }).eq("id", recording.id);
      if (error) throw error;
      return NextResponse.json({ status: "published", publishedAt: at });
    }

    if (!body.segmentId) return failure("Recording segment is required", 400);
    const segment = await ownedSegment(db, classId, auth.user.id, body.segmentId);
    const upload = { objectKey: segment.object_key, uploadId: segment.upload_id };

    if (body.action === "stop") {
      const at = new Date().toISOString();
      await Promise.all([
        db.from("live_recording_segments").update({ status: "uploading", stopped_at: at }).eq("id", segment.id).eq("status", "recording"),
        db.from("class_recordings").update({ status: "uploading" }).eq("id", segment.recording_id),
      ]);
      return NextResponse.json({ status: "uploading" });
    }

    if (body.action === "sign") {
      if (!Number.isInteger(body.partNumber) || body.partNumber! < 1 || body.partNumber! > 10_000 || !Number.isSafeInteger(body.byteLength) || body.byteLength! <= 0 || body.byteLength! > segment.part_size || !body.sha256 || !sha256.test(body.sha256)) return failure("Invalid recording part", 400);
      if (!["recording", "uploading", "interrupted"].includes(segment.status)) return failure("Recording segment no longer accepts parts", 409);
      const { error } = await db.from("live_recording_parts").upsert({
        segment_id: segment.id, part_number: body.partNumber, byte_length: body.byteLength, sha256: body.sha256,
      }, { onConflict: "segment_id,part_number" });
      if (error) throw error;
      return NextResponse.json(await r2RecordingStorage.signPart(upload, body.partNumber!));
    }

    if (body.action === "acknowledge") {
      if (!Number.isInteger(body.partNumber) || !body.etag || body.etag.length > 200) return failure("Invalid part acknowledgement", 400);
      const { data: expected } = await db.from("live_recording_parts").select("byte_length,sha256").eq("segment_id", segment.id).eq("part_number", body.partNumber!).maybeSingle();
      if (!expected || expected.byte_length !== body.byteLength || expected.sha256 !== body.sha256) throw new LiveAuthorizationError("Part acknowledgement does not match the signed part", 409);
      const { error } = await db.from("live_recording_parts").update({ etag: body.etag, acknowledged_at: new Date().toISOString() }).eq("segment_id", segment.id).eq("part_number", body.partNumber!);
      if (error) throw error;
      return NextResponse.json({ acknowledged: true });
    }

    if (body.action === "reconcile") {
      const known = await db.from("live_recording_parts").select("part_number,byte_length,sha256,etag,acknowledged_at")
        .eq("segment_id", segment.id).order("part_number");
      let providerParts;
      try {
        providerParts = await r2RecordingStorage.listParts(upload);
      } catch (listError) {
        // CompleteMultipartUpload invalidates the upload ID. If the final object
        // already exists, every acknowledged part is durably represented by
        // that immutable server-generated object key.
        try {
          const object = await r2RecordingStorage.verify(segment.object_key);
          const acknowledgedBytes = (known.data || []).filter(part => part.etag)
            .reduce((sum, part) => sum + Number(part.byte_length || 0), 0);
          if (!acknowledgedBytes || acknowledgedBytes !== object.byteLength) throw listError;
          return NextResponse.json({
            recoveredCompletion: true,
            parts: (known.data || []).map(part => ({
              partNumber: part.part_number, byteLength: part.byte_length, sha256: part.sha256,
              acknowledgedEtag: part.etag, providerEtag: part.etag, present: Boolean(part.etag),
            })),
          });
        } catch { throw listError; }
      }
      const reconciled = reconcileMultipartState((known.data || []).map(part => ({
        partNumber: part.part_number, byteLength: part.byte_length, sha256: part.sha256, etag: part.etag,
      })), providerParts);
      const acknowledgedAt = new Date().toISOString();
      await Promise.all(reconciled.recovered.map(part => db.from("live_recording_parts").update({
        etag: part.etag, acknowledged_at: acknowledgedAt,
      }).eq("segment_id", segment.id).eq("part_number", part.partNumber).is("etag", null)));
      return NextResponse.json({
        recoveredAcknowledgements: reconciled.recovered.length,
        parts: reconciled.parts.map(part => ({ ...part, acknowledgedEtag: part.etag })),
      });
    }

    if (body.action === "complete") {
      if (["validating", "ready"].includes(segment.status)) {
        const verified = await r2RecordingStorage.verify(segment.object_key);
        return NextResponse.json({ status: segment.status, byteLength: verified.byteLength, etag: verified.etag });
      }
      let providerParts;
      try { providerParts = await r2RecordingStorage.listParts(upload); }
      catch (listError) {
        // A successful CompleteMultipartUpload invalidates its upload ID. If the
        // database write was interrupted afterward, the unique object itself is
        // the idempotency witness for this server-generated segment key.
        try {
          const object = await r2RecordingStorage.verify(segment.object_key);
          const at = new Date().toISOString();
          await Promise.all([
            db.from("live_recording_segments").update({ status: "validating", total_bytes: object.byteLength, object_etag: object.etag, stopped_at: at, error_message: null }).eq("id", segment.id),
            db.from("class_recordings").update({ status: "validating", total_bytes: object.byteLength, error_message: null }).eq("id", segment.recording_id),
          ]);
          return NextResponse.json({ status: "validating", byteLength: object.byteLength, etag: object.etag, recoveredCompletion: true });
        } catch { throw listError; }
      }
      const partResult = await db.from("live_recording_parts").select("part_number,byte_length,sha256,etag").eq("segment_id", segment.id).not("etag", "is", null);
      if (partResult.error) throw partResult.error;
      const acknowledgements = (partResult.data || []).map(part => ({ partNumber: part.part_number, byteLength: part.byte_length, sha256: part.sha256, etag: part.etag! })) as AcknowledgedPart[];
      const plan = validateMultipartCompletion(acknowledgements, providerParts, segment.part_size);
      const completed = await r2RecordingStorage.complete(upload, plan.ordered);
      const at = new Date().toISOString();
      await Promise.all([
        db.from("live_recording_segments").update({ status: "validating", total_bytes: completed.byteLength, object_etag: completed.etag, stopped_at: at, error_message: null }).eq("id", segment.id),
        db.from("class_recordings").update({ status: "validating", total_bytes: completed.byteLength, error_message: null }).eq("id", segment.recording_id),
      ]);
      return NextResponse.json({ status: "validating", byteLength: completed.byteLength, etag: completed.etag });
    }

    if (body.action === "validate") {
      if (!Number.isFinite(body.durationSeconds) || body.durationSeconds! <= 0 || body.durationSeconds! > 24 * 60 * 60 || body.seekable !== true || body.hasAudio !== true || body.hasVideo !== true || !body.fullSha256 || !sha256.test(body.fullSha256)) return failure("Playback validation did not pass", 400);
      const object = await r2RecordingStorage.digest(segment.object_key);
      if (object.sha256 !== body.fullSha256) return failure("Remote recording bytes do not match the locally recovered capture", 409);
      const at = new Date().toISOString();
      await db.from("live_recording_segments").update({
        client_validated_at: at,
        client_reported_duration_seconds: body.durationSeconds,
        client_reported_seekable: true,
        client_reported_has_audio: true,
        client_reported_has_video: true,
        total_bytes: object.byteLength,
        object_sha256: object.sha256,
        error_message: null,
      }).eq("id", segment.id).eq("status", "validating");
      const { data: segments } = await db.from("live_recording_segments").select("status,client_validated_at,total_bytes").eq("recording_id", segment.recording_id);
      const allClientValidated = Boolean(segments?.length) && segments!.every(value => value.status === "validating" && value.client_validated_at);
      if (allClientValidated) await db.from("class_recordings").update({
        status: "validating",
        client_validated_at: at,
        client_reported_duration_seconds: body.durationSeconds,
        client_reported_seekable: true,
        client_reported_has_audio: true,
        client_reported_has_video: true,
        total_bytes: segments!.reduce((sum, value) => sum + Number(value.total_bytes || 0), 0),
        error_message: null,
      }).eq("id", segment.recording_id);
      return NextResponse.json({ status: "validating", clientValidated: allClientValidated, adminReviewRequired: true });
    }

    if (body.action === "interrupt") {
      const at = new Date().toISOString();
      await Promise.all([
        db.from("live_recording_segments").update({ status: "interrupted", stopped_at: at, error_message: "Capture stopped before upload validation" }).eq("id", segment.id),
        db.from("class_recordings").update({ status: "interrupted", interrupted_at: at, error_message: "One or more recording segments were interrupted" }).eq("id", segment.recording_id),
      ]);
      return NextResponse.json({ status: "interrupted" });
    }

    if (body.action === "abort") {
      await r2RecordingStorage.abort(upload).catch(error => {
        if (!(error instanceof Error) || !error.name.includes("NoSuchUpload")) throw error;
      });
      await Promise.all([
        db.from("live_recording_segments").update({ status: "aborted", stopped_at: new Date().toISOString() }).eq("id", segment.id),
        db.from("class_recordings").update({ status: "aborted" }).eq("id", segment.recording_id),
      ]);
      return NextResponse.json({ status: "aborted" });
    }
    return failure("Unsupported recording operation", 400);
  } catch (error) {
    if (error instanceof LiveAuthorizationError) return failure(error.message, error.status);
    return failure(error instanceof Error && error.message.includes("disabled") ? error.message : "Recording operation failed", 502);
  }
}

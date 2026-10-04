import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { consumeLiveRateLimit } from "@/lib/live-class/rate-limit";

type Body = {
  title?: string; programId?: string; subjectId?: string; batchId?: string; teacherId?: string;
  startsAt?: string; endsAt?: string; recordingEnabled?: boolean; maxReceivers?: number | null;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return error("Invalid origin", 403);
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return error("Unauthorized", 401);
  const rate = consumeLiveRateLimit(`schedule:${auth.user.id}`, 20, 60_000);
  if (!rate.allowed) return error("Too many scheduling requests", 429);
  const { data: profile } = await db.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
  if (!profile?.is_active || !["admin", "teacher"].includes(profile.role)) return error("Active Teacher or Admin access is required", 403);
  let body: Body;
  try { body = await request.json() as Body; } catch { return error("Invalid JSON request", 400); }
  if (profile.role === "teacher") {
    if (body.teacherId && body.teacherId !== auth.user.id) return error("Teachers may only schedule their own classes", 403);
    body.teacherId = auth.user.id;
    const permission = await db.rpc("teacher_has_assignment", { target_exam: null, target_program: body.programId, target_subject: body.subjectId, permission: null });
    if (permission.error || permission.data !== true) return error("Assigned academic scope is required", 403);
  }
  if (!body.title?.trim() || body.title.trim().length > 180 || !body.programId || !body.subjectId || !body.batchId || !body.teacherId ||
    ![body.programId, body.subjectId, body.batchId, body.teacherId].every(value => uuid.test(value!))) return error("Complete academic scope and Teacher are required", 400);
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (!startsAt || !endsAt || !Number.isFinite(startsAt.valueOf()) || !Number.isFinite(endsAt.valueOf()) || endsAt <= startsAt) return error("A valid UTC class window is required", 400);
  if (body.maxReceivers !== null && body.maxReceivers !== undefined && (!Number.isSafeInteger(body.maxReceivers) || body.maxReceivers < 1 || body.maxReceivers > 500)) return error("Invalid receiver limit", 400);
  const [program, subject, batch, teacher, assignment] = await Promise.all([
    db.from("programs").select("id").eq("id", body.programId).eq("status", "active").maybeSingle(),
    db.from("program_subjects").select("program_id").eq("program_id", body.programId).eq("subject_id", body.subjectId).maybeSingle(),
    db.from("batches").select("id").eq("id", body.batchId).eq("program_id", body.programId).maybeSingle(),
    db.from("profiles").select("id").eq("id", body.teacherId).eq("role", "teacher").eq("is_active", true).maybeSingle(),
    db.from("faculty_assignments").select("id,program_id,subject_id").eq("faculty_id", body.teacherId),
  ]);
  const assigned = (assignment.data || []).some(value =>
    (!value.program_id || value.program_id === body.programId) && (!value.subject_id || value.subject_id === body.subjectId));
  if (!program.data || !subject.data || !batch.data || !teacher.data || !assigned) return error("Academic scope or authenticated Teacher assignment is invalid", 400);
  const { data, error: insertError } = await db.from("live_sessions").insert({
    title: body.title.trim(), program_id: body.programId, subject_id: body.subjectId, batch_id: body.batchId,
    faculty_id: body.teacherId, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
    join_opens_at: new Date(startsAt.valueOf() - 15 * 60_000).toISOString(), join_closes_at: endsAt.toISOString(),
    status: "scheduled", provider: "cloudflare", recording_enabled: Boolean(body.recordingEnabled),
    max_receivers: body.maxReceivers ?? null, student_audio_enabled: false, student_video_enabled: false,
  }).select("id").single();
  if (insertError || !data) return error("Class could not be scheduled", 400);
  return NextResponse.json({ id: data.id }, { status: 201 });
}

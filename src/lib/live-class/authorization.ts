import "server-only";
import type { AppRole } from "@/lib/auth";

export type LiveClassSession = {
  id: string;
  faculty_id: string;
  program_id: string | null;
  batch_id: string | null;
  subject_id: string | null;
  status: "draft" | "scheduled" | "live" | "completed" | "cancelled";
  ended_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  join_opens_at: string | null;
  join_closes_at: string | null;
  recording_enabled: boolean;
  provider: string;
  max_receivers: number | null;
};

export type LiveAuthorization = {
  userId: string;
  role: AppRole;
  session: LiveClassSession;
  isClassManager: boolean;
};

type QueryResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type Filter = {
  eq(column: string, value: unknown): Filter;
  single(): QueryResult<unknown>;
  maybeSingle(): QueryResult<unknown>;
};
type DbClient = {
  from(table: string): { select(columns: string): Filter };
  rpc(name: string, args: Record<string, unknown>): QueryResult<unknown>;
};

export class LiveAuthorizationError extends Error {
  constructor(message: string, readonly status = 403) {
    super(message);
    this.name = "LiveAuthorizationError";
  }
}

export async function authorizeLiveClass(
  database: unknown,
  userId: string,
  classId: string,
  purpose: "view" | "connect" | "manage" | "record" | "playback",
): Promise<LiveAuthorization> {
  const db = database as DbClient;
  const [profileResult, sessionResult] = await Promise.all([
    db.from("profiles").select("id,role,is_active").eq("id", userId).single(),
    db.from("live_sessions").select("id,faculty_id,program_id,batch_id,subject_id,status,ended_at,starts_at,ends_at,join_opens_at,join_closes_at,recording_enabled,provider,max_receivers").eq("id", classId).single(),
  ]);
  const profile = profileResult.data as { id: string; role: AppRole; is_active: boolean } | null;
  const session = sessionResult.data as LiveClassSession | null;
  if (!profile?.is_active) throw new LiveAuthorizationError("An active ALS profile is required", 401);
  if (!session) throw new LiveAuthorizationError("Classroom is unavailable", 404);

  const isAdmin = profile.role === "admin";
  let isAssignedTeacher = profile.role === "teacher" && session.faculty_id === userId;
  if (isAssignedTeacher) {
    const assignment = await db.rpc("teacher_has_assignment", {
      target_exam: null,
      target_program: session.program_id,
      target_subject: session.subject_id,
      permission: null,
    });
    isAssignedTeacher = assignment.data === true;
  }
  const isClassManager = isAdmin || isAssignedTeacher;
  if (purpose === "manage" || purpose === "record") {
    if (!isClassManager) throw new LiveAuthorizationError("Assigned Teacher or Admin access is required");
    if (purpose === "record" && !session.recording_enabled) throw new LiveAuthorizationError("Recording is not enabled for this class");
  } else if (!isClassManager && profile.role !== "student") {
    throw new LiveAuthorizationError("Classroom access is unavailable");
  }

  if (profile.role === "student") {
    let scoped = db.from("enrollments").select("id,status,access_starts_at,access_expires_at,program_id,batch_id")
      .eq("student_id", userId);
    if (session.program_id) scoped = scoped.eq("program_id", session.program_id);
    if (session.batch_id) scoped = scoped.eq("batch_id", session.batch_id);
    const enrollmentResult = await scoped.maybeSingle();
    const enrollment = enrollmentResult.data as { status: string; access_starts_at: string | null; access_expires_at: string | null } | null;
    const now = Date.now();
    if (!enrollment || enrollment.status !== "active" ||
      (enrollment.access_starts_at && Date.parse(enrollment.access_starts_at) > now) ||
      (enrollment.access_expires_at && Date.parse(enrollment.access_expires_at) <= now)) {
      throw new LiveAuthorizationError("Current enrollment does not permit this classroom");
    }
    if (purpose === "connect") {
      const participantResult = await db.from("live_participants").select("removed_at").eq("session_id", classId).eq("user_id", userId).maybeSingle();
      const participant = participantResult.data as { removed_at: string | null } | null;
      if (participant?.removed_at) throw new LiveAuthorizationError("You were removed from this live class");
    }
  }

  if (purpose === "connect") {
    const now = Date.now();
    if (session.status !== "live") throw new LiveAuthorizationError("The class is not live", 409);
    if (session.join_opens_at && Date.parse(session.join_opens_at) > now) throw new LiveAuthorizationError("The class join window has not opened", 409);
    if (session.join_closes_at && Date.parse(session.join_closes_at) <= now) throw new LiveAuthorizationError("The class join window has closed", 409);
  }
  if (purpose === "playback" && session.status === "cancelled") throw new LiveAuthorizationError("Cancelled classes do not have student playback");
  return { userId, role: profile.role, session, isClassManager };
}

export function assertClassroomMode(session: Pick<LiveClassSession, "provider">, mode: "poc" | "classroom") {
  const expected = mode === "poc" ? "cloudflare-poc" : "cloudflare";
  if (session.provider !== expected) {
    throw new LiveAuthorizationError(mode === "poc" ? "This class is not an isolated POC session" : "This class is not configured for native classroom entry", 409);
  }
}

export function mayPublish(
  authorization: Pick<LiveAuthorization, "role" | "isClassManager">,
  participant: { audio_publish_allowed?: boolean; presenter?: boolean; screen_publish_allowed?: boolean } | null,
  kind: "microphone" | "camera" | "screen",
) {
  if (authorization.isClassManager) return true;
  if (authorization.role !== "student") return false;
  if (kind === "microphone") return Boolean(participant?.audio_publish_allowed);
  if (kind === "screen") return Boolean(participant?.presenter && participant.screen_publish_allowed);
  return false;
}

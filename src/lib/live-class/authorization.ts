import "server-only";
import { resolveLiveClassState } from "./state";
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
    const assignment = await db.rpc("teacher_has_live_assignment", {
      target_program: session.program_id,
      target_subject: session.subject_id,
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
    // The database owns access dates, effective membership, removals and state.
    // The same predicate is used by the list RLS and attendance/transport writes.
    const eligibility = await db.rpc("live_class_eligibility", { target_session: classId, operation: purpose === "connect" ? "connect" : purpose === "playback" ? "playback" : "view" });
    if (eligibility.error) throw new LiveAuthorizationError("Classroom access could not be verified. Please retry.", 503);
    if (eligibility.data !== true) throw new LiveAuthorizationError("Current enrollment does not permit this classroom");
  }
  if (purpose === "connect" && resolveLiveClassState(session) !== "live") {
    throw new LiveAuthorizationError("The class is not live", 409);
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

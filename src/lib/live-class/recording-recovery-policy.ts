import { LiveAuthorizationError, type LiveAuthorization } from "./authorization";

export const POST_CLASS_RECOVERY_MS = 24 * 60 * 60 * 1_000;

export function assertRecordingOwnerWindow(
  authorization: LiveAuthorization,
  action: string,
  now = Date.now(),
) {
  if (authorization.role !== "teacher" || authorization.session.faculty_id !== authorization.userId || !authorization.isClassManager) {
    throw new LiveAuthorizationError("Only the assigned Teacher may record or recover this class");
  }
  if (authorization.session.status === "live") return;
  if (action === "begin") throw new LiveAuthorizationError("New recording segments require a live class", 409);
  const endedAt = authorization.session.ended_at ? Date.parse(authorization.session.ended_at) : NaN;
  if (authorization.session.status !== "completed" || !Number.isFinite(endedAt) || now < endedAt || now > endedAt + POST_CLASS_RECOVERY_MS) {
    throw new LiveAuthorizationError("The post-class recording recovery window has closed", 409);
  }
}

export function assertRecordingSegmentMutation(
  action: "acknowledge" | "interrupt" | "abort",
  status: string,
  completedAt: string | null,
) {
  const unfinished = ["recording", "uploading", "interrupted"].includes(status);
  if (action === "acknowledge" && !unfinished) {
    throw new LiveAuthorizationError("Recording parts cannot change after upload completion", 409);
  }
  if (action === "interrupt" && !unfinished && status !== "validating") {
    throw new LiveAuthorizationError("Reviewed recording state cannot be interrupted", 409);
  }
  if (action === "abort" && (completedAt || (!unfinished && status !== "failed"))) {
    throw new LiveAuthorizationError("Completed recording uploads cannot be aborted", 409);
  }
}

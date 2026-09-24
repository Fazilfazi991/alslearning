import { describe, expect, it } from "vitest";
import { assertRecordingOwnerWindow, assertRecordingSegmentMutation, POST_CLASS_RECOVERY_MS } from "./recording-recovery-policy";
import type { LiveAuthorization } from "./authorization";

const endedAt = Date.parse("2026-09-24T17:00:00Z");
const assigned = (status: LiveAuthorization["session"]["status"], role: LiveAuthorization["role"] = "teacher"): LiveAuthorization => ({
  userId: "teacher-a",
  role,
  isClassManager: role !== "student",
  session: {
    id: "class-a", faculty_id: "teacher-a", program_id: null, batch_id: null, subject_id: null,
    status, ended_at: status === "completed" ? new Date(endedAt).toISOString() : null,
    starts_at: null, ends_at: null, join_opens_at: null, join_closes_at: null,
    recording_enabled: true, provider: "cloudflare-poc", max_receivers: 2,
  },
});

describe("recording owner window", () => {
  it("permits a new segment only during a live class", () => {
    expect(() => assertRecordingOwnerWindow(assigned("live"), "begin", endedAt)).not.toThrow();
    expect(() => assertRecordingOwnerWindow(assigned("completed"), "begin", endedAt + 1)).toThrow(/New recording/);
  });

  it("permits existing upload recovery for 24 hours after class end", () => {
    for (const action of ["sign", "acknowledge", "reconcile", "complete", "validate", "abort"]) {
      expect(() => assertRecordingOwnerWindow(assigned("completed"), action, endedAt + POST_CLASS_RECOVERY_MS)).not.toThrow();
      expect(() => assertRecordingOwnerWindow(assigned("completed"), action, endedAt + POST_CLASS_RECOVERY_MS + 1)).toThrow(/window has closed/);
    }
  });

  it("denies Admin, Student, and another Teacher regardless of segment knowledge", () => {
    expect(() => assertRecordingOwnerWindow(assigned("completed", "admin"), "sign", endedAt + 1)).toThrow(/assigned Teacher/);
    expect(() => assertRecordingOwnerWindow(assigned("completed", "student"), "sign", endedAt + 1)).toThrow(/assigned Teacher/);
    const other = assigned("completed"); other.userId = "teacher-b";
    expect(() => assertRecordingOwnerWindow(other, "sign", endedAt + 1)).toThrow(/assigned Teacher/);
  });

  it("keeps completed and reviewed segment state immutable to capture operations", () => {
    expect(() => assertRecordingSegmentMutation("acknowledge", "ready", "2026-09-24T20:08:20Z")).toThrow(/cannot change/);
    expect(() => assertRecordingSegmentMutation("interrupt", "ready", "2026-09-24T20:08:20Z")).toThrow(/cannot be interrupted/);
    expect(() => assertRecordingSegmentMutation("abort", "validating", "2026-09-24T20:08:20Z")).toThrow(/cannot be aborted/);
    expect(() => assertRecordingSegmentMutation("abort", "uploading", null)).not.toThrow();
    expect(() => assertRecordingSegmentMutation("interrupt", "validating", "2026-09-24T20:08:20Z")).not.toThrow();
  });
});

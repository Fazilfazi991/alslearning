import { describe, expect, it } from "vitest";
import { eligibleStudentEnrollment, formatWatchTime, summarizeStudentTests, summarizeWatchEvents } from "./student-dashboard";

describe("student dashboard data", () => {
  it("keeps only active, currently accessible enrollments", () => {
    const now = Date.parse("2026-10-01T08:00:00Z");
    const base = {
      program_id: "program", status: "active", batch_id: null, access_starts_at: null, access_expires_at: null,
      programs: { id: "program", status: "active" }, batches: null,
    };
    expect(eligibleStudentEnrollment(base, now)).toBe(true);
    expect(eligibleStudentEnrollment({ ...base, access_expires_at: "2026-10-01T07:00:00Z" }, now)).toBe(false);
    expect(eligibleStudentEnrollment({ ...base, programs: { id: "program", status: "inactive" } }, now)).toBe(false);
    expect(eligibleStudentEnrollment({ ...base, batch_id: "batch", batches: { id: "batch", program_id: "program", status: "active", access_starts_at: null, access_expires_at: null, access_valid_until: "2026-09-30" } }, now)).toBe(false);
  });

  it("separates available and resume tests, counts distinct submissions, and uses latest visible marks per test", () => {
    const tests = [
      { id: "one", slug: "one", title: "One", state: "completed" as const },
      { id: "two", slug: "two", title: "Two", state: "available" as const },
      { id: "three", slug: "three", title: "Three", state: "in_progress" as const },
      { id: "four", slug: "four", title: "Four", state: "closed" as const },
      { id: "five", slug: "five", title: "Five", state: "available" as const },
    ];
    const attempts = [
      { id: "older", test_id: "one", status: "submitted", submitted_at: "2026-09-01T00:00:00Z", started_at: "2026-09-01T00:00:00Z", score: 7, total_marks: 10 },
      { id: "visible", test_id: "one", status: "graded", submitted_at: "2026-09-02T00:00:00Z", started_at: "2026-09-02T00:00:00Z", score: 8, total_marks: 10 },
      { id: "hidden", test_id: "one", status: "graded", submitted_at: "2026-09-03T00:00:00Z", started_at: "2026-09-03T00:00:00Z", score: null, total_marks: 10 },
      { id: "second", test_id: "two", status: "submitted", submitted_at: "2026-09-04T00:00:00Z", started_at: "2026-09-04T00:00:00Z", score: 2, total_marks: 5 },
      { id: "unrelated", test_id: "outside", status: "submitted", submitted_at: "2026-09-04T00:00:00Z", started_at: "2026-09-04T00:00:00Z", score: 100, total_marks: 100 },
    ];
    const result = summarizeStudentTests(tests, attempts);
    expect(result.completed).toBe(2);
    expect(result.total).toBe(5);
    expect(result.pending.map(test => test.id)).toEqual(["five"]);
    expect(result.resume.map(test => test.id)).toEqual(["three"]);
    expect(result.earned).toBe(10);
    expect(result.possible).toBe(15);
    expect(result.recent.map(attempt => attempt.id)).toEqual(["second", "visible"]);
  });

  it("sums persisted intervals rather than resume positions and only shows actual weekly activity", () => {
    const now = Date.parse("2026-10-01T08:00:00Z");
    const events = [
      { elapsed_seconds: 90, ended_at: "2026-10-01T07:00:00Z", content_kind: "lesson" as const },
      { elapsed_seconds: 30, ended_at: "2026-09-20T07:00:00Z", content_kind: "recorded_class" as const },
    ];
    expect(summarizeWatchEvents(events, now)).toMatchObject({ seconds: 120, weeklySeconds: 90, weeklyIntervals: 1, activeDays: 1 });
    expect(summarizeWatchEvents(null, now)).toBeNull();
    expect(formatWatchTime(120)).toBe("2 min");
  });
});

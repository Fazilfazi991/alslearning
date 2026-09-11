import { describe, expect, it } from "vitest";
import { activeCourseEnrollment, selectedCourseSubject, courseHasContent, recordingHref, type CourseEnrollment } from "./student-courses";
const enrollment: CourseEnrollment = { id: "e", status: "active", batch_id: null, batches: null, access_starts_at: null, access_expires_at: null, programs: { id: "p", name: "Program", slug: "program" } };
describe("Student course eligibility", () => {
  it("accepts an active enrollment", () => expect(activeCourseEnrollment(enrollment)).toBe(true));
  it.each([
    { status: "cancelled" }, { programs: null }, { batch_id: "hidden" },
    { access_expires_at: "2020-01-01" }, { access_starts_at: "2099-01-01" },
  ])("rejects unavailable enrollment %j", change => expect(activeCourseEnrollment({ ...enrollment, ...change })).toBe(false));
  it("only selects mapped subjects", () => {
    const subjects = [{ id: "a", name: "Subject A" }, { id: "b", name: "Subject B" }];
    expect(selectedCourseSubject(subjects, "b")?.id).toBe("b");
    expect(selectedCourseSubject(subjects, "unauthorized")?.id).toBe("a");
    expect(selectedCourseSubject([])).toBeNull();
  });
  it.each([[[], [], false], [[{}], [], true], [[], [{}], true], [[{}], [{}], true]])("recognizes all actual content kinds", (recordings, resources, expected) => expect(courseHasContent(recordings as unknown[], resources as unknown[])).toBe(expected));
  it("links to the canonical player", () => expect(recordingHref("record-id")).toBe("/student/recorded-classes/record-id"));
});

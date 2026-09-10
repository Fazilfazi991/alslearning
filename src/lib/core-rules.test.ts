import { describe, it, expect, vi, afterEach } from "vitest";
import { canManage, type CoreData, type Taxonomy } from "./core-repository";
import { localDateTime } from "./core-time";
const assignment = {
  exam_id: "exam",
  program_id: "program",
  subject_id: "subject",
  can_manage_content: false,
  can_manage_questions: false,
  can_manage_tests: true,
};
const teacher = { role: "teacher", assignments: [assignment] } as CoreData;
const scope = {
  exam_id: "exam",
  program_id: "program",
  subject_id: "subject",
  chapter_id: "",
  topic_id: "",
} as Taxonomy;
afterEach(() => vi.restoreAllMocks());
describe("Assignment action visibility", () => {
  it("allows only the explicitly granted action", () => {
    expect(canManage(teacher, "tests", scope)).toBe(true);
    expect(canManage(teacher, "questions", scope)).toBe(false);
    expect(canManage(teacher, "content", scope)).toBe(false);
  });
  it("requires every assigned dimension to match", () => {
    for (const key of ["exam_id", "program_id", "subject_id"])
      expect(canManage(teacher, "tests", { ...scope, [key]: "other" })).toBe(
        false,
      );
  });
  it("does not let a scoped teacher choose an unscoped resource", () =>
    expect(canManage(teacher, "tests", { ...scope, program_id: "" })).toBe(
      false,
    ));
  it("does not expose actions to students even with stray assignment data", () =>
    expect(canManage({ ...teacher, role: "student" }, "tests", scope)).toBe(
      false,
    ));
  it("allows an administrator without faculty assignments", () =>
    expect(
      canManage(
        { ...teacher, role: "admin", assignments: [] },
        "content",
        scope,
      ),
    ).toBe(true));
});
describe("Access date editor", () => {
  it("keeps an existing instant when displayed in Dubai local time", () => {
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-240);
    expect(localDateTime("2026-09-10T10:30:00Z")).toBe("2026-09-10T14:30");
  });
  it("handles offsets crossing a calendar day", () => {
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(300);
    expect(localDateTime("2026-09-10T01:30:00Z")).toBe("2026-09-09T20:30");
  });
  it("leaves missing or invalid dates blank", () => {
    expect(localDateTime(null)).toBe("");
    expect(localDateTime("invalid")).toBe("");
  });
});

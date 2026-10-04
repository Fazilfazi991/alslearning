import { describe, expect, it } from "vitest";
import { academicLocalToUtc, formatAcademicDate, utcToAcademicLocalInput } from "./date";

describe("academic class dates", () => {
  it("converts Dubai academic time to UTC independently of browser timezone", () => {
    expect(academicLocalToUtc("2026-09-24T19:30", "Asia/Dubai")).toBe("2026-09-24T15:30:00.000Z");
    expect(utcToAcademicLocalInput("2026-09-24T15:30:00.000Z", "Asia/Dubai")).toBe("2026-09-24T19:30");
  });
  it("formats the stored instant in the academic timezone", () => {
    expect(formatAcademicDate("2026-09-24T15:30:00.000Z", "Asia/Dubai")).toContain("19:30");
  });
});

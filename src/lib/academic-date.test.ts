import { expect, it } from "vitest";
import { academicDate } from "./academic-date";
it("uses the same academic date on both sides of an enrollment midnight boundary", () => {
  expect(academicDate("2027-03-31T23:59:59Z")).toBe("1 Apr 2027");
  expect(academicDate("2027-03-31T18:00:00Z")).toBe("31 Mar 2027");
});

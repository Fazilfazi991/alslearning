import { expect, it } from "vitest";
import { isApprovedStagingProject } from "./staging-project-identity";

it("rejects malformed and unapproved project references", () => {
  for (const value of ["", "a".repeat(19), "a".repeat(21), "A".repeat(20), "a".repeat(20), "https://example.test"]) expect(isApprovedStagingProject(value)).toBe(false);
});

it.skipIf(!process.env.ALS_TEST_APPROVED_STAGING_REF)("accepts the externally supplied approved project reference", () => {
  expect(isApprovedStagingProject(process.env.ALS_TEST_APPROVED_STAGING_REF!)).toBe(true);
});

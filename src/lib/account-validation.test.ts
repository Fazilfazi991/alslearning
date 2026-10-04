import { describe, expect, it } from "vitest";
import { isManagedRole, validAccountEmail, validAccountId, validAccountName, validAccountPassword } from "./account-validation";
describe("account validation", () => {
  it("restricts roles to Student and Teacher", () => { expect(isManagedRole("teacher")).toBe(true); expect(isManagedRole("student")).toBe(true); expect(isManagedRole("admin")).toBe(false); });
  it.each(["", " ", "x".repeat(121), null])("rejects invalid names %j", value => expect(validAccountName(value)).toBe(false));
  it.each(["invalid", "a@b", "a b@test.com", "a@test.com\nother@test.com", null])("rejects invalid emails %j", value => expect(validAccountEmail(value)).toBe(false));
  it("accepts real email addresses and UUIDs", () => { expect(validAccountEmail(" teacher@example.test ")).toBe(true); expect(validAccountId("e9e32ed8-f751-4a5c-86c6-cc3dc5f61f74")).toBe(true); expect(validAccountId("invalid")).toBe(false); });
  it.each(["short", "aaaaaaaaaaaa", "Password12345", "PASSWORD#12345", "Password#" + "x".repeat(130)])("rejects weak or oversized passwords", value => expect(validAccountPassword(value)).toBe(false));
  it("accepts a bounded strong password", () => expect(validAccountPassword("Test-Only#42")).toBe(true));
});

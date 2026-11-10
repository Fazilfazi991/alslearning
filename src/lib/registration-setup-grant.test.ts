import { afterEach, describe, expect, it, vi } from "vitest";
import { makeSetupGrant, validSetupGrant } from "./registration-setup-grant";
describe("registration setup grant", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("binds a short-lived invitation grant to both user and session", () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    const grant=makeSetupGrant("student", "session", 1000);
    expect(validSetupGrant(grant,"student","session",1001)).toBe(true);
    expect(validSetupGrant(grant,"student","other",1001)).toBe(false);
    expect(validSetupGrant(grant,"other","session",1001)).toBe(false);
    expect(validSetupGrant(grant,"student","session",1600)).toBe(false);
    expect(validSetupGrant(`${grant}x`,"student","session",1001)).toBe(false);
  });
  it("fails closed with a missing secret",()=>{vi.stubEnv("REGISTRATION_SETUP_SECRET","");expect(()=>makeSetupGrant("u","s")).toThrow();expect(validSetupGrant("a.b","u","s")).toBe(false);});
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRegistrationRecoveryGrant, makeSetupGrant, validRegistrationRecoveryGrant, validSetupGrant } from "./registration-setup-grant";
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
  it("expires and binds the recovery grant to both registration and student", () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    const grant = makeRegistrationRecoveryGrant("registration", "student", 1000);
    expect(validRegistrationRecoveryGrant(grant, "registration", "student", 1001)).toBe(true);
    expect(validRegistrationRecoveryGrant(grant, "other", "student", 1001)).toBe(false);
    expect(validRegistrationRecoveryGrant(grant, "registration", "other", 1001)).toBe(false);
    expect(validRegistrationRecoveryGrant(grant, "registration", "student", 87400)).toBe(false);
    expect(validRegistrationRecoveryGrant(`${grant}x`, "registration", "student", 1001)).toBe(false);
    expect(validSetupGrant(grant, "student", "session", 1001)).toBe(false);
  });
});

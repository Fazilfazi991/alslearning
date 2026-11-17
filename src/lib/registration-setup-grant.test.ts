import { randomBytes as fixtureRandomBytes } from "node:crypto";
const generatedFixtureCredential1 = "a1-" + Array.from(fixtureRandomBytes(36), byte => "abcdefghijklmnopqrstuvwxyz0123456789-"[byte % 37]).join("");
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertRegistrationSetupConfigured, makeRegistrationRecoveryGrant, newSetupCapability, readRegistrationRecoveryGrant, setupCapabilityDigest, validRegistrationRecoveryGrant } from "./registration-setup-grant";
describe("registration setup credentials", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("generates random capabilities and stable digests without accepting legacy values", () => {
    const first=newSetupCapability(), second=newSetupCapability();
    expect(first).not.toBe(second);
    expect(setupCapabilityDigest(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(setupCapabilityDigest(first)).not.toBe(setupCapabilityDigest(second));
    expect(setupCapabilityDigest("legacy.signed.grant")).toBeNull();
  });
  it("fails closed with a missing secret",()=>{vi.stubEnv("REGISTRATION_SETUP_SECRET","");expect(()=>assertRegistrationSetupConfigured()).toThrow();});
  it("expires and binds the recovery grant to registration and student", () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", generatedFixtureCredential1);
    const grant=makeRegistrationRecoveryGrant("registration","student",1000);
    expect(validRegistrationRecoveryGrant(grant,"registration","student",1001)).toBe(true);
    expect(validRegistrationRecoveryGrant(grant,"registration","other",1001)).toBe(false);
    expect(validRegistrationRecoveryGrant(grant,"other","student",1001)).toBe(false);
    expect(validRegistrationRecoveryGrant(grant,"registration","student",87400)).toBe(false);
    expect(setupCapabilityDigest(grant)).toBeNull();
  });
  it("binds an authorized replacement to the signed recovery proof", () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", generatedFixtureCredential1);
    const recoveryId = "7f7122cb-39e8-470b-bc17-afcaed947233";
    const grant = makeRegistrationRecoveryGrant("registration", "student", 1000, recoveryId);
    expect(readRegistrationRecoveryGrant(grant, 1001)).toEqual({ registrationId: "registration", userId: "student", recoveryId });
    expect(readRegistrationRecoveryGrant(makeRegistrationRecoveryGrant("registration", "student", 1000, "invalid"), 1001)).toBeNull();
  });
});

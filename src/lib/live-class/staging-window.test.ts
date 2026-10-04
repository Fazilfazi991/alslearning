import { afterEach, describe, expect, it, vi } from "vitest";
import { stagingTestWindowOpen } from "./staging-window";

describe("bounded hosted staging window", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("does not impose staging windows on the production classroom", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALS_STAGING_MODE", "false");
    expect(stagingTestWindowOpen()).toBe(true);
  });
  it("fails closed without an explicitly bounded window", () => {
    vi.stubEnv("ALS_STAGING_MODE", "true");
    expect(stagingTestWindowOpen()).toBe(false);
  });
  it("permits only an interval of at most 24 hours before credential expiry", () => {
    vi.stubEnv("ALS_STAGING_MODE", "true");
    vi.stubEnv("ALS_STAGING_TEST_START_UTC", "2026-09-25T08:00:00Z");
    vi.stubEnv("ALS_STAGING_TEST_CUTOFF_UTC", "2026-09-26T07:00:00Z");
    vi.stubEnv("ALS_STAGING_CREDENTIAL_EXPIRES_UTC", "2026-10-01T00:00:00Z");
    expect(stagingTestWindowOpen(Date.parse("2026-09-25T10:00:00Z"))).toBe(true);
    expect(stagingTestWindowOpen(Date.parse("2026-09-26T07:00:00Z"))).toBe(false);
    vi.stubEnv("ALS_STAGING_TEST_CUTOFF_UTC", "2026-09-26T09:00:00Z");
    expect(stagingTestWindowOpen(Date.parse("2026-09-25T10:00:00Z"))).toBe(false);
    vi.stubEnv("ALS_STAGING_TEST_CUTOFF_UTC", "2026-10-01T01:00:00Z");
    expect(stagingTestWindowOpen(Date.parse("2026-09-25T10:00:00Z"))).toBe(false);
  });
});

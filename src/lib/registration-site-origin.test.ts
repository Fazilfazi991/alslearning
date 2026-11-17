import { afterEach, describe, expect, it, vi } from "vitest";
import { registrationSiteOrigin } from "./registration-site-origin";
afterEach(() => vi.unstubAllEnvs());
describe("trusted registration origin", () => {
  it("accepts a configured HTTPS origin", () => {
    vi.stubEnv("REGISTRATION_SITE_URL", "https://als.example");
    expect(registrationSiteOrigin()?.origin).toBe("https://als.example");
  });
  it.each(["", "not a URL", "https://user:pass@als.example", "https://als.example/path", "https://als.example?x=1", "https://als.example#x", "http://als.example"])('rejects invalid configured origin %s', value => {
    vi.stubEnv("REGISTRATION_SITE_URL", value);
    expect(registrationSiteOrigin()).toBeNull();
  });
  it("allows the exact loopback origin only with the complete local gate", () => {
    vi.stubEnv("REGISTRATION_SITE_URL", "http://127.0.0.1:19422");
    expect(registrationSiteOrigin()).toBeNull();
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("ALS_LOCAL_REGISTRATION_QA", "1"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:19424");
    expect(registrationSiteOrigin()?.origin).toBe("http://127.0.0.1:19422");
    vi.stubEnv("VERCEL", "0"); expect(registrationSiteOrigin()).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { enquiryRateIdentity } from "./enquiries-rate-limit";
const secret = "isolated-rate-identity-unit-test";
const now = 1793930400;
function request(cookie?: string, address?: string) { return new Request("https://als.example/api/enquiries", { headers: { ...(cookie ? { cookie } : {}), ...(address ? { "cf-connecting-ip": address } : {}) } }); }
const cookieOf = (cookie: string | null) => cookie!.split(";")[0];
describe("anonymous enquiry rate identities", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("retains a valid signed identity across requests", () => {
    vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", "");
    const first = enquiryRateIdentity(request(), secret, now), next = enquiryRateIdentity(request(cookieOf(first.cookie)), secret, now + 60);
    expect(next.originHash).toBe(first.originHash); expect(next.cookie).toBeNull();
  });
  it("replaces forged, expired and wrong-key tokens", () => {
    vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", "");
    const first = enquiryRateIdentity(request(), secret, now), cookie = cookieOf(first.cookie);
    const forged = cookie.slice(0, -1) + (cookie.endsWith("0") ? "1" : "0");
    for (const next of [enquiryRateIdentity(request(forged), secret, now), enquiryRateIdentity(request(cookie), "wrong-key", now), enquiryRateIdentity(request(cookie), secret, now + 2592001)]) {
      expect(next.originHash).not.toBe(first.originHash); expect(next.cookie).toContain("HttpOnly");
    }
  });
  it("uses only a configured valid canonical address and rejects forwarded chains", () => {
    vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", "cf-connecting-ip");
    const first = enquiryRateIdentity(request(undefined, "192.0.2.1"), secret, now), second = enquiryRateIdentity(request(undefined, "192.0.2.1"), secret, now);
    expect(second.originHash).toBe(first.originHash);
    const cookie = cookieOf(first.cookie);
    const malformed = enquiryRateIdentity(request(cookie, "192.0.2.1, 192.0.2.2"), secret, now);
    vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", "");
    expect(malformed.originHash).toBe(enquiryRateIdentity(request(cookie), secret, now).originHash);
  });
  it("does not treat malformed cookie input as an identity", () => {
    vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", "");
    expect(enquiryRateIdentity(request("als_enquiry_browser=not.a.valid.token"), secret, now).cookie).toContain("als_enquiry_browser=v1.");
  });
});

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stagingAccessResponse } from "./staging-access";

const origin = "https://als-staging.example.test";

describe("staging access gate", () => {
  beforeEach(() => {
    vi.stubEnv("ALS_STAGING_MODE", "true");
    vi.stubEnv("ALS_STAGING_ORIGIN", origin);
    vi.stubEnv("ALS_STAGING_ACCESS_PHRASE", "a-long-test-only-access-phrase");
    vi.stubEnv("ALS_STAGING_COOKIE_SECRET", "a-test-only-cookie-signing-secret-of-sufficient-length");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when any protection secret is missing", async () => {
    vi.stubEnv("ALS_STAGING_COOKIE_SECRET", "");
    const response = await stagingAccessResponse(new NextRequest(`${origin}/student`));
    expect(response?.status).toBe(503);
  });

  it("blocks direct pages and APIs before Supabase authentication", async () => {
    const page = await stagingAccessResponse(new NextRequest(`${origin}/student`));
    const api = await stagingAccessResponse(new NextRequest(`${origin}/api/live-classes`));
    expect(page?.status).toBe(307);
    expect(page?.headers.get("location")).toBe(`${origin}/_staging-access`);
    expect(api?.status).toBe(401);
    expect(api?.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("accepts only same-origin access-phrase submissions and issues a signed HttpOnly cookie", async () => {
    const body = new URLSearchParams({ password: "a-long-test-only-access-phrase" });
    const crossOrigin = await stagingAccessResponse(new NextRequest(`${origin}/_staging-access`, {
      method: "POST", headers: { origin: "https://other.example.test" }, body,
    }));
    expect(crossOrigin?.status).toBe(403);
    const response = await stagingAccessResponse(new NextRequest(`${origin}/_staging-access`, {
      method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body,
    }));
    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe(`${origin}/login`);
    const setCookie = response?.headers.get("set-cookie") || "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=strict");
    const cookie = setCookie.split(";")[0];
    expect(await stagingAccessResponse(new NextRequest(`${origin}/student`, { headers: { cookie } }))).toBeNull();
    expect((await stagingAccessResponse(new NextRequest(`${origin}/student`, { headers: { cookie: `${cookie}x` } })))?.status).toBe(307);
  });

  it("never exposes the QA login or POC routes online", async () => {
    expect((await stagingAccessResponse(new NextRequest(`${origin}/api/auth/qa-password`)))?.status).toBe(404);
    expect((await stagingAccessResponse(new NextRequest(`${origin}/live-poc/test`)))?.status).toBe(404);
  });
});

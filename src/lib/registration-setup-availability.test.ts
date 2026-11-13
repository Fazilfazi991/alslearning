import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GET, POST as callbackPost } from "@/app/auth/callback/route";
import { POST as setupPost } from "@/app/api/auth/setup/route";
import { sendRegistrationInvitation } from "@/lib/registration-invitation";
import { localRegistrationAcceptanceEnabled } from "./registration-setup-availability";

it("keeps invitation and password setup unavailable with the real release guard", async () => {
  vi.stubEnv("REGISTRATION_INVITATION_ENABLED", "true");
  vi.stubEnv("ALS_LOCAL_PROVIDER_REJECTION_QA", "1");
  try {
    expect(await sendRegistrationInvitation("registration", "student", "student@example.test")).toBe("deferred");
    expect((await GET(new Request("https://als.example/auth/callback?token_hash=synthetic&type=invite"))).status).toBe(503);
    expect((await callbackPost(new Request("https://als.example/auth/callback", { method: "POST" }))).status).toBe(503);
    expect((await setupPost(new Request("https://als.example/api/auth/setup", { method: "POST" }))).status).toBe(503);
  } finally { vi.unstubAllEnvs(); }
});

const local = { NODE_ENV: "development", ALS_LOCAL_REGISTRATION_QA: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:19424", REGISTRATION_SITE_URL: "http://127.0.0.1:19422" };

describe("local registration acceptance gate", () => {
  it("requires the exact isolated development configuration", () => {
    expect(localRegistrationAcceptanceEnabled(local)).toBe(true);
  });
  it.each([
    { NODE_ENV: "production" }, { NODE_ENV: "test" },
    { ALS_LOCAL_REGISTRATION_QA: undefined }, { ALS_LOCAL_REGISTRATION_QA: "true" },
    { VERCEL: "0" }, { VERCEL: "1" }, { VERCEL: "" },
    { NEXT_PUBLIC_SUPABASE_URL: undefined }, { NEXT_PUBLIC_SUPABASE_URL: "not a URL" }, { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:19424" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://192.0.2.1:19424" }, { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:19424/" },
    { REGISTRATION_SITE_URL: undefined }, { REGISTRATION_SITE_URL: "not a URL" }, { REGISTRATION_SITE_URL: "http://localhost:19422" },
    { REGISTRATION_SITE_URL: "http://192.0.2.1:19422" }, { REGISTRATION_SITE_URL: "http://127.0.0.1:19422/" },
  ])("fails closed for %o", (change) => {
    expect(localRegistrationAcceptanceEnabled({ ...local, ...change })).toBe(false);
  });
});

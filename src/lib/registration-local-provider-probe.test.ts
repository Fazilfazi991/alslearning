import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ observedFetch: null as null | ((input: string | URL | Request, init?: RequestInit) => Promise<Response>) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { global: { fetch: typeof state.observedFetch } }) => { state.observedFetch = options.global.fetch; return {}; } }));
import { localRegistrationProviderProbe } from "./registration-local-provider-probe";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); state.observedFetch = null; });
describe("local provider rejection probe", () => {
  it.each([
    { NODE_ENV: "production" }, { VERCEL: "0" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://hosted.example" },
    { REGISTRATION_SITE_URL: "https://hosted.example" },
    { ALS_LOCAL_GOTRUE_VERSION: "other" }, { ALS_LOCAL_PROXY_SINGLE_DISPATCH: "0" },
  ])("refuses classification outside the exact local configuration: %o", async override => {
    const env: Record<string, string | undefined> = { NODE_ENV: "development", ALS_LOCAL_REGISTRATION_QA: "1", ALS_LOCAL_PROVIDER_REJECTION_QA: "1", ALS_LOCAL_GOTRUE_VERSION: "2.197.0", ALS_LOCAL_PROXY_SINGLE_DISPATCH: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:19424", REGISTRATION_SITE_URL: "http://127.0.0.1:19422", ...override };
    for (const [name, value] of Object.entries(env)) if (value !== undefined) vi.stubEnv(name, value);
    await expect(localRegistrationProviderProbe()).rejects.toThrow("Local provider probe unavailable");
  });
  it("recognizes only one exact non-redirected provider rejection", async () => {
    const env = { NODE_ENV: "development", ALS_LOCAL_REGISTRATION_QA: "1", ALS_LOCAL_PROVIDER_REJECTION_QA: "1", ALS_LOCAL_GOTRUE_VERSION: "2.197.0", ALS_LOCAL_PROXY_SINGLE_DISPATCH: "1", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:19424", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-key", REGISTRATION_SITE_URL: "http://127.0.0.1:19422" };
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code: "weak_password" }, { status: 422 }));
    vi.stubGlobal("fetch", fetcher);
    const probe = await localRegistrationProviderProbe();
    expect(probe.confirmedWeakRejection()).toBe(false);
    await state.observedFetch!("http://127.0.0.1:19424/auth/v1/user", { method: "PUT" });
    expect(probe.confirmedWeakRejection()).toBe(true);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error" });
    await state.observedFetch!("http://127.0.0.1:19424/auth/v1/user", { method: "PUT" });
    expect(probe.confirmedWeakRejection()).toBe(false);
  });
});

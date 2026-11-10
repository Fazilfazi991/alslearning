import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const state = vi.hoisted(() => ({ approved: true, incoming: [] as {name: string; value: string}[] }));
vi.mock("@/lib/registration-setup-availability", () => ({ registrationPasswordSetupAvailable: true }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => state.incoming }) }));
vi.mock("@/lib/supabase/config", () => ({ supabaseConfig: () => ({ url: "https://auth.example", key: "public-test-key" }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => ({ from: () => { const q = { select: () => q, eq: () => q, limit: () => q, maybeSingle: async () => ({ data: state.approved ? { id: "registration" } : null, error: null }) }; return q; } }) }));
vi.mock("@/lib/supabase/buffered-auth", async importOriginal => {
  const real = await importOriginal<typeof import("@/lib/supabase/buffered-auth")>();
  return { createBufferedAuthClient: async () => {
    const result = await real.createBufferedAuthClient();
    vi.spyOn(result.db.auth, "getClaims").mockResolvedValue({ data: { claims: { session_id: "session" }, header: {}, signature: new Uint8Array() }, error: null } as never);
    vi.spyOn(result.db, "from").mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: "student", is_active: true }, error: null }) }) }) } as never);
    return result;
  } };
});
import { POST } from "./route";
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "student", exp: 4102444800, session_id: "session" })}.signature`;
beforeEach(() => {
  state.approved = true; state.incoming = [];
  vi.stubEnv("REGISTRATION_SETUP_SECRET", "test-secret-at-least-thirty-two-characters-long");
  vi.stubGlobal("fetch", vi.fn(async input => String(input).includes("logout") ? new Response(null, { status: 204 }) : Response.json({ access_token: jwt, token_type: "bearer", expires_in: 3600, refresh_token: "synthetic-refresh", user: { id: "student", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { fixture: "x".repeat(9000) }, created_at: "2026-01-01T00:00:00Z" } })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const submit = () => POST(new Request("https://als.example/auth/callback", { method: "POST", headers: { origin: "https://als.example", "content-type": "application/x-www-form-urlencoded" }, body: "token_hash=synthetic&type=invite" }));
it("publishes real SSR Auth chunks and the setup cookie only after approval", async () => {
  const response = await submit();
  expect(response.status).toBe(303);
  expect(response).toBeInstanceOf(NextResponse);
  const cookies = (response as NextResponse).cookies;
  expect(cookies.getAll().filter(cookie => cookie.name.startsWith("sb-auth-auth-token")).length).toBeGreaterThan(1);
  expect(cookies.get("als_registration_setup")).toBeDefined();
});
it("publishes no Auth or setup cookies when registration is not approved", async () => {
  state.approved = false;
  const response = await submit();
  expect(response.headers.get("location")).toContain("invalid-link");
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("does not overwrite existing chunked browser cookies when approval fails", async () => {
  const first = await submit();
  const issued = (first as NextResponse).cookies.getAll().filter(cookie => cookie.name.startsWith("sb-auth-auth-token"));
  expect(issued.length).toBeGreaterThan(1);
  state.incoming = issued.map(({ name, value }) => ({ name, value }));
  state.approved = false;
  const rejected = await submit();
  expect(rejected.headers.get("set-cookie")).toBeNull();
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const state = vi.hoisted(() => ({ incoming: [] as { name: string; value: string }[] }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => state.incoming }) }));
vi.mock("./config", () => ({ supabaseConfig: () => ({ url: "https://auth.example", key: "public-test-key" }) }));
import { createBufferedAuthClient } from "./buffered-auth";

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "student", exp: 4102444800, session_id: "session" })}.signature`;
beforeEach(() => {
  state.incoming = [];
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access_token: jwt, token_type: "bearer", expires_in: 3600, refresh_token: "synthetic-refresh", user: { id: "student", aud: "authenticated", role: "authenticated", email: "synthetic@example.test", app_metadata: {}, user_metadata: { fixture: "x".repeat(9000) }, created_at: "2026-01-01T00:00:00Z" } })));
});
afterEach(() => vi.unstubAllGlobals());

it("uses the actual SSR adapter to buffer chunked Auth cookies until publication", async () => {
  const client = await createBufferedAuthClient();
  const result = await client.db.auth.verifyOtp({ token_hash: "synthetic", type: "invite" });
  expect(result.error).toBeNull();
  const failure = new NextResponse();
  expect(failure.headers.get("set-cookie")).toBeNull();
  const success = new NextResponse();
  client.publish(success);
  const chunks = success.cookies.getAll().filter(item => item.name.startsWith("sb-auth-auth-token"));
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every(item => item.value.length > 0)).toBe(true);
  state.incoming = chunks.map(({ name, value }) => ({ name, value }));
  const subsequent = await createBufferedAuthClient();
  const before = await subsequent.db.auth.getSession();
  expect(before.data.session?.user.id).toBe("student");
  expect(new NextResponse().headers.get("set-cookie")).toBeNull();
});
it("replaces an existing chunked session and deletes obsolete chunks on publication", async () => {
  const first = await createBufferedAuthClient();
  await first.db.auth.verifyOtp({ token_hash: "synthetic", type: "invite" });
  const firstResponse = new NextResponse(); first.publish(firstResponse);
  const oldChunks = firstResponse.cookies.getAll().filter(item => item.name.startsWith("sb-auth-auth-token"));
  state.incoming = oldChunks.map(({ name, value }) => ({ name, value }));
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ access_token: jwt, token_type: "bearer", expires_in: 3600, refresh_token: "new-synthetic-refresh", user: { id: "student", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } })));
  const second = await createBufferedAuthClient();
  expect((await second.db.auth.verifyOtp({ token_hash: "synthetic", type: "invite" })).error).toBeNull();
  const response = new NextResponse(); second.publish(response);
  const cookies = response.cookies.getAll();
  expect(oldChunks.some(old => cookies.some(cookie => cookie.name === old.name && cookie.value === ""))).toBe(true);
  expect(cookies.some(cookie => cookie.name === "sb-auth-auth-token" && cookie.value.length > 0)).toBe(true);
});

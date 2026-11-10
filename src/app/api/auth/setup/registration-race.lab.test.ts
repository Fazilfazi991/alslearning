// Opt-in isolated lab. Actual route and PostgREST/RLS; managed Auth calls are simulated.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { makeSetupGrant } from "@/lib/registration-setup-grant";

const lab = process.env.ALS_REGISTRATION_RACE_LAB === "1";
const userId = "10000000-0000-4000-8000-000000000011";
const sessionId = "20000000-0000-4000-8000-000000000011";
const container = process.env.ALS_REGISTRATION_RACE_CONTAINER || "als-checkpoint2-replay-pg-registration-auth";
const api = process.env.ALS_REGISTRATION_RACE_API || "http://127.0.0.1:38127";
const state = vi.hoisted(() => ({ client: null as unknown, grant: "", writes: 0, cleared: 0, outcome: "ok" as "ok" | "error" | "throw", hold: false, entered: null as null | (() => void), resume: null as null | (() => void) }));
vi.mock("@/lib/registration-setup-availability", () => ({ registrationPasswordSetupAvailable: true }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.grant }), delete: () => { state.cleared++; } }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client }));
import { POST } from "./route";
function sql(statement: string) {
  const run = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], { input: statement, encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout.trim();
}
function token() {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "authenticated", sub: userId, session_id: sessionId, exp: 4102444800 })}`;
  return `${payload}.${createHmac("sha256", "synthetic-test-secret-with-at-least-32-bytes-only").update(payload).digest("base64url")}`;
}
function request() { return new Request("http://127.0.0.1:38127/api/auth/setup", { method: "POST", headers: { origin: "http://127.0.0.1:38127", host: "127.0.0.1:38127", "content-type": "application/json" }, body: JSON.stringify({ password: "Synthetic-Password-123!" }) }); }
function deactivate() { sql(`set role als_account_status_writer; update public.profiles set is_active=false where id='${userId}'; reset role;`); }
async function accessible() { const response = await (state.client as ReturnType<typeof createSupabase>).from("enrollments").select("id").eq("student_id", userId); if (response.error) throw new Error(JSON.stringify(response.error)); return { rows: response.data?.length ?? 0 }; }

describe.skipIf(!lab)("isolated setup route versus deactivation", () => {
  beforeEach(() => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "test-secret-at-least-thirty-two-characters-long");
    sql(`set role als_account_status_writer; update public.profiles set is_active=true where id='${userId}'; reset role; update auth.users set banned_until=null where id='${userId}'; insert into auth.sessions(id,user_id,created_at,updated_at) values ('${sessionId}','${userId}',clock_timestamp(),clock_timestamp()) on conflict(id) do update set created_at=clock_timestamp(),not_after=null;`);
    state.grant = makeSetupGrant(userId, sessionId); state.writes = 0; state.cleared = 0; state.outcome = "ok"; state.hold = false; state.entered = null; state.resume = null;
    const client = createSupabase(api, "synthetic-public-key", { global: { headers: { Authorization: `Bearer ${token()}` }, fetch: (url, init) => fetch(String(url).replace("/rest/v1/", "/"), init) }, auth: { persistSession: false, autoRefreshToken: false } });
    vi.spyOn(client.auth, "getUser").mockResolvedValue({ data: { user: { id: userId } }, error: null } as never);
    vi.spyOn(client.auth, "getClaims").mockResolvedValue({ data: { claims: { session_id: sessionId } }, error: null } as never);
    vi.spyOn(client.auth, "signOut").mockResolvedValue({ error: null });
    vi.spyOn(client.auth, "updateUser").mockImplementation(async () => { state.entered?.(); if (state.hold) await new Promise<void>(resolve => { state.resume = resolve; }); state.writes++; if (state.outcome === "throw") throw new Error("simulated lost response"); if (state.outcome === "error") return { data: { user: null }, error: { message: "simulated error" } } as never; return { data: { user: { id: userId } }, error: null } as never; });
    state.client = client;
  });
  it("allows an active student through real profile RLS", async () => {
    const access = await accessible();
    expect(access.rows).toBeGreaterThan(0);
    expect((await POST(request())).status).toBe(200);
    expect(state.writes).toBe(1);
  });
  it("denies setup and protected access when deactivation commits first", async () => {
    deactivate();
    expect((await POST(request())).status).toBe(403);
    expect(state.writes).toBe(0);
    expect((await accessible()).rows).toBe(0);
    expect(sql(`select is_active::text || ':' || (banned_until > now())::text from public.profiles join auth.users using(id) where id='${userId}'`)).toBe("false:true");
  });
  it("regression: an in-flight write cannot report setup success after deactivation", async () => {
    state.hold = true; const entered = new Promise<void>(resolve => { state.entered = resolve; });
    const response = POST(request()); await entered; deactivate(); state.resume!();
    expect((await response).status).toBe(403);
  });
  it("keeps protected resources denied after a simulated late credential write and after reactivation of the old session", async () => {
    state.hold = true; const entered = new Promise<void>(resolve => { state.entered = resolve; });
    const response = POST(request()); await entered; deactivate(); state.resume!();
    expect((await response).status).toBe(403); expect(state.writes).toBe(1);
    expect((await accessible()).rows).toBe(0);
    expect(sql(`select role::text || ':' || is_active::text || ':' || (select count(*) from public.enrollments where student_id=p.id and status='active') from public.profiles p where id='${userId}'`)).toBe("student:false:1");
    sql(`set role als_account_status_writer; update public.profiles set is_active=true where id='${userId}'; reset role;`);
    expect((await accessible()).rows).toBe(0);
  });
  it("denies an expired Auth session despite an otherwise active student", async () => {
    sql(`update auth.sessions set not_after=clock_timestamp()-interval '1 hour' where id='${sessionId}'`);
    expect((await POST(request())).status).toBe(403);
    expect(state.writes).toBe(0);
    expect((await accessible()).rows).toBe(0);
  });
  it("denies completion when the session is revoked while the Auth write is held", async () => {
    state.hold = true; const entered = new Promise<void>(resolve => { state.entered = resolve; });
    const response = POST(request()); await entered;
    sql(`delete from auth.sessions where id='${sessionId}'`); state.resume!();
    expect((await response).status).toBe(403); expect(state.writes).toBe(1);
    expect((await accessible()).rows).toBe(0);
  });
  it.each(["error", "throw"] as const)("does not report success after a simulated lost Auth result (%s)", async outcome => {
    state.hold = true; state.outcome = outcome;
    const entered = new Promise<void>(resolve => { state.entered = resolve; });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = POST(request()); await entered; deactivate(); state.resume!();
      const result = await response;
      expect(result.status).toBe(503); expect(state.writes).toBe(1); expect(state.cleared).toBe(1);
      expect((await result.json()).error).toContain("password may have changed");
      expect((await accessible()).rows).toBe(0);
      expect(String(log.mock.calls[0][0])).toContain("registration_password_update_uncertain");
    } finally { log.mockRestore(); }
  });
  it("denies the old session if deactivation follows an authorized setup", async () => {
    expect((await POST(request())).status).toBe(200);
    deactivate(); expect((await accessible()).rows).toBe(0);
  });
  it("preserves active Student, Teacher and Admin session rules", async () => {
    sql(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('10000000-0000-4000-8000-000000000021','qa-admin@example.invalid','{"role":"admin"}','{}',now(),now()) on conflict(id) do nothing;
      insert into auth.sessions(id,user_id,created_at,updated_at) values ('20000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000021',clock_timestamp(),clock_timestamp()), ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',clock_timestamp(),clock_timestamp()) on conflict(id) do update set created_at=clock_timestamp();`);
    const roleFor = (id: string, session: string) => sql(`begin; set local role authenticated; set local request.jwt.claims='{"role":"authenticated","sub":"${id}","session_id":"${session}"}'; select private.active_role(); commit;`);
    const principals = [
      [userId, sessionId, "student"],
      ["10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001", "teacher"],
      ["10000000-0000-4000-8000-000000000021", "20000000-0000-4000-8000-000000000021", "admin"],
    ];
    for (const [id, session, role] of principals) expect(roleFor(id, session)).toBe(role);
    expect((await POST(request())).status).toBe(200);
    for (const [id, session, role] of principals) expect(roleFor(id, session)).toBe(role);
  });
  it("keeps an independent ban and rejects a banned student", async () => {
    sql(`update auth.users set banned_until=clock_timestamp()+interval '200 years' where id='${userId}';`);
    deactivate();
    sql(`set role als_account_status_writer; update public.profiles set is_active=true where id='${userId}'; reset role;`);
    expect(sql(`select (banned_until>clock_timestamp()+interval '150 years')::text from auth.users where id='${userId}'`)).toBe("true");
    expect((await POST(request())).status).toBe(403);
    expect(state.writes).toBe(0); expect((await accessible()).rows).toBe(0);
  });
});

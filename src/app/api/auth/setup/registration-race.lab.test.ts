// Opt-in isolated lab. Actual route and PostgREST/RLS; managed Auth calls are simulated.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { newSetupCapability, setupCapabilityDigest } from "@/lib/registration-setup-grant";

const lab = process.env.ALS_REGISTRATION_RACE_LAB === "1";
const userId = "10000000-0000-4000-8000-000000000011";
const sessionId = "20000000-0000-4000-8000-000000000011";
const container = process.env.ALS_REGISTRATION_RACE_CONTAINER || "als-checkpoint2-replay-pg-registration-auth";
const api = process.env.ALS_REGISTRATION_RACE_API || "http://127.0.0.1:38127";
const state = vi.hoisted(() => ({ client: null as unknown, service: null as unknown, grant: "", writes: 0, cleared: 0, outcome: "ok" as "ok" | "error" | "throw", hold: false, entered: null as null | (() => void), resume: null as null | (() => void) }));
vi.mock("@/lib/registration-setup-availability", () => ({ registrationPasswordSetupAvailable: true }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.grant }), delete: () => { state.cleared++; } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => state.service }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client }));
import { POST } from "./route";
function sql(statement: string) {
  const run = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"], { input: statement, encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout.trim();
}
function token(role = "authenticated") {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role, sub: userId, session_id: sessionId, exp: 4102444800 })}`;
  return `${payload}.${createHmac("sha256", process.env.ALS_REGISTRATION_RACE_JWT_SECRET!).update(payload).digest("base64url")}`;
}
function labClient() { return createSupabase(api, "synthetic-public-key", { global: { headers: { Authorization: `Bearer ${token("service_role")}` }, fetch: (url, init) => fetch(String(url).replace("/rest/v1/", "/"), init) }, auth: { persistSession: false, autoRefreshToken: false } }); }
function recoveryAdmin(second = false) {
  const id = second ? "10000000-0000-4000-8000-000000000022" : "10000000-0000-4000-8000-000000000021", session = second ? "20000000-0000-4000-8000-000000000022" : "20000000-0000-4000-8000-000000000021";
  const email = second ? "qa-admin-2@example.invalid" : "qa-admin@example.invalid";
  sql(`insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('${id}','${email}','{"role":"admin"}','{}',clock_timestamp(),clock_timestamp()) on conflict(id) do nothing;
    insert into auth.sessions(id,user_id,created_at,updated_at) values ('${session}','${id}',clock_timestamp(),clock_timestamp()) on conflict(id) do update set created_at=clock_timestamp(),not_after=null;`);
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "authenticated", sub: id, session_id: session, exp: 4102444800 })}`;
  const jwt = `${payload}.${createHmac("sha256", process.env.ALS_REGISTRATION_RACE_JWT_SECRET!).update(payload).digest("base64url")}`;
  return createSupabase(api, "synthetic-public-key", { global: { headers: { Authorization: `Bearer ${jwt}` }, fetch: (url, init) => fetch(String(url).replace("/rest/v1/", "/"), init) }, auth: { persistSession: false, autoRefreshToken: false } });
}
function request() { return new Request("http://127.0.0.1:38127/api/auth/setup", { method: "POST", headers: { origin: "http://127.0.0.1:38127", host: "127.0.0.1:38127", "content-type": "application/json" }, body: JSON.stringify({ password: `Aa1!${randomBytes(24).toString("hex")}` }) }); }
function deactivate() { sql(`set role als_account_status_writer; update public.profiles set is_active=false where id='${userId}'; reset role;`); }
async function accessible() { const response = await (state.client as ReturnType<typeof labClient>).from("enrollments").select("id").eq("student_id", userId); if (response.error) throw new Error(JSON.stringify(response.error)); return { rows: response.data?.length ?? 0 }; }

describe.skipIf(!lab)("isolated setup route versus deactivation", () => {
  beforeEach(async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", randomBytes(32).toString("hex"));
    sql(`set role als_account_status_writer; update public.profiles set is_active=true where id='${userId}'; reset role; update auth.users set banned_until=null where id='${userId}'; insert into auth.sessions(id,user_id,created_at,updated_at) values ('${sessionId}','${userId}',clock_timestamp(),clock_timestamp()) on conflict(id) do update set created_at=clock_timestamp(),not_after=null;`);
    sql(`do $$ begin if to_regclass('private.registration_setup_recoveries') is not null then execute 'delete from private.registration_setup_recoveries'; execute 'delete from private.registration_setup_operations where replaces_operation_id is not null'; end if; end $$;
      delete from private.registration_setup_operations;
      delete from public.student_registration_events where registration_id='80000000-0000-4000-8000-000000000099';
      insert into public.student_registrations(id,full_name,email,phone,qualification,institution,program_id,status,student_id)
      values('80000000-0000-4000-8000-000000000099','Synthetic Student',(select email from auth.users where id='${userId}'),'+919999999999','Degree','Test College','30000000-0000-4000-8000-000000000001','approved','${userId}') on conflict(id) do update set email=excluded.email;`);
    state.grant = newSetupCapability();
    const service = labClient();
    state.service = service;
    const issue = await service.rpc("issue_registration_setup", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(state.grant) });
    if (issue.error || issue.data !== true) throw new Error(`Lab grant issuance failed: ${JSON.stringify(issue.error)}`); state.writes = 0; state.cleared = 0; state.outcome = "ok"; state.hold = false; state.entered = null; state.resume = null;
    const client = createSupabase(api, "synthetic-public-key", { global: { headers: { Authorization: `Bearer ${token()}` }, fetch: (url, init) => fetch(String(url).replace("/rest/v1/", "/"), init) }, auth: { persistSession: false, autoRefreshToken: false } });
    vi.spyOn(client.auth, "getUser").mockResolvedValue({ data: { user: { id: userId } }, error: null } as never);
    vi.spyOn(client.auth, "getClaims").mockResolvedValue({ data: { claims: { sub: userId, session_id: sessionId } }, error: null } as never);
    vi.spyOn(client.auth, "signOut").mockResolvedValue({ error: null });
    vi.spyOn(client.auth, "updateUser").mockImplementation(async () => { state.entered?.(); if (state.hold) await new Promise<void>(resolve => { state.resume = resolve; }); state.writes++; if (state.outcome === "throw") throw new Error("simulated lost response"); if (state.outcome === "error") return { data: { user: null }, error: { message: "simulated error" } } as never; return { data: { user: { id: userId } }, error: null } as never; });
    state.client = client;
  });
  it("allows only one dispatch for concurrent copies and rejects replay", async () => {
    state.hold = true; const entered = new Promise<void>(resolve => { state.entered = resolve; });
    const first = POST(request()); await entered;
    expect(sql(`select provider_outcome||':'||access_decision from private.registration_setup_operations where student_id='${userId}'`)).toBe("may_have_dispatched:not_checked");
    const second = await POST(request());
    expect(second.status).toBe(401); expect(state.writes).toBe(0);
    state.resume!(); expect((await first).status).toBe(200); expect(state.writes).toBe(1);
    expect(sql(`select provider_outcome||':'||access_decision from private.registration_setup_operations where student_id='${userId}'`)).toBe("confirmed_success:allowed");
    const copied = state.grant; state.grant = ""; expect((await POST(request())).status).toBe(401);
    state.grant = copied;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(401); expect(state.writes).toBe(1);
      expect(JSON.parse(String(info.mock.calls.at(-1)?.[0])).classification).toBe("used");
    } finally { info.mockRestore(); }
  });
  it("keeps a claimed grant unusable after a simulated worker restart", async () => {
    const service = state.service as ReturnType<typeof labClient>;
    const claim = await service.rpc("claim_registration_setup", { p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(state.grant) });
    expect(typeof claim.data).toBe("string");
    expect((await POST(request())).status).toBe(401); expect(state.writes).toBe(0);
    const replacement = await service.rpc("issue_registration_setup", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(newSetupCapability()) });
    expect(replacement.data).toBe(false);
  });
  it("keeps a claimed operation non-retryable if result persistence fails", async () => {
    const service = state.service as ReturnType<typeof labClient>, original = service.rpc.bind(service);
    vi.spyOn(service, "rpc").mockImplementation(((name: string, args: Record<string, unknown>) => name === "finish_registration_setup" ? Promise.resolve({ data: null, error: { message: "synthetic failure" } }) : original(name, args)) as never);
    expect((await POST(request())).status).toBe(503); expect(state.writes).toBe(1);
    expect(sql(`select state from private.registration_setup_operations where student_id='${userId}'`)).toBe("claimed");
    expect((await POST(request())).status).toBe(401); expect(state.writes).toBe(1);
  });
  it("preserves a claimed grant after the actual route worker is killed", async () => {
    const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "src/app/api/auth/setup/registration-crash-worker.lab.test.ts", "--pool=threads", "--maxWorkers=1", "--reporter=dot"], { env: { ...process.env, ALS_REGISTRATION_CRASH_WORKER: "1", ALS_TEST_GRANT: state.grant, ALS_REGISTRATION_RACE_API: api }, stdio: ["ignore", "pipe", "pipe"] });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Worker did not reach dispatch barrier")), 20000);
        child.stdout.on("data", chunk => { if (String(chunk).includes("ALS_SYNTHETIC_DISPATCH_ENTERED")) { clearTimeout(timer); resolve(); } });
        child.once("exit", () => { clearTimeout(timer); reject(new Error("Worker exited before dispatch barrier")); });
        child.once("error", error => { clearTimeout(timer); reject(error); });
      });
      const exited = new Promise<void>(resolve => child.once("exit", () => resolve()));
      child.kill("SIGKILL"); await exited;
      expect(sql(`select state from private.registration_setup_operations where student_id='${userId}'`)).toBe("claimed");
      expect((await POST(request())).status).toBe(401); expect(state.writes).toBe(0);
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
  }, 30000);
  it("does not repeat an uncertain update or issue a replacement", async () => {
    state.outcome = "throw"; const copied = state.grant;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await POST(request())).status).toBe(503); expect(state.writes).toBe(1);
      expect(sql(`select state from private.registration_setup_operations where student_id='${userId}'`)).toBe("unknown");
      expect(sql(`select provider_outcome||':'||access_decision from private.registration_setup_operations where student_id='${userId}'`)).toBe("unknown:not_checked");
      // A browser retry after uncertainUpdate cleared its cookie must not assert expiry.
      state.grant = ""; const afterClear = await POST(request());
      expect(afterClear.status).toBe(401);
      const message = (await afterClear.json()).error;
      expect(message).toContain("may have changed");
      expect(message).not.toContain("has expired");
      expect(state.writes).toBe(1);
      state.grant = copied;
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      try {
        expect((await POST(request())).status).toBe(401); expect(state.writes).toBe(1);
        expect(JSON.parse(String(info.mock.calls.at(-1)?.[0])).classification).toBe("unresolved");
      } finally { info.mockRestore(); }
      const replacement = await (state.service as ReturnType<typeof labClient>).rpc("issue_registration_setup", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(newSetupCapability()) });
      expect(replacement.data).toBe(false);
    } finally { log.mockRestore(); }
  });
  it("denies a copied capability in another session and after expiry", async () => {
    const service = state.service as ReturnType<typeof labClient>;
    const wrong = await service.rpc("claim_registration_setup", { p_student: userId, p_session: "20000000-0000-4000-8000-000000000012", p_digest: setupCapabilityDigest(state.grant) });
    expect(wrong.data).toBeNull(); expect(state.writes).toBe(0);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const original = state.grant;
    state.grant = newSetupCapability();
    expect((await POST(request())).status).toBe(401);
    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0])).classification).toBe("invalid");
    state.grant = original;
    sql(`update private.registration_setup_operations set issued_at=clock_timestamp()-interval '20 minutes',expires_at=clock_timestamp()-interval '10 minutes' where student_id='${userId}'`);
    expect((await POST(request())).status).toBe(401); expect(state.writes).toBe(0);
    expect(JSON.parse(String(info.mock.calls.at(-1)?.[0])).classification).toBe("expired");
    info.mockRestore();
  });
  it("supersedes an unused setup capability when fresh proof is issued", async () => {
    const old = state.grant, replacement = newSetupCapability();
    const issued = await (state.service as ReturnType<typeof labClient>).rpc("issue_registration_setup", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(replacement) });
    expect(issued.data).toBe(true); state.grant = old;
    expect((await POST(request())).status).toBe(401); expect(state.writes).toBe(0);
    state.grant = replacement; expect((await POST(request())).status).toBe(200); expect(state.writes).toBe(1);
  });
  it("does not offer a resend for inactive or independently banned students", async () => {
    const service = state.service as ReturnType<typeof labClient>;
    const available = () => service.rpc("registration_setup_invitation_available", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId });
    expect((await available()).data).toBe(true);
    deactivate(); expect((await available()).data).toBe(false);
    sql(`set role als_account_status_writer; update public.profiles set is_active=true where id='${userId}'; reset role; update auth.users set banned_until=clock_timestamp()+interval '1 year' where id='${userId}';`);
    expect((await available()).data).toBe(false);
  });
  it("denies client-side access to service-only grant functions", async () => {
    const client = state.client as ReturnType<typeof labClient>;
    const result = await client.rpc("claim_registration_setup", { p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(state.grant) });
    expect(result.error).not.toBeNull(); expect(result.data).toBeNull(); expect(state.writes).toBe(0);
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
    expect(sql(`select provider_outcome||':'||access_decision from private.registration_setup_operations where student_id='${userId}'`)).toBe("confirmed_success:denied_or_unavailable");
  });
  it("requires explicit recovery authorization after a successful write denied by deactivation", async () => {
    state.hold = true; const entered = new Promise<void>(resolve => { state.entered = resolve; });
    const response = POST(request()); await entered; deactivate(); state.resume!();
    expect((await response).status).toBe(403);
    expect(sql(`select state from private.registration_setup_operations where student_id='${userId}'`)).toBe("authorization_denied");
    const newSession = "20000000-0000-4000-8000-000000000099";
    sql(`set role als_account_status_writer; update public.profiles set is_active=true where id='${userId}'; reset role; insert into auth.sessions(id,user_id,created_at,updated_at) values ('${newSession}','${userId}',clock_timestamp(),clock_timestamp()) on conflict(id) do update set created_at=excluded.created_at,not_after=null;`);
    const service = state.service as ReturnType<typeof labClient>;
    const invitation = await service.rpc("registration_setup_invitation_available", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId });
    const issue = await service.rpc("issue_registration_setup", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId, p_session: newSession, p_digest: setupCapabilityDigest(newSetupCapability()) });
    expect({ invitation: invitation.data, issue: issue.data }).toEqual({ invitation: false, issue: false });
  });
  it("blocks issuance and resend for an unrecognized future operation state", () => {
    sql(`begin;
      alter table private.registration_setup_operations drop constraint registration_setup_operations_state_check;
      update private.registration_setup_operations set state='future_unrecognized' where student_id='${userId}';
      do $$ begin
        if not private.registration_setup_identity_allowed('80000000-0000-4000-8000-000000000099','${userId}','${sessionId}') then raise exception 'fixture session is not authorized'; end if;
        if public.registration_setup_invitation_available('80000000-0000-4000-8000-000000000099','${userId}') then raise exception 'future state allowed resend'; end if;
        if public.issue_registration_setup('80000000-0000-4000-8000-000000000099','${userId}','${sessionId}',repeat('f',64)) then raise exception 'future state allowed issuance'; end if;
      end $$;
      rollback;`);
  });
  it("allows only one audited, identity-bound replacement after confirmed success", async () => {
    expect((await POST(request())).status).toBe(200);
    const original = state.grant;
    const operation = sql(`select id from private.registration_setup_operations where student_id='${userId}'`);
    const admin = recoveryAdmin(), otherAdmin = recoveryAdmin(true), registration = "80000000-0000-4000-8000-000000000099";
    const args = { p_registration: registration, p_operation: operation, p_reason: "setup_acknowledgement_lost" };
    const decisions = await Promise.all([admin.rpc("authorize_registration_setup_recovery", args), otherAdmin.rpc("authorize_registration_setup_recovery", args)]);
    expect(decisions.map(result => result.error)).toEqual([null, null]);
    expect(decisions.filter(result => typeof result.data === "string")).toHaveLength(1);
    const recovery = decisions.find(result => typeof result.data === "string")!.data as string;
    expect(sql(`select count(*) from public.student_registration_events where registration_id='${registration}' and kind='setup_recovery_authorized'`)).toBe("1");
    const status = await admin.rpc("registration_setup_recovery_status", { p_registration: registration });
    expect(status.error).toBeNull();
    expect(JSON.stringify(status.data)).not.toMatch(/grant_digest|session_id|access_token|refresh_token/);
    const service = state.service as ReturnType<typeof labClient>, next = newSetupCapability();
    expect((await service.rpc("issue_registration_setup", { p_registration: registration, p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(next) })).data).toBe(false);
    const replacement = { p_registration: registration, p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(next), p_recovery: recovery };
    const claims = await Promise.all([service.rpc("issue_registration_setup_replacement", replacement), service.rpc("issue_registration_setup_replacement", replacement)]);
    expect(claims.filter(result => result.data === true)).toHaveLength(1);
    expect(sql(`select count(*) from public.student_registration_events where registration_id='${registration}' and kind='setup_recovery_redeemed'`)).toBe("1");
    expect(sql(`select count(*) from private.registration_setup_operations where replaces_operation_id='${operation}'`)).toBe("1");
    state.grant = original; expect((await POST(request())).status).toBe(401);
    state.grant = next; expect((await POST(request())).status).toBe(200);
  });
  it("does not authorize unknown results or an inactive, banned, mismatched, or revoked principal", async () => {
    const admin = recoveryAdmin(), registration = "80000000-0000-4000-8000-000000000099";
    const operation = sql(`select id from private.registration_setup_operations where student_id='${userId}'`);
    const authorize = () => admin.rpc("authorize_registration_setup_recovery", { p_registration: registration, p_operation: operation, p_reason: "operator_assisted_setup" });
    state.outcome = "throw";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect((await POST(request())).status).toBe(503); } finally { log.mockRestore(); }
    expect((await authorize()).data).toBeNull();
    // Simulate a separately established terminal success solely to exercise
    // authorization gates; the unknown branch above remains non-recoverable.
    sql(`update private.registration_setup_operations set state='provider_confirmed' where id='${operation}'`);
    deactivate(); expect((await authorize()).data).toBeNull();
    sql(`set role als_account_status_writer; update public.profiles set is_active=true where id='${userId}'; reset role; update auth.users set banned_until=clock_timestamp()+interval '1 year' where id='${userId}';`);
    expect((await authorize()).data).toBeNull();
    sql(`update auth.users set banned_until=null where id='${userId}'; update public.student_registrations set email='identity-drift@example.invalid' where id='${registration}';`);
    expect((await authorize()).data).toBeNull();
    sql(`update public.student_registrations set email=(select email from auth.users where id='${userId}') where id='${registration}'; update public.profiles set email='profile-drift@example.invalid' where id='${userId}';`);
    expect((await authorize()).data).toBeNull();
    sql(`update public.profiles set email=(select email from auth.users where id='${userId}') where id='${userId}'; update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='20000000-0000-4000-8000-000000000021';`);
    expect((await authorize()).data).toBeNull();
    expect(sql(`select count(*) from public.student_registration_events where registration_id='${registration}' and kind='setup_recovery_authorized'`)).toBe("0");
    sql(`update auth.sessions set not_after=null where id='20000000-0000-4000-8000-000000000021';`);
  });
  it("rolls back recovery authorization if its audit cannot be recorded", async () => {
    expect((await POST(request())).status).toBe(200);
    const operation = sql(`select id from private.registration_setup_operations where student_id='${userId}'`);
    const admin = recoveryAdmin();
    sql(`create function private.qa_recovery_audit_failure() returns trigger language plpgsql as $$ begin if new.kind='setup_recovery_authorized' then raise exception 'synthetic audit failure'; end if; return new; end $$;
      create trigger qa_recovery_audit_failure before insert on public.student_registration_events for each row execute function private.qa_recovery_audit_failure();`);
    try {
      const result = await admin.rpc("authorize_registration_setup_recovery", { p_registration: "80000000-0000-4000-8000-000000000099", p_operation: operation, p_reason: "operator_assisted_setup" });
      expect(result.error).not.toBeNull();
      expect(sql(`select count(*) from private.registration_setup_recoveries where source_operation='${operation}'`)).toBe("0");
    } finally { sql(`drop trigger qa_recovery_audit_failure on public.student_registration_events; drop function private.qa_recovery_audit_failure();`); }
  });
  it("blocks operator recovery while the original simulated provider request is held", async () => {
    const admin = recoveryAdmin(), service = state.service as ReturnType<typeof labClient>;
    state.hold = true;
    const entered = new Promise<void>(resolve => { state.entered = resolve; });
    const original = POST(request()); await entered;
    try {
      const operation = sql(`select id from private.registration_setup_operations where student_id='${userId}'`);
      const result = await admin.rpc("authorize_registration_setup_recovery", { p_registration: "80000000-0000-4000-8000-000000000099", p_operation: operation, p_reason: "operator_assisted_setup" });
      expect(result.error).toBeNull(); expect(result.data).toBeNull();
      const replacement = await service.rpc("issue_registration_setup_replacement", { p_registration: "80000000-0000-4000-8000-000000000099", p_student: userId, p_session: sessionId, p_digest: setupCapabilityDigest(newSetupCapability()), p_recovery: "f0000000-0000-4000-8000-000000000001" });
      expect(replacement.data).toBe(false); expect(state.writes).toBe(0);
    } finally { state.resume!(); await original; }
    expect(state.writes).toBe(1);
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

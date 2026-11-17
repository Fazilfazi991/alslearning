import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
const testPassword = `Aa1!${randomBytes(24).toString("hex")}`;


const state = vi.hoisted(() => ({ available: true, currentError: false, currentThrows: false, claimSub: "student-a", userId: "student-a", sessionId: "session-a", grant: "", role: "student", active: true, claimStatus: "claimed", claimOverride: undefined as unknown, update: vi.fn(), signOut: vi.fn(), deleteCookie: vi.fn() }));
vi.mock("@/lib/registration-setup-availability", () => ({ get registrationPasswordSetupAvailable() { return state.available; } }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => ({ rpc: async (name: string) => name === "claim_registration_setup_with_status" ? { data: state.claimOverride !== undefined ? state.claimOverride : state.userId === "student-a" && state.sessionId === "session-a" ? state.claimStatus === "claimed" ? { status: "claimed", operation_id: "10000000-0000-4000-8000-000000000001" } : { status: state.claimStatus } : { status: "invalid" }, error: null } : { data: "provider_confirmed", error: null } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.grant ? { value: state.grant } : undefined, delete: state.deleteCookie }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: {
    getUser: async () => ({ data: { user: { id: state.userId } }, error: null }),
    getClaims: async () => ({ data: { claims: { sub: state.claimSub, session_id: state.sessionId } }, error: null }),
    updateUser: state.update,
    signOut: state.signOut,
  },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: state.role, is_active: state.active }, error: null }), maybeSingle: async () => { if (state.currentThrows) throw new Error("network failure"); return state.currentError ? ({ data: null, error: { message: "unavailable" } }) : ({ data: { role: state.role, is_active: state.active }, error: null }); } }) }) }),
}) }));
import { POST } from "./route";

function request(password = testPassword) {
  return new Request("https://als.example/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://als.example", host: "als.example" }, body: JSON.stringify({ password }) });
}
beforeEach(() => {
  vi.stubEnv("REGISTRATION_SETUP_SECRET", randomBytes(32).toString("hex"));
  state.available = true; state.currentError = false; state.currentThrows = false; state.claimSub = "student-a"; state.userId = "student-a"; state.sessionId = "session-a"; state.role = "student"; state.active = true; state.claimStatus = "claimed"; state.claimOverride = undefined;
  state.grant = "A".repeat(43);
  state.update.mockReset().mockResolvedValue({ error: null }); state.signOut.mockReset().mockResolvedValue({ error: null }); state.deleteCookie.mockReset();
});
describe("registration password setup boundary", () => {
  it("fails closed before Auth when setup is unavailable", async () => {
    state.available = false;
    expect((await POST(request())).status).toBe(503);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("updates the intended active student and signs out after success", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(state.update).toHaveBeenCalledOnce();
    expect(state.update).toHaveBeenCalledWith({ password: testPassword });
    expect(state.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(state.deleteCookie).toHaveBeenCalledOnce();
  });
  it.each(["returned", "thrown"])("reports uncertain global sign-out after a password update (%s)", async mode => {
    if (mode === "returned") state.signOut.mockResolvedValue({ error: { message: "private provider detail" } });
    else state.signOut.mockRejectedValue(new Error("private provider detail"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("password changed");
      expect(state.deleteCookie).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledOnce();
      expect(String(log.mock.calls[0][0])).not.toContain("private provider detail");
    } finally { log.mockRestore(); }
  });
  it("does not report success if access is lost during the password update", async () => {
    state.update.mockImplementation(async () => { state.active = false; return { error: null }; });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("password may have changed");
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not report success if the post-write database check fails", async () => {
    state.currentError = true;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("password may have changed");
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("treats a thrown post-write database check as uncertain", async () => {
    state.currentThrows = true;
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("password may have changed");
    expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it.each(["returned", "thrown"])("clears the browser grant after an uncertain password update (%s)", async mode => {
    if (mode === "returned") state.update.mockResolvedValue({ error: { message: "private provider detail" } });
    else state.update.mockRejectedValue(new Error("private provider detail"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("password may have changed");
      expect(state.deleteCookie).toHaveBeenCalledOnce();
      expect(state.signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(String(log.mock.calls[0][0])).toContain("registration_password_update_uncertain");
      expect(String(log.mock.calls[0][0])).not.toContain("private provider detail");
    } finally { log.mockRestore(); }
  });
  it("rejects a verified claims subject that differs from the Auth user", async () => {
    state.claimSub = "student-b";
    expect((await POST(request())).status).toBe(401);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("does not claim expiry when a cleared grant could follow an uncertain write", async () => {
    state.grant = "";
    const response = await POST(request());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("may have changed");
    expect(body.error).not.toContain("has expired");
    expect(state.update).not.toHaveBeenCalled();
  });
  it.each(["invalid", "unavailable", "unresolved", "used", "expired"])("keeps %s diagnostics out of public errors", async status => {
    state.claimStatus = status;
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(401);
      expect((await response.json()).error).toBe("This setup link is unavailable or has already been used. If you submitted a password, it may have changed. Contact admissions before trying again.");
      expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({ event: "registration_setup_claim_denied", classification: status });
      expect(state.update).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it.each([null, [], { status: "unexpected" }, { status: "claimed" }, { status: "claimed", operation_id: "not-a-uuid" }])("fails closed on malformed claim result %#", async result => {
    state.claimOverride = result;
    expect((await POST(request())).status).toBe(503);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("rejects a grant issued to a different account", async () => {
    state.userId = "student-b"; state.claimSub = "student-b";
    expect((await POST(request())).status).toBe(401);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("rejects a grant issued to a different session", async () => {
    state.sessionId = "session-b";
    expect((await POST(request())).status).toBe(401);
    expect(state.update).not.toHaveBeenCalled();
  });
  it.each([{ role: "student", active: false }, { role: "teacher", active: true }])("rejects an inactive or non-student profile", async ({ role, active }) => {
    state.role = role; state.active = active;
    expect((await POST(request())).status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("rejects passwords outside the existing policy", async () => {
    expect((await POST(request("weak"))).status).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });
  it("rejects a cross-origin request", async () => {
    const req = new Request("https://als.example/api/auth/setup", { method: "POST", headers: { origin: "https://other.example", host: "als.example" }, body: "{}" });
    expect((await POST(req)).status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
  });
});


import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSetupGrant } from "@/lib/registration-setup-grant";

const state = vi.hoisted(() => ({ available: true, currentError: false, currentThrows: false, userId: "student-a", sessionId: "session-a", grant: "", role: "student", active: true, update: vi.fn(), signOut: vi.fn(), deleteCookie: vi.fn() }));
vi.mock("@/lib/registration-setup-availability", () => ({ get registrationPasswordSetupAvailable() { return state.available; } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.grant ? { value: state.grant } : undefined, delete: state.deleteCookie }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: {
    getUser: async () => ({ data: { user: { id: state.userId } }, error: null }),
    getClaims: async () => ({ data: { claims: { session_id: state.sessionId } }, error: null }),
    updateUser: state.update,
    signOut: state.signOut,
  },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: state.role, is_active: state.active }, error: null }), maybeSingle: async () => { if (state.currentThrows) throw new Error("network failure"); return state.currentError ? ({ data: null, error: { message: "unavailable" } }) : ({ data: { role: state.role, is_active: state.active }, error: null }); } }) }) }),
}) }));
import { POST } from "./route";

function request(password = "Strong-pass123!") {
  return new Request("https://als.example/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://als.example", host: "als.example" }, body: JSON.stringify({ password }) });
}
beforeEach(() => {
  vi.stubEnv("REGISTRATION_SETUP_SECRET", "test-secret-at-least-thirty-two-characters-long");
  state.available = true; state.currentError = false; state.currentThrows = false; state.userId = "student-a"; state.sessionId = "session-a"; state.role = "student"; state.active = true;
  state.grant = makeSetupGrant(state.userId, state.sessionId);
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
    expect(state.update).toHaveBeenCalledWith({ password: "Strong-pass123!" });
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
  it("rejects a grant issued to a different account", async () => {
    state.userId = "student-b";
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


import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSetupGrant } from "@/lib/registration-setup-grant";

const state = vi.hoisted(() => ({ available: true, userId: "student-a", sessionId: "session-a", grant: "", role: "student", active: true, update: vi.fn(), signOut: vi.fn(), deleteCookie: vi.fn() }));
vi.mock("@/lib/registration-setup-availability", () => ({ get registrationPasswordSetupAvailable() { return state.available; } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.grant ? { value: state.grant } : undefined, delete: state.deleteCookie }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: {
    getUser: async () => ({ data: { user: { id: state.userId } }, error: null }),
    getClaims: async () => ({ data: { claims: { session_id: state.sessionId } }, error: null }),
    updateUser: state.update,
    signOut: state.signOut,
  },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: state.role, is_active: state.active }, error: null }) }) }) }),
}) }));
import { POST } from "./route";

function request(password = "Strong-pass123!") {
  return new Request("https://als.example/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://als.example", host: "als.example" }, body: JSON.stringify({ password }) });
}
beforeEach(() => {
  vi.stubEnv("REGISTRATION_SETUP_SECRET", "test-secret-at-least-thirty-two-characters-long");
  state.available = true; state.userId = "student-a"; state.sessionId = "session-a"; state.role = "student"; state.active = true;
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
  it("retains the grant when the provider rejects the password update", async () => {
    state.update.mockResolvedValue({ error: { message: "unavailable" } });
    expect((await POST(request())).status).toBe(503);
    expect(state.deleteCookie).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
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


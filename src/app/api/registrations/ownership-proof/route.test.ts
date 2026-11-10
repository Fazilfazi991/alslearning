import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: vi.fn(), profile: vi.fn(), rpc: vi.fn(), origin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: state.user }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: state.profile }) }) }) }) }));
vi.mock("@/lib/enquiries-server", () => ({ enquiryService: () => ({ rpc: state.rpc }) }));
vi.mock("@/lib/request-origin", () => ({ isSameOriginRequest: state.origin }));
import { POST } from "./route";

const requestId = "7b91965a-475b-4a0f-8ac6-09dbf0c7c201";
const makeRequest = (body: unknown) => new Request("https://als.example/api/registrations/ownership-proof", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  state.origin.mockReturnValue(true);
  state.user.mockResolvedValue({ data: { user: { id: "verified-student", email: "Student@Example.test", email_confirmed_at: "2026-01-01" } }, error: null });
  state.profile.mockResolvedValue({ data: { role: "student", is_active: true }, error: null });
  state.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => vi.clearAllMocks());
describe("existing student application proof", () => {
  it("binds only the server-verified session identity and never grants access", async () => {
    const response = await POST(makeRequest({ requestId }));
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("record_registration_identity_proof", { p_request_id: requestId, p_user_id: "verified-student", p_email: "student@example.test" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects client-supplied identities and cross-origin requests", async () => {
    expect((await POST(makeRequest({ requestId, userId: "other" }))).status).toBe(400);
    state.origin.mockReturnValue(false);
    expect((await POST(makeRequest({ requestId }))).status).toBe(403);
    expect(state.user).not.toHaveBeenCalled();
  });
  it("requires a confirmed active student session", async () => {
    state.user.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(makeRequest({ requestId }))).status).toBe(401);
    state.user.mockResolvedValueOnce({ data: { user: { id: "student", email: "a@example.test", email_confirmed_at: null } }, error: null });
    expect((await POST(makeRequest({ requestId }))).status).toBe(403);
    state.profile.mockResolvedValueOnce({ data: { role: "admin", is_active: true }, error: null });
    expect((await POST(makeRequest({ requestId }))).status).toBe(403);
    state.profile.mockResolvedValueOnce({ data: { role: "student", is_active: false }, error: null });
    expect((await POST(makeRequest({ requestId }))).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("fails closed for unmatching applications or an unavailable RPC", async () => {
    state.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await POST(makeRequest({ requestId }))).status).toBe(409);
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } });
    expect((await POST(makeRequest({ requestId }))).status).toBe(503);
  });
});

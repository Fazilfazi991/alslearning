import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ enabled: true, rpc: vi.fn() }));
vi.mock("@/lib/registration-setup-availability", () => ({ get registrationPasswordSetupAvailable() { return state.enabled; } }));
vi.mock("@/lib/admin-session", () => ({ adminSession: async () => ({ db: { rpc: state.rpc } }) }));
import { GET, POST } from "./route";

const registration = "80000000-0000-4000-8000-000000000099";
const operation = "80000000-0000-4000-8000-000000000098";
const context = { params: Promise.resolve({ id: registration }) };
const request = (body: unknown) => new Request("https://als.example/api/admin/registrations/test/setup-recovery", { method: "POST", headers: { origin: "https://als.example", host: "als.example", "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => { state.enabled = true; state.rpc.mockReset(); });
describe("narrow registration recovery action", () => {
  it("returns only the database's sanitized status", async () => {
    state.rpc.mockResolvedValue({ data: { student_id: "synthetic", operations: [] }, error: null });
    expect((await GET(new Request("https://als.example"), context)).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("registration_setup_recovery_status", { p_registration: registration });
  });
  it("does not authorize while the local acceptance gate is disabled", async () => {
    state.enabled = false;
    expect((await POST(request({ operationId: operation, reason: "operator_assisted_setup" }), context)).status).toBe(503);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("rejects free text, extra input and unavailable operations", async () => {
    expect((await POST(request({ operationId: operation, reason: "free text" }), context)).status).toBe(400);
    expect((await POST(request({ operationId: operation, reason: "operator_assisted_setup", extra: "x" }), context)).status).toBe(400);
    state.rpc.mockResolvedValue({ data: null, error: null });
    expect((await POST(request({ operationId: operation, reason: "operator_assisted_setup" }), context)).status).toBe(409);
  });
  it("records the bounded resolution through the authenticated database client", async () => {
    state.rpc.mockResolvedValue({ data: operation, error: null });
    const response = await POST(request({ operationId: operation, reason: "setup_acknowledgement_lost" }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authorized: true });
    expect(state.rpc).toHaveBeenCalledWith("authorize_registration_setup_recovery", { p_registration: registration, p_operation: operation, p_reason: "setup_acknowledgement_lost" });
  });
});

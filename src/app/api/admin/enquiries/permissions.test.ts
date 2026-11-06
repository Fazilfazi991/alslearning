import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), rpc: vi.fn(), record: vi.fn(), createUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mock.getUser }, rpc: mock.rpc,
  from: (table: string) => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, single: mock.profile, maybeSingle: mock.record, then: (resolve: (value: unknown) => unknown) => Promise.resolve(mock.record(table)).then(resolve) };
    return chain;
  },
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => ({ auth: { admin: { createUser: mock.createUser } } }) }));
import { GET as list } from "./route";
import { GET as detail, PATCH } from "./[id]/route";
import { POST as activity } from "./[id]/activities/route";
import { POST as admit } from "../students/route";

const id = "b8fb961f-5b3e-4a74-b63d-518fe4f8496d";
const context = () => ({ params: Promise.resolve({ id }) });
const request = (method: string, body?: unknown, origin = "https://als.example") => new Request(`https://als.example/api/admin/enquiries/${id}`, { method, headers: { origin, host: "als.example", "content-type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const actions = [
  () => list(request("GET")), () => detail(request("GET"), context()),
  () => PATCH(request("PATCH", { status: "interested" }), context()),
  () => activity(request("POST", { kind: "note", note: "Internal note" }), context()),
  () => admit(request("POST", {})),
];

describe("admissions permissions use canonical active profile roles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.getUser.mockResolvedValue({ data: { user: { id: "viewer", user_metadata: { role: "admin" }, app_metadata: { role: "admin" } } }, error: null });
    mock.profile.mockResolvedValue({ data: { role: "admin", is_active: true }, error: null });
    mock.rpc.mockResolvedValue({ error: null });
  });
  it.each(actions)("denies signed-out callers before records or privileged mutation", async action => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await action()).status).toBe(401);
    expect(mock.record).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.createUser).not.toHaveBeenCalled();
  });
  it.each(["student", "teacher", "inactive-admin"])("denies %s despite forged or stale admin metadata", async role => {
    mock.profile.mockResolvedValue({ data: { role: role === "inactive-admin" ? "admin" : role, is_active: role !== "inactive-admin" }, error: null });
    for (const action of actions) expect((await action()).status).toBe(403);
    expect(mock.record).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("fails closed when canonical role lookup fails", async () => {
    mock.profile.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    for (const action of actions) expect((await action()).status).toBe(403);
    expect(mock.record).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.createUser).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutation requests before authentication", async () => {
    expect((await PATCH(request("PATCH", { status: "new" }, "https://attacker.example"), context())).status).toBe(403);
    expect((await activity(request("POST", { kind: "note", note: "Unauthorized" }, "https://attacker.example"), context())).status).toBe(403);
    expect((await admit(request("POST", {}, "https://attacker.example"))).status).toBe(403);
    expect(mock.getUser).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each([{ status: "converted" }, { student_id: id }, { actor_id: id }, { assigned_to: "not-a-uuid" }, {}])("rejects unauthorized enquiry fields %j", async payload => {
    expect((await PATCH(request("PATCH", payload), context())).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { kind: "note", note: "Note", actor_id: id },
    { kind: "contact", note: "Contact", metadata: { actor_id: id } },
    { kind: "follow_up", note: "Schedule", due_at: 123 },
    { kind: "follow_up", note: "Schedule", due_at: "2026-11-09T12:00:00" },
    { kind: "note", note: "Note", follow_up_id: id, outcome: "Done" },
    { kind: "follow_up", note: "Outcome", outcome: "Done" },
  ])("rejects forged or ambiguous activity fields %j", async payload => {
    expect((await activity(request("POST", payload), context())).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("delegates authorized staff assignment to the guarded transactional RPC", async () => {
    const response = await PATCH(request("PATCH", { status: "interested", assigned_to: id }), context());
    expect(response.status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("update_admission_enquiry", { p_id: id, p_changes: { status: "interested", assigned_to: id } });
  });
  it("reports assignment or conversion races as failure without claiming success", async () => {
    mock.rpc.mockResolvedValue({ error: { message: "private transaction diagnostic" } });
    const response = await PATCH(request("PATCH", { status: "interested" }), context());
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty("success");
  });
});

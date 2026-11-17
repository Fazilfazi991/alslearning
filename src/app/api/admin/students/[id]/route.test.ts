import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/admin-session", () => ({ adminSession: async () => ({ db: {
  rpc: mocks.rpc,
  from: () => {
    const chain = { select: () => chain, eq: () => chain, single: mocks.single, update: mocks.update };
    mocks.update.mockReturnValue(chain);
    return chain;
  },
} }) }));
vi.mock("@/lib/request-origin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: vi.fn() }));
import { PATCH } from "./route";

const id = "e9e32ed8-f751-4a5c-86c6-cc3dc5f61f74";
const context = { params: Promise.resolve({ id }) } as never;
const request = (body: object) => new Request("https://staging.invalid/api/admin/students/example", {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.single.mockResolvedValue({ data: { id, is_active: true }, error: null });
  mocks.rpc.mockResolvedValue({ data: { id }, error: null });
});

describe("Student status changes", () => {
  it("coordinates status and allowed details in one RPC", async () => {
    const response = await PATCH(request({ is_active: false, full_name: "Synthetic Student" }), context);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_update_managed_profile", {
      target: id, expected_role: "student", desired: false, changes: { full_name: "Synthetic Student" },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("fails closed if the coordinated status operation fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await PATCH(request({ is_active: false }), context)).status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("reports an uncertain transport outcome without claiming no change", async () => {
    mocks.rpc.mockRejectedValue(new Error("private network detail"));
    const response = await PATCH(request({ is_active: false }), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.stringContaining("could not be confirmed") });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const state = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), sameOrigin: vi.fn() }));
vi.mock("@/lib/admin-session", () => ({ adminSession: state.admin }));
vi.mock("@/lib/request-origin", () => ({ isSameOriginRequest: state.sameOrigin }));
import { GET, POST } from "./route";
const id = "7b91965a-475b-4a0f-8ac6-09dbf0c7c201", batch = "0a4ad621-5125-498b-bdeb-d22bbffed94e", student = "6157d48f-a180-4a50-8cf1-33221065510e";
const context = { params: Promise.resolve({ id }) };
const req = (body: unknown) => new Request(`https://als.example/api/admin/registrations/${id}/link-existing`, { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); state.sameOrigin.mockReturnValue(true); state.admin.mockResolvedValue({ db: { rpc: state.rpc } }); });
describe("existing student approval", () => {
  it("requires an authenticated administrator for proof status and approval", async () => {
    state.admin.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await GET(new Request("https://als.example"), context)).status).toBe(403);
    expect((await POST(req({ batch_id: batch }), context)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and unrecognized identity input", async () => {
    state.sameOrigin.mockReturnValueOnce(false);
    expect((await POST(req({ batch_id: batch }), context)).status).toBe(403);
    expect((await POST(req({ batch_id: batch, student_id: student }), context)).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("queries advisory readiness but never trusts it for approval", async () => {
    state.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: { linked_existing: true, student_id: student }, error: null });
    expect(await (await GET(new Request("https://als.example"), context)).json()).toEqual({ ready: true });
    const response = await POST(req({ batch_id: batch }), context);
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenLastCalledWith("approve_existing_registration", { p_registration_id: id, p_batch_id: batch });
    expect(await response.json()).toEqual({ success: true, student_id: student, linked_existing: true });
  });
  it("fails closed when the atomic transaction rejects expired proof or a full batch", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "not eligible" } });
    expect((await POST(req({ batch_id: batch }), context)).status).toBe(409);
  });
});

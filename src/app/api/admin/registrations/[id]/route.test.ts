import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const state = vi.hoisted(() => ({ authorized: false, rpc: vi.fn(), sameOrigin: true }));
vi.mock("@/lib/admin-session", () => ({ adminSession: async () => state.authorized ? { db: { rpc: state.rpc } } : { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) } }));
vi.mock("@/lib/request-origin", () => ({ isSameOriginRequest: () => state.sameOrigin }));
import { PATCH } from "./route";

const id = "e9661772-95ad-49d8-90c7-f4030bf0dccf";
const context = { params: Promise.resolve({ id }) };
const req = (body: unknown) => new Request(`https://example.test/api/admin/registrations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { state.authorized = false; state.sameOrigin = true; state.rpc.mockReset(); state.rpc.mockResolvedValue({ error: null }); });

it("rejects unauthenticated review without calling the database", async () => {
  const result = await PATCH(req({ action: "rejected", changes: { reason: "Not eligible" } }), context);
  expect(result.status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("rejects cross-origin or unsupported review actions", async () => {
  state.authorized = true; state.sameOrigin = false;
  expect((await PATCH(req({ action: "rejected", changes: { reason: "Not eligible" } }), context)).status).toBe(403);
  state.sameOrigin = true;
  expect((await PATCH(req({ action: "approved", changes: { reason: "test" } }), context)).status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("delegates a review to the admin-checked transaction", async () => {
  state.authorized = true;
  const result = await PATCH(req({ action: "needs_information", changes: { reason: "Please clarify qualification." } }), context);
  expect(result.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("review_student_registration", { p_id: id, p_action: "needs_information", p_changes: { reason: "Please clarify qualification." } });
});
it("does not report success when the review transaction fails", async () => {
  state.authorized = true; state.rpc.mockResolvedValue({ error: { message: "conflict" } });
  const result = await PATCH(req({ action: "rejected", changes: { reason: "Not eligible" } }), context);
  expect(result.status).toBe(409);
});

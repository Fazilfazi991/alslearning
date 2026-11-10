import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ admin: vi.fn(), invite: vi.fn() }));
vi.mock("@/lib/admin-session", () => ({ adminSession: state.admin }));
vi.mock("@/lib/request-origin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/registration-invitation", () => ({ sendRegistrationInvitation: state.invite }));
import { POST } from "./route";
const id = "7b91965a-475b-4a0f-8ac6-09dbf0c7c201";
beforeEach(() => { vi.clearAllMocks(); });
it("never resets or invites a linked existing student", async () => {
  const record = { status: "approved", student_id: "existing", email: "existing@example.test", invitation_status: "not_required" };
  state.admin.mockResolvedValue({ db: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: record, error: null }) }) }) }) } });
  const response = await POST(new Request("https://als.example", { method: "POST" }), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(409);
  expect(state.invite).not.toHaveBeenCalled();
});

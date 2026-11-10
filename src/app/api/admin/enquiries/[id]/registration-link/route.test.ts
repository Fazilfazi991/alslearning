import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
const adminSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-session", () => ({ adminSession }));
import { POST } from "./route";
const id = "b3548351-7268-4d05-87f8-f5804d333b5d";
const context = { params: Promise.resolve({ id }) };
const request = (origin = "https://als.example") => new Request("https://als.example/api/admin/enquiries/id/registration-link", { method: "POST", headers: { host: "als.example", origin } });
beforeEach(() => { rpc.mockReset(); adminSession.mockReset(); });
it("requires an administrator and rejects cross-origin requests", async () => {
  expect((await POST(request("https://other.example"), context)).status).toBe(403);
  adminSession.mockResolvedValue({ response: Response.json({ error: "Sign in" }, { status: 401 }) });
  expect((await POST(request(), context)).status).toBe(401); expect(rpc).not.toHaveBeenCalled();
});
it("stores only the token hash and returns an opaque expiring token to the admin", async () => {
  adminSession.mockResolvedValue({ db: { rpc } }); rpc.mockResolvedValue({ error: null });
  const response = await POST(request(), context); const body = await response.json();
  expect(response.status).toBe(200); expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(rpc.mock.calls[0][0]).toBe("create_registration_link");
  expect(rpc.mock.calls[0][1].p_token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(rpc.mock.calls[0][1].p_token_hash).not.toBe(body.token);
  expect(rpc.mock.calls[0][1].p_enquiry_id).toBe(id);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

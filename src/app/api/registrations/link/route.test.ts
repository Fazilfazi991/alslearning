import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/enquiries-server", () => ({ enquiryService: () => ({ rpc }) }));
import { POST } from "./route";
const token = "A".repeat(43);
const request = (body: unknown, origin = "https://als.example") => new Request("https://als.example/api/registrations/link", { method: "POST", headers: { host: "als.example", origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { rpc.mockReset(); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret"); vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", ""); });
it("rejects cross-origin, malformed and oversized requests", async () => {
  expect((await POST(request({ token }, "https://elsewhere.example"))).status).toBe(403);
  expect((await POST(request({ token: "short" }))).status).toBe(400);
  expect((await POST(request({ token, other: "x".repeat(300) }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it("passes hashed token and rate identity to the service-only RPC and returns only allowed fields", async () => {
  rpc.mockResolvedValue({ data: { full_name: "Test", email: "student@example.test", phone: "+919876543210", program_id: "course", private_note: "secret" }, error: null });
  const response = await POST(request({ token }));
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ fullName: "Test", email: "student@example.test", phone: "+919876543210", programId: "course" });
  expect(rpc.mock.calls[0][1].p_token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(rpc.mock.calls[0][1].p_token_hash).not.toBe(token);
  expect(rpc.mock.calls[0][1].p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
});
it("does not expose whether a link was expired or already used", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect((await POST(request({ token }))).status).toBe(404);
});

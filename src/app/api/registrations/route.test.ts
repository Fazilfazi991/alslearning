import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/enquiries-server", () => ({ enquiryService: () => ({ rpc }) }));
import { POST } from "./route";
const body = { fullName: "Test Student", email: "student@example.test", phone: "+919876543210", qualification: "BSc MLT", institution: "Test College", programId: "b3548351-7268-4d05-87f8-f5804d333b5d", preferredBatchId: null, notes: "", consent: true, requestId: "30435434-6d02-43bc-a93e-4c1b638af675", website: "" };
function request(value: unknown, origin = "https://als.example") { return new Request("https://als.example/api/registrations", { method: "POST", headers: { "content-type": "application/json", origin, host: "als.example" }, body: JSON.stringify(value) }); }
describe("registration endpoint", () => {
  beforeEach(() => { rpc.mockReset(); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-secret"); vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", ""); });
  it("rejects invalid, cross-origin, honeypot and oversized submissions before calling storage", async () => {
    expect((await POST(request(body, "https://elsewhere.example"))).status).toBe(403);
    expect((await POST(request({ ...body, consent: false }))).status).toBe(400);
    expect((await POST(request({ ...body, website: "spam" }))).status).toBe(400);
    expect((await POST(request({ ...body, notes: "x".repeat(13000) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("submits only through the service RPC with hashed rate identifiers and generic response", async () => {
    rpc.mockResolvedValue({ data: { duplicate: true }, error: null });
    const response = await POST(request(body));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true });
    expect(rpc.mock.calls[0][0]).toBe("submit_student_registration");
    expect(rpc.mock.calls[0][1].p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rpc.mock.calls[0][1].p_phone_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(rpc.mock.calls[0][1].p_email_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("Set-Cookie")).toContain("Path=/api/registrations; HttpOnly; SameSite=Lax; Secure");
  });
  it("fails closed on database errors and reports rate limiting", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "unavailable" } }).mockResolvedValueOnce({ error: { message: "rate_limit" } });
    expect((await POST(request(body))).status).toBe(503);
    const limited = await POST(request(body)); expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBe("3600");
  });
  it("retains the signed anonymous rate identity across retries", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    const first = await POST(request(body)); const retry = request(body);
    retry.headers.set("cookie", first.headers.get("Set-Cookie")!.split(";")[0]);
    await POST(retry); expect(rpc.mock.calls[0][1].p_ip_hash).toBe(rpc.mock.calls[1][1].p_ip_hash);
  });
});

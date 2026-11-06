import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/enquiries-server", () => ({ enquiryService: () => ({ rpc }), getPublicEnquiryPrograms: vi.fn().mockResolvedValue([{ id: "a", name: "Program" }]) }));
import { POST } from "./route";
const body = { fullName: "Student Name", phone: "+919876543210", programId: "b3548351-7268-4d05-87f8-f5804d333b5d", consent: true, idempotencyKey: "30435434-6d02-43bc-a93e-4c1b638af675", website: "" };
function request(value: unknown, origin = "https://als.example") { return new Request("https://als.example/api/enquiries", { method: "POST", headers: { "Content-Type": "application/json", origin, host: "als.example", "cf-connecting-ip": "192.0.2.1" }, body: JSON.stringify(value) }); }
describe("public enquiry endpoint", () => {
  beforeEach(() => { rpc.mockReset(); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-secret-test-only"); vi.stubEnv("ENQUIRY_TRUSTED_IP_HEADER", ""); });
  it("rejects cross-origin submissions before touching database", async () => { expect((await POST(request(body, "https://other.example"))).status).toBe(403); expect(rpc).not.toHaveBeenCalled(); });
  it("rejects missing consent and malformed program", async () => { expect((await POST(request({ ...body, consent: false, programId: "bad" }))).status).toBe(400); expect(rpc).not.toHaveBeenCalled(); });
  it("does not report fake success for honeypot submissions", async () => { expect((await POST(request({ ...body, website: "spam.example" }))).status).toBe(400); expect(rpc).not.toHaveBeenCalled(); });
  it("sends only hashed network and phone rate identifiers", async () => {
    rpc.mockResolvedValue({ data: { duplicate: false }, error: null }); const response = await POST(request(body)); expect(response.status).toBe(201);
    expect(rpc.mock.calls[0][1].p_ip_hash).toMatch(/^[a-f0-9]{64}$/); expect(rpc.mock.calls[0][1].p_phone_hash).toMatch(/^[a-f0-9]{64}$/); expect(await response.json()).toEqual({ success: true });
  });
  it("returns successful idempotent repeat without exposing lead identity", async () => { rpc.mockResolvedValue({ data: { duplicate: true }, error: null }); const response = await POST(request(body)); expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true }); });
  it("returns persistent rate-limit failures and retry advice", async () => { rpc.mockResolvedValue({ data: null, error: { message: "rate_limit" } }); const response = await POST(request(body)); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("3600"); });
  it("never reports success when persistence fails", async () => { rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } }); expect((await POST(request(body))).status).toBe(503); });
  it("ignores caller supplied IP headers unless the trusted proxy is configured", async () => {
    rpc.mockResolvedValue({ data: { duplicate: false }, error: null });
    const first = await POST(request(body)); const other = request(body); other.headers.set("cf-connecting-ip", "198.51.100.2"); other.headers.set("cookie", first.headers.get("Set-Cookie")!.split(";")[0]); await POST(other);
    expect(rpc.mock.calls[0][1].p_ip_hash).toBe(rpc.mock.calls[1][1].p_ip_hash);
  });
  it("issues independent signed browser identities without a global default bucket", async () => {
    rpc.mockResolvedValue({ data: { duplicate: false }, error: null });
    const first = await POST(request(body)); const second = await POST(request(body));
    expect(rpc.mock.calls[0][1].p_ip_hash).not.toBe(rpc.mock.calls[1][1].p_ip_hash);
    expect(first.headers.get("Set-Cookie")).toContain("HttpOnly; SameSite=Lax; Secure");
    expect(second.headers.get("Set-Cookie")).toContain("Max-Age=2592000");
  });
  it("persists the anonymous identity on throttled responses", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "rate_limit" } });
    expect((await POST(request(body))).headers.get("Set-Cookie")).toContain("als_enquiry_browser=");
  });
  it("rejects oversized bodies without relying on a caller supplied length header", async () => {
    expect((await POST(request({ ...body, message: "x".repeat(13000) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
});

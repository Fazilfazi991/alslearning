import { beforeEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-session", () => ({ adminSession: session }));
import { GET as list } from "./route";
import { GET as detail, PATCH } from "./[id]/route";
import { POST as activity } from "./[id]/activities/route";
const context = { params: Promise.resolve({ id: "30435434-6d02-43bc-a93e-4c1b638af675" }) };
function request(method: string, origin = "https://als.example") { return new Request("https://als.example/api/admin/enquiries", { method, headers: { host: "als.example", origin, "Content-Type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify({ status: "interested" }) } : {}) }); }
describe("enquiry API authorization", () => {
  beforeEach(() => session.mockReset());
  for (const status of [401, 403]) it(`denies all management operations for ${status}`, async () => {
    session.mockImplementation(async () => ({ response: Response.json({ error: "Access denied" }, { status }) }));
    const responses = await Promise.all([list(request("GET")), detail(request("GET"), context), PATCH(request("PATCH"), context), activity(request("POST"), context)]);
    expect(responses.map(r => r.status)).toEqual([status, status, status, status]);
  });
  it("rejects cross-origin changes before session or database access", async () => {
    expect((await PATCH(request("PATCH", "https://other.example"), context)).status).toBe(403);
    expect((await activity(request("POST", "https://other.example"), context)).status).toBe(403);
    expect(session).not.toHaveBeenCalled();
  });
});

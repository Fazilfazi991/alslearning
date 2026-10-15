import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mock.getUser },
  from: () => ({ select: () => ({ eq: () => ({ single: mock.single }) }) }),
}) }));
import { GET } from "./route";

describe("protected navigation session revalidation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.getUser.mockResolvedValue({ data: { user: { id: "student-id", email: "private@example.test" } }, error: null });
    mock.single.mockResolvedValue({ data: { id: "student-id", role: "student", is_active: true }, error: null });
  });
  it("returns only canonical identity and disallows caching", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ id: "student-id", role: "student" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("rejects a logged-out session before reading profiles", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET()).status).toBe(401);
    expect(mock.single).not.toHaveBeenCalled();
  });
  it.each([null, { id: "student-id", role: "student", is_active: false }, { id: "student-id", role: "unsupported", is_active: true }])("rejects missing, deactivated or unsupported accounts", async profile => {
    mock.single.mockResolvedValue({ data: profile, error: null });
    expect((await GET()).status).toBe(403);
  });
  it("fails closed without leaking private provider diagnostics", async () => {
    mock.getUser.mockRejectedValue(new Error("private provider credential"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("credential");
  });
});

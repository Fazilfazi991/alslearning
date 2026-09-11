import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getClaims: vi.fn(), single: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(path); }) }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mock.getClaims }, from: () => ({ select: () => ({ eq: () => ({ single: mock.single }) }) }) }),
}));
import { requireRole } from "./auth";

describe("portal guards", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.redirect.mockImplementation((path: string) => { throw new Error(path); });
    mock.getClaims.mockResolvedValue({ data: { claims: { sub: "student-id" } } });
    mock.single.mockResolvedValue({ data: { id: "student-id", role: "student", is_active: true }, error: null });
  });
  it.each(["admin", "teacher"] as const)("denies a Student the %s portal", async role => {
    await expect(requireRole([role])).rejects.toThrow("/student");
  });
  it("allows the Admin portal only for an active Admin", async () => {
    mock.single.mockResolvedValue({ data: { id: "admin-id", role: "admin", is_active: true }, error: null });
    expect((await requireRole(["admin"])).role).toBe("admin");
  });
  it("redirects a logged-out session to login", async () => {
    mock.getClaims.mockResolvedValue({ data: null });
    await expect(requireRole(["student"])).rejects.toThrow("/login");
  });
  it("denies an inactive account", async () => {
    mock.single.mockResolvedValue({ data: { role: "admin", is_active: false }, error: null });
    await expect(requireRole(["admin"])).rejects.toThrow("/login");
  });
});

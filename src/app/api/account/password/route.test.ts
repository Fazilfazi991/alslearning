import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), single: vi.fn(), signInWithPassword: vi.fn(), updateUser: vi.fn(), temporarySignOut: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mock.getUser, signOut: mock.signOut }, from: () => ({ select: () => ({ eq: () => ({ single: mock.single }) }) }) }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signInWithPassword: mock.signInWithPassword, updateUser: mock.updateUser, signOut: mock.temporarySignOut } }) }));
vi.mock("@/lib/supabase/config", () => ({ supabaseConfig: () => ({ url: "https://example.supabase.co", key: "test-public-key" }) }));
import { POST } from "./route";
const body = { current_password: "Old!Password12", password: "New!Password34" };
const request = (value: unknown = body, origin = "https://alslearning.vercel.app") => new Request("https://localhost:3000/api/account/password", { method: "POST", headers: { origin, host: "alslearning.vercel.app", "content-type": "application/json" }, body: JSON.stringify(value) });
describe("self-service password changes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.getUser.mockResolvedValue({ data: { user: { id: "student-id", email: "student@example.test" } }, error: null });
    mock.single.mockResolvedValue({ data: { is_active: true }, error: null });
    mock.signInWithPassword.mockResolvedValue({ data: { user: { id: "student-id" } }, error: null });
    mock.updateUser.mockResolvedValue({ error: null });
  });
  it("verifies the current identity before changing password and revokes sessions", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, redirect: "/login" });
    expect(mock.signInWithPassword).toHaveBeenCalledWith({ email: "student@example.test", password: body.current_password });
    expect(mock.updateUser).toHaveBeenCalledWith({ password: body.password });
    expect(mock.temporarySignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("rejects a cross-origin request before authentication", async () => {
    expect((await POST(request(body, "https://evil.example"))).status).toBe(403);
    expect(mock.getUser).not.toHaveBeenCalled();
  });
  it("rejects an expired session", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mock.signInWithPassword).not.toHaveBeenCalled();
  });
  it.each([null, { is_active: false }])("rejects missing or deactivated profiles", async profile => {
    mock.single.mockResolvedValue({ data: profile, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mock.signInWithPassword).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...body, password: "weak" }, { ...body, password: body.current_password }])("rejects invalid or unchanged passwords", async value => {
    expect((await POST(request(value))).status).toBe(400);
    expect(mock.updateUser).not.toHaveBeenCalled();
  });
  it.each([{ data: { user: null }, error: { message: "private auth detail" } }, { data: { user: { id: "other-user" } }, error: null }])("rejects a wrong password or identity mismatch", async signed => {
    mock.signInWithPassword.mockResolvedValue(signed);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "The current password is incorrect." });
    expect(mock.updateUser).not.toHaveBeenCalled();
    expect(mock.temporarySignOut).toHaveBeenCalled();
  });
  it("does not show success when the provider rejects the update", async () => {
    mock.updateUser.mockResolvedValue({ error: { message: "private provider diagnostic" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private provider");
    expect(mock.signOut).not.toHaveBeenCalled();
    expect(mock.temporarySignOut).toHaveBeenCalled();
  });
});

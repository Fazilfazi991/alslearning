import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signOut: vi.fn(), single: vi.fn(), eq: vi.fn(),
  signUp: vi.fn(), signInWithOtp: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: mock,
    from: () => ({ select: () => ({ eq: mock.eq }) }),
  }),
}));
import { POST } from "./route";

const request = (body: unknown, origin = "https://alslearning.vercel.app") => new Request("https://alslearning.vercel.app/api/auth/password", {
  method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
});
const credentials = { email: "person@example.test", password: "test-password-only" };

describe("password login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.eq.mockReturnValue({ single: mock.single });
    mock.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-id", app_metadata: { role: "admin" } } }, error: null });
    mock.single.mockResolvedValue({ data: { role: "student", is_active: true }, error: null });
  });
  it.each(["admin", "student", "teacher"])("routes an active %s by canonical profile, ignoring supplied portal and token role", async role => {
    mock.single.mockResolvedValue({ data: { role, is_active: true }, error: null });
    const response = await POST(request({ ...credentials, email: " person@example.test ", expectedRole: "admin" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirect: `/${role}` });
    expect(mock.signInWithPassword).toHaveBeenCalledWith(credentials);
    expect(mock.eq).toHaveBeenCalledWith("id", "user-id");
    expect(mock.signUp).not.toHaveBeenCalled();
    expect(mock.signInWithOtp).not.toHaveBeenCalled();
  });
  it.each(["wrong password", "unknown email"])("does not disclose accounts or create users for %s", async diagnostic => {
    mock.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: diagnostic } });
    const response = await POST(request(credentials));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Incorrect email or password." });
    expect(mock.single).not.toHaveBeenCalled();
    expect(mock.signUp).not.toHaveBeenCalled();
    expect(mock.signInWithOtp).not.toHaveBeenCalled();
  });
  it.each([null, { role: "admin", is_active: false }, { role: "unsupported", is_active: true }])("clears the new local session when profile is missing, inactive or unsupported", async profile => {
    mock.single.mockResolvedValue({ data: profile, error: null });
    expect((await POST(request(credentials))).status).toBe(401);
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("fails closed on a profile query error", async () => {
    mock.single.mockResolvedValue({ data: null, error: { message: "private DB detail" } });
    expect((await POST(request(credentials))).status).toBe(401);
    expect(mock.signOut).toHaveBeenCalled();
  });
  it.each([null, {}, { email: 12, password: "x" }, { email: "  ", password: "x" }, { email: "x", password: "" }])("validates malformed credentials", async value => {
    expect((await POST(request(value))).status).toBe(400);
    expect(mock.signInWithPassword).not.toHaveBeenCalled();
  });
  it("rejects cross-origin login requests", async () => {
    expect((await POST(request(credentials, "https://evil.example"))).status).toBe(403);
    expect(mock.signInWithPassword).not.toHaveBeenCalled();
  });
  it("hides connection diagnostics", async () => {
    mock.signInWithPassword.mockRejectedValue(new Error("private diagnostic"));
    const response = await POST(request(credentials));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Could not sign in. Please try again." });
  });
});

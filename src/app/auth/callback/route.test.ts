import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
import { GET } from "./route";

describe("email sign-in callback", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("exchanges a PKCE code and routes through the existing role guard", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(new Request("https://alslearning.vercel.app/auth/callback?code=valid&next=https://evil.example"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("valid", undefined);
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/student");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
  it("passes the flow identifier to select the matching browser verifier", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    await GET(new Request("https://alslearning.vercel.app/auth/callback?code=valid&sb_flow_id=flow"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("valid", { flowId: "flow" });
  });
  it.each(["expired", "missing verifier"])("fails closed for %s", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid") });
    const response = await GET(new Request("https://alslearning.vercel.app/auth/callback?code=invalid"));
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/login?error=invalid-link");
  });
  it("handles network failure without exposing auth details", async () => {
    auth.exchangeCodeForSession.mockRejectedValue(new Error("private diagnostic"));
    expect((await GET(new Request("https://alslearning.vercel.app/auth/callback?code=valid"))).headers.get("location")).toBe("https://alslearning.vercel.app/login?error=invalid-link");
  });
  it.each(["magiclink", "email"])("preserves supported %s token-hash callbacks", async type => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const response = await GET(new Request(`https://alslearning.vercel.app/auth/callback?token_hash=hash&type=${type}`));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type });
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/student");
  });
  it.each(["", "?token_hash=hash&type=recovery", "?error=access_denied&code=valid"])("rejects missing, unsupported, or provider-error callbacks: %s", async query => {
    const response = await GET(new Request(`https://alslearning.vercel.app/auth/callback${query}`));
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/login?error=invalid-link");
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});

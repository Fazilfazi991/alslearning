import { afterEach, describe, expect, it, vi } from "vitest";
const exchange = vi.hoisted(() => vi.fn());
const registration = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: exchange }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: registration }) }) }) }) }) }));
import { GET } from "./route";
import { makeRegistrationRecoveryGrant } from "@/lib/registration-setup-grant";
afterEach(() => { vi.unstubAllEnvs(); exchange.mockReset(); registration.mockReset(); });

describe("retired email callback", () => {
  it.each(["?code=old", "?token_hash=old&type=magiclink", "?token_hash=old&type=email", "?next=https://evil.example", ""])("routes old links to password login without establishing a session: %s", async query => {
    const response = await GET(new Request(`https://alslearning.vercel.app/auth/callback${query}`));
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/login");
    expect(exchange).not.toHaveBeenCalled();
  });
});

describe("approved student invite", () => {
  it("redeems only an invitation token and issues a secure setup grant", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    registration.mockResolvedValue({data:{id:"registration"},error:null});
    const verifyOtp=vi.fn().mockResolvedValue({data:{user:{id:"student"}},error:null});
    exchange.mockResolvedValue({auth:{verifyOtp,getClaims:vi.fn().mockResolvedValue({data:{claims:{session_id:"session"}},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:"student",is_active:true},error:null})})})})});
    const response=await GET(new Request("https://alslearning.vercel.app/auth/callback?token_hash=one-time&type=invite"));
    expect(verifyOtp).toHaveBeenCalledWith({token_hash:"one-time",type:"invite"});
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/auth/setup");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
  it("accepts recovery only with an admin-signed grant for the approved student", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    vi.stubEnv("REGISTRATION_RECOVERY_ENABLED", "true");
    registration.mockResolvedValue({data:{id:"registration"},error:null});
    const verifyOtp=vi.fn().mockResolvedValue({data:{user:{id:"student"}},error:null});
    exchange.mockResolvedValue({auth:{verifyOtp,getClaims:vi.fn().mockResolvedValue({data:{claims:{session_id:"session"}},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:"student",is_active:true},error:null})})})})});
    const grant=makeRegistrationRecoveryGrant("registration","student");
    const response=await GET(new Request(`https://alslearning.vercel.app/auth/callback?token_hash=one-time&type=recovery&registration_recovery=${encodeURIComponent(grant)}`));
    expect(verifyOtp).toHaveBeenCalledWith({token_hash:"one-time",type:"recovery"});
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/auth/setup");
  });
  it("rejects a public recovery link without an admin grant before redeeming the token", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    vi.stubEnv("REGISTRATION_RECOVERY_ENABLED", "true");
    const response=await GET(new Request("https://alslearning.vercel.app/auth/callback?token_hash=one-time&type=recovery"));
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
    expect(exchange).not.toHaveBeenCalled();
  });
  it("rejects signed recovery for a different approved identity", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    vi.stubEnv("REGISTRATION_RECOVERY_ENABLED", "true");
    registration.mockResolvedValue({data:{id:"registration"},error:null});
    const signOut=vi.fn().mockResolvedValue({error:null});
    exchange.mockResolvedValue({auth:{verifyOtp:vi.fn().mockResolvedValue({data:{user:{id:"student"}},error:null}),signOut}});
    const grant=makeRegistrationRecoveryGrant("registration","another-user");
    const response=await GET(new Request(`https://alslearning.vercel.app/auth/callback?token_hash=one-time&type=recovery&registration_recovery=${encodeURIComponent(grant)}`));
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
    expect(signOut).toHaveBeenCalledWith({scope:"local"});
  });
  it("does not redeem the token if setup is unconfigured", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "");
    const response=await GET(new Request("https://alslearning.vercel.app/auth/callback?token_hash=one-time&type=invite"));
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
    expect(exchange).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
const gate = vi.hoisted(() => ({ available: true }));
vi.mock("@/lib/registration-setup-availability", () => ({ get registrationPasswordSetupAvailable() { return gate.available; } }));
const exchange = vi.hoisted(() => vi.fn());
const registration = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/buffered-auth", () => ({ createBufferedAuthClient: async () => ({ db: await exchange(), publish: () => {} }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => ({ from: () => { const query = { select: () => query, eq: () => query, limit: () => query, maybeSingle: registration }; return query; } }) }));
import { GET, POST } from "./route";
function submit(query: string) { const params = new URLSearchParams(query); return POST(new Request("https://alslearning.vercel.app/auth/callback", { method: "POST", headers: { origin: "https://alslearning.vercel.app", "content-type": "application/x-www-form-urlencoded" }, body: params })); }
import { makeRegistrationRecoveryGrant } from "@/lib/registration-setup-grant";
afterEach(() => { gate.available = true; vi.restoreAllMocks(); vi.unstubAllEnvs(); exchange.mockReset(); registration.mockReset(); });

describe("retired email callback", () => {
  it.each(["?code=old", "?token_hash=old&type=magiclink", "?token_hash=old&type=email", "?next=https://evil.example", ""])("routes old links to password login without establishing a session: %s", async query => {
    const response = await GET(new Request(`https://alslearning.vercel.app/auth/callback${query}`));
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/login");
    expect(exchange).not.toHaveBeenCalled();
  });
});

describe("approved student invite", () => {
  it("does not consume a token while setup is unavailable", async () => {
    gate.available = false;
    expect((await GET(new Request("https://alslearning.vercel.app/auth/callback?token_hash=one-time&type=invite"))).status).toBe(503);
    expect((await submit("token_hash=one-time&type=invite")).status).toBe(503);
    expect(exchange).not.toHaveBeenCalled();
  });
  it("does not redeem the token when a scanner follows the link", async () => {
    const response = await GET(new Request("https://alslearning.vercel.app/auth/callback?token_hash=one-time&type=invite"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Continue to account setup");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(exchange).not.toHaveBeenCalled();
  });
  it("rejects cross-origin submissions before token verification", async () => {
    const response = await POST(new Request("https://alslearning.vercel.app/auth/callback", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" }, body: "token_hash=one-time&type=invite" }));
    expect(response.status).toBe(303);
    expect(exchange).not.toHaveBeenCalled();
  });
  it("redeems only an invitation token and issues a secure setup grant", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    registration.mockResolvedValue({data:{id:"registration"},error:null});
    const verifyOtp=vi.fn().mockResolvedValue({data:{user:{id:"student"}},error:null});
    exchange.mockResolvedValue({auth:{verifyOtp,getClaims:vi.fn().mockResolvedValue({data:{claims:{session_id:"session"}},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role:"student",is_active:true},error:null})})})})});
    const response=await submit("token_hash=one-time&type=invite");
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
    const response=await submit(`token_hash=one-time&type=recovery&registration_recovery=${encodeURIComponent(grant)}`);
    expect(verifyOtp).toHaveBeenCalledWith({token_hash:"one-time",type:"recovery"});
    expect(response.headers.get("location")).toBe("https://alslearning.vercel.app/auth/setup");
  });
  it("rejects a public recovery link without an admin grant before redeeming the token", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    vi.stubEnv("REGISTRATION_RECOVERY_ENABLED", "true");
    const response=await submit("token_hash=one-time&type=recovery");
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
    const response=await submit(`token_hash=one-time&type=recovery&registration_recovery=${encodeURIComponent(grant)}`);
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
    expect(signOut).toHaveBeenCalledWith({scope:"local"});
  });
  it("signs out the verified session when claims cannot be obtained", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    registration.mockResolvedValue({ data: { id: "registration" }, error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    exchange.mockResolvedValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: "student" } }, error: null }), getClaims: vi.fn().mockResolvedValue({ data: null, error: {} }), signOut } });
    const response = await submit("token_hash=one-time&type=invite");
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it.each(["returned", "thrown"])("records uncertain revocation for %s errors without disclosing credentials", async mode => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "a-secret-long-enough-for-test-only-0001");
    registration.mockResolvedValue({ data: null, error: null });
    const signOut = mode === "returned" ? vi.fn().mockResolvedValue({ error: { message: "private detail" } }) : vi.fn().mockRejectedValue(new Error("private detail"));
    exchange.mockResolvedValue({ auth: { verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: "student" } }, error: null }), signOut } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await submit("token_hash=one-time&type=invite");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(log).toHaveBeenCalledOnce();
    const event = JSON.parse(String(log.mock.calls[0][0]));
    expect(event.event).toBe("registration_session_revocation_uncertain");
    expect(event.user_id).toBe("student");
    expect(JSON.stringify(event)).not.toMatch(/one-time|private detail/);
  });
  it("does not redeem the token if setup is unconfigured", async () => {
    vi.stubEnv("REGISTRATION_SETUP_SECRET", "");
    const response=await submit("token_hash=one-time&type=invite");
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
    expect(exchange).not.toHaveBeenCalled();
  });
});

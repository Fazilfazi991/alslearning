// Child process fixture for a deliberate local crash after the real route claims.
import { createHmac, randomBytes } from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { describe, it, vi } from "vitest";
const userId="10000000-0000-4000-8000-000000000011", sessionId="20000000-0000-4000-8000-000000000011";
const state=vi.hoisted(() => ({ client: null as unknown, service: null as unknown }));
vi.mock("@/lib/registration-setup-availability", () => ({ registrationPasswordSetupAvailable: true }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: process.env.ALS_TEST_GRANT }), delete: () => {} }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => state.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAuthAdminClient: () => state.service }));
import { POST } from "./route";
function client(role: string) {
  const encode=(x: unknown)=>Buffer.from(JSON.stringify(x)).toString("base64url");
  const payload=`${encode({alg:"HS256",typ:"JWT"})}.${encode({role,sub:userId,session_id:sessionId,exp:4102444800})}`;
  const token=`${payload}.${createHmac("sha256",process.env.ALS_REGISTRATION_RACE_JWT_SECRET!).update(payload).digest("base64url")}`;
  return createSupabase(process.env.ALS_REGISTRATION_RACE_API!,"synthetic-public-key",{global:{headers:{Authorization:`Bearer ${token}`},fetch:(url,init)=>fetch(String(url).replace("/rest/v1/","/"),init)},auth:{persistSession:false,autoRefreshToken:false}});
}
describe.skipIf(process.env.ALS_REGISTRATION_CRASH_WORKER !== "1")("deliberate crash fixture", () => {
  it("holds after committed claim at Auth dispatch", async () => {
    const user=client("authenticated"), service=client("service_role");
    vi.spyOn(user.auth,"getUser").mockResolvedValue({data:{user:{id:userId}},error:null} as never);
    vi.spyOn(user.auth,"getClaims").mockResolvedValue({data:{claims:{sub:userId,session_id:sessionId}},error:null} as never);
    vi.spyOn(user.auth,"updateUser").mockImplementation(async () => { console.log("ALS_SYNTHETIC_DISPATCH_ENTERED"); await new Promise(() => {}); return {} as never; });
    state.client=user; state.service=service;
    const req=new Request("http://127.0.0.1:38131/api/auth/setup",{method:"POST",headers:{origin:"http://127.0.0.1:38131",host:"127.0.0.1:38131","content-type":"application/json"},body:JSON.stringify({password:`Aa1!${randomBytes(24).toString("hex")}`})});
    await POST(req);
  }, 120000);
});

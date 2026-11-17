// Opt-in: actual callback/setup routes and local GoTrue + PostgREST. Synthetic only.
import { afterEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
const state = vi.hoisted(() => ({ cookies: new Map<string,string>() }));
vi.mock("@/lib/registration-setup-availability", () => ({ registrationPasswordSetupAvailable: true, localRegistrationAcceptanceEnabled: () => true }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [...state.cookies].map(([name,value])=>({name,value})), get: (name:string) => state.cookies.has(name) ? {value:state.cookies.get(name)} : undefined, set: (name:string,value:string) => state.cookies.set(name,value), delete: (name:string) => state.cookies.delete(name) }) }));
vi.mock("server-only", () => ({}));
import { POST as callback } from "@/app/auth/callback/route";
import { POST as setup } from "@/app/api/auth/setup/route";
import { createClient } from "@/lib/supabase/server";
const enabled = process.env.ALS_REAL_AUTH_ROUTE_QA === "1";
const password = process.env.ALS_TEST_PASSWORD || `Aa1!${randomBytes(24).toString("hex")}`;
it.skipIf(!enabled)("redeems a fresh-device invitation through actual routes and local GoTrue", async () => {
  state.cookies.clear();
  const original = globalThis.fetch;
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
    const url=String(input).replace("http://127.0.0.1:19421/auth/v1/","http://127.0.0.1:19421/").replace("http://127.0.0.1:19421/rest/v1/","http://127.0.0.1:19423/");
    return original(url,init);
  });
  try {
    const form=new URLSearchParams({token_hash:process.env.ALS_TEST_INVITE_HASH!,type:"invite"});
    const response=await callback(new Request("http://127.0.0.1:19422/auth/callback",{method:"POST",headers:{origin:"http://127.0.0.1:19422","content-type":"application/x-www-form-urlencoded"},body:form}));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:19422/auth/setup");
    for(const cookie of (response as NextResponse).cookies.getAll()) state.cookies.set(cookie.name,cookie.value);
    // The verified Auth session is a separate capability. A legitimate active
    // student can change their own password directly, independently of the
    // application grant; this does not test or imply grant replay protection.
    const invitationClient = await createClient();
    const direct = await invitationClient.auth.updateUser({password:`Bb2!${randomBytes(24).toString("hex")}`});
    expect(direct.error).toBeNull();
    const oldAccess = (await invitationClient.auth.getSession()).data.session?.access_token;
    expect(oldAccess).toBeTruthy();
    const done=await setup(new Request("http://127.0.0.1:19422/api/auth/setup",{method:"POST",headers:{origin:"http://127.0.0.1:19422",host:"127.0.0.1:19422","content-type":"application/json"},body:JSON.stringify({password})}));
    expect(done.status).toBe(200);
    const login=await original("http://127.0.0.1:19421/token?grant_type=password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"student@example.test",password})});
    expect(login.status).toBe(200);
    const session=await login.json();
    const db=createSupabase("http://127.0.0.1:19423","synthetic-key",{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${session.access_token}`},fetch:(url,init)=>original(String(url).replace("/rest/v1/","/"),init)}});
    const enrollment=await db.from("enrollments").select("program_id,batch_id,status").eq("student_id",session.user.id).single();
    expect(enrollment.error).toBeNull();
    expect(enrollment.data).toMatchObject({program_id:"b0000000-0000-4000-8000-000000000001",batch_id:"b0000000-0000-4000-8000-000000000002",status:"active"});
    const profile=await db.from("profiles").select("student_code").eq("id",session.user.id).single();
    expect(profile.data?.student_code).toMatch(/^ALS-GOTRUEQA-/);
    // Probe the exact invitation session after setup signed it out. The status
    // is reported without the token; protected DB access must be denied even
    // if the provider still accepts the short-lived access token.
    const oldDb=createSupabase("http://127.0.0.1:19423","synthetic-key",{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${oldAccess}`},fetch:(url,init)=>original(String(url).replace("/rest/v1/","/"),init)}});
    const beforeDirect=await oldDb.from("enrollments").select("id").eq("student_id",session.user.id);
    expect([401,403].includes(beforeDirect.status) || (!beforeDirect.error && beforeDirect.data?.length===0)).toBe(true);
    const oldWrite=await original("http://127.0.0.1:19421/user",{method:"PUT",headers:{Authorization:`Bearer ${oldAccess}`,"content-type":"application/json"},body:JSON.stringify({password})});
    const stale=await oldDb.from("enrollments").select("id").eq("student_id",session.user.id);
    expect([401,403].includes(stale.status) || (!stale.error && stale.data?.length===0)).toBe(true);
    console.log(JSON.stringify({revokedInvitationSessionDirectAuthStatus:oldWrite.status,revokedInvitationSessionDatabaseDenied:true}));
  } finally { vi.unstubAllGlobals(); }
},30000);
afterEach(()=>vi.unstubAllGlobals());

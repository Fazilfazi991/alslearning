import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
export const QA_REF = "xstssknlgdraulebdsfd";
export const ok = (r) => { if (r.error) throw Error(r.error.message); return r.data; };
export function assertQA() {
  assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${QA_REF}.supabase.co`, "QA only; Production forbidden");
  assert.equal(process.env.CORE_QA_PROJECT_REF, QA_REF, "Explicit QA confirmation required");
}
export function anonymous() {
  assertQA();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
}
export async function login(role = "admin") {
  assert.ok(["admin", "student"].includes(role));
  const db = anonymous();
  assert.ok(process.env.TEST_BUILDER_QA_PASSWORD, "Existing QA fixture password required");
  const auth = ok(await db.auth.signInWithPassword({email:`test-builder-20260911-${role}@example.invalid`,password:process.env.TEST_BUILDER_QA_PASSWORD}));
  const profile = ok(await db.from("profiles").select("id,role,is_active").eq("id",auth.user.id).single());
  assert.equal(profile.role, role); assert.equal(profile.is_active,true);
  return {db,user:auth.user,profile};
}
export async function query(sql) {
  assertQA();
  assert.match(sql.trim(), /^select\b/i, "Read-only QA inspection only");
  const response=await fetch(`https://api.supabase.com/v1/projects/${QA_REF}/database/query`, {method:"POST",headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({query:sql})});
  if(!response.ok)throw Error(`QA read query failed: ${response.status} ${await response.text()}`);
  return response.json();
}

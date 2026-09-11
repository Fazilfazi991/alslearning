import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { management, PRODUCTION } from "./helper-grants-lib.mjs";

export async function productionImportClients() {
  assert.equal(process.env.ALS_PRODUCTION_IMPORT_REF, PRODUCTION);
  const email = "fazil4fazi@gmail.com";
  const bootstrap = JSON.parse(readFileSync("docs/production-admin-bootstrap-status.json"));
  assert.equal(bootstrap.project, PRODUCTION);
  assert.equal(bootstrap.email, email);
  for (const subject of ["pathology", "microbiology"]) {
    const manifest = JSON.parse(readFileSync(`docs/${subject}-import-manifest.json`));
    const sources = new Map(manifest.records.filter((r) => r.source_document && r.source_sha256).map((r) => [r.source_document,r.source_sha256]));
    assert.equal(sources.size,subject === "pathology" ? 6 : 7);
    for (const [file,sha] of sources) assert.equal(createHash("sha256").update(readFileSync(`MOQ/${file}`)).digest("hex"),sha,`Source changed: ${file}`);
  }
  const keys = await management(PRODUCTION,"api-keys");
  const url = `https://${PRODUCTION}.supabase.co`;
  const root = createClient(url,keys.find((k)=>k.name === "service_role").api_key,{auth:{persistSession:false,autoRefreshToken:false}});
  const ok = (r) => {if(r.error) throw r.error; return r.data;};
  const user = ok(await root.auth.admin.getUserById(bootstrap.userId)).user;
  assert.equal(user.email,email);
  assert.ok(user.email_confirmed_at,"Admin must accept invitation first");
  assert.equal(user.app_metadata.role,"admin");
  // Same Auth generateLink/verifyOtp login used by the approved QA importer.
  // No user creation, direct auth table writes, or service-role authoring.
  const link = ok(await root.auth.admin.generateLink({type:"magiclink",email}));
  const admin = createClient(url,keys.find((k)=>k.name === "anon").api_key,{auth:{persistSession:false,autoRefreshToken:true}});
  ok(await admin.auth.verifyOtp({token_hash:link.properties.hashed_token,type:"magiclink"}));
  assert.equal(ok(await admin.auth.getUser()).user.id,user.id);
  const profile = ok(await admin.from("profiles").select("id,email,role,is_active").eq("id",user.id).single());
  assert.equal(profile.role,"admin");assert.equal(profile.is_active,true);
  assert.equal(ok(await admin.rpc("is_admin")),true);
  return {admin,fixture:{users:{admin:{id:user.id,email}}},project:PRODUCTION};
}

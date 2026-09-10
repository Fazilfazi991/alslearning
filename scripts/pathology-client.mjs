import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
export const QA_REF = "xstssknlgdraulebdsfd";
export const ok = (result) => {
  if (result.error) throw Error(result.error.message);
  return result.data;
};
export async function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    new URL(url).hostname !== `${QA_REF}.supabase.co` ||
    process.env.CORE_QA_PROJECT_REF !== QA_REF
  )
    throw Error("Explicit approved QA project required");
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${QA_REF}/api-keys`,
    {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    },
  );
  if (!response.ok)
    throw Error(`QA credentials unavailable: ${response.status}`);
  const keys = await response.json();
  const root = createClient(
    url,
    keys.find((k) => k.name === "service_role").api_key,
    { auth: { persistSession: false } },
  );
  const fixture = JSON.parse(readFileSync("core-qa-results.json", "utf8"));
  async function login(label) {
    const email = fixture.users[label]?.email;
    if (!email?.startsWith(fixture.prefix))
      throw Error("Approved synthetic fixture required");
    const link = ok(
      await root.auth.admin.generateLink({ type: "magiclink", email }),
    );
    const db = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    );
    ok(
      await db.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: "magiclink",
      }),
    );
    return db;
  }
  return { root, admin: await login("admin"), fixture, login };
}

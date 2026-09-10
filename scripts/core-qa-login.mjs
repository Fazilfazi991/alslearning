import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const f = JSON.parse(readFileSync(process.argv[3] || "core-qa-results.json", "utf8"));
const label = process.argv[2] || "admin";
const user = f.users[label];
if (!user?.email.startsWith(f.prefix))
  throw Error("Synthetic fixture required");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  ref = new URL(url).hostname.split(".")[0];
if (ref !== process.env.CORE_QA_PROJECT_REF)
  throw Error("QA confirmation required");
const keys = await (
  await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
  })
).json();
const db = createClient(
  url,
  keys.find((k) => k.name === "service_role").api_key,
  { auth: { persistSession: false } },
);
const { data, error } = await db.auth.admin.generateLink({
  type: "magiclink",
  email: user.email,
});
if (error) throw error;
console.log(
  `http://localhost:3002/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`,
);

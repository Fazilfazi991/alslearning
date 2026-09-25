import { createClient } from "@supabase/supabase-js";

const expectedUrl = "https://slghshcdaijbcjfoqerq.supabase.co";
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== expectedUrl || process.env.SUPABASE_PROJECT_REF !== "slghshcdaijbcjfoqerq") {
  throw new Error("Refusing to provision users outside the verified ALS staging project");
}
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key?.startsWith("sb_secret_")) throw new Error("Staging-only Supabase secret key is required");
const client = createClient(expectedUrl, key, { auth: { autoRefreshToken: false, persistSession: false } });
const accounts = [
  { role: "admin", email: "als-staging-admin@example.test", name: "Synthetic Staging Admin", passwordEnv: "ALS_STAGE_ADMIN_PASSWORD" },
  { role: "teacher", email: "als-staging-teacher@example.test", name: "Synthetic Staging Teacher", passwordEnv: "ALS_STAGE_TEACHER_PASSWORD" },
  { role: "student", email: "als-staging-student1@example.test", name: "Synthetic Staging Student 1", passwordEnv: "ALS_STAGE_STUDENT1_PASSWORD" },
  { role: "student", email: "als-staging-student2@example.test", name: "Synthetic Staging Student 2", passwordEnv: "ALS_STAGE_STUDENT2_PASSWORD" },
  { role: "student", email: "als-staging-ineligible@example.test", name: "Synthetic Ineligible Student", passwordEnv: "ALS_STAGE_INELIGIBLE_PASSWORD" },
];

for (const account of accounts) {
  const password = process.env[account.passwordEnv];
  if (!password || password.length < 24) throw new Error(`Missing ${account.passwordEnv}`);
}

const { data: listed, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
if (listError) throw listError;
if (listed.users.some(user => !accounts.some(account => account.email === user.email))) {
  throw new Error("Unexpected existing Auth user in the isolated staging project");
}
const existing = new Map(listed.users.map(user => [user.email, user]));
for (const account of accounts) {
  if (existing.has(account.email)) {
    const user = existing.get(account.email);
    if (user?.app_metadata?.role !== account.role) throw new Error(`Role mismatch for ${account.email}`);
    console.log(`Verified ${account.email} (${account.role})`);
    continue;
  }
  const { data, error } = await client.auth.admin.createUser({
    email: account.email,
    password: process.env[account.passwordEnv],
    email_confirm: true,
    app_metadata: { role: account.role },
    user_metadata: { full_name: account.name },
  });
  if (error || !data.user) throw error || new Error(`Creation failed for ${account.email}`);
  console.log(`Created ${account.email} (${account.role})`);
}

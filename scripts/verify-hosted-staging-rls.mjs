import { createClient } from "@supabase/supabase-js";

const url = "https://slghshcdaijbcjfoqerq.supabase.co";
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== url || process.env.SUPABASE_PROJECT_REF !== "slghshcdaijbcjfoqerq") {
  throw new Error("Refusing to authenticate against a non-staging project");
}
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!key?.startsWith("sb_publishable_")) throw new Error("Staging publishable key missing");
const identities = [
  ["admin", "als-staging-admin@example.test", "ALS_STAGE_ADMIN_PASSWORD"],
  ["teacher", "als-staging-teacher@example.test", "ALS_STAGE_TEACHER_PASSWORD"],
  ["student1", "als-staging-student1@example.test", "ALS_STAGE_STUDENT1_PASSWORD"],
  ["student2", "als-staging-student2@example.test", "ALS_STAGE_STUDENT2_PASSWORD"],
  ["ineligible", "als-staging-ineligible@example.test", "ALS_STAGE_INELIGIBLE_PASSWORD"],
];
const clients = new Map();
for (const [label, email, passwordEnv] of identities) {
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: process.env[passwordEnv] });
  if (error || !data.user) throw error || new Error(`${label} login failed`);
  clients.set(label, client);
  console.log(`PASS synthetic ${label} password login`);
}
const admin = clients.get("admin");
const { data: classes, error: classesError } = await admin.from("live_sessions")
  .select("id,title,program_id,subject_id,status,provider").eq("title", "Synthetic ALS Hosted Staging Class");
if (classesError || classes?.length !== 1) throw classesError || new Error("Staging class not visible to Admin");
const classroom = classes[0];
if (classroom.status !== "scheduled" || classroom.provider !== "cloudflare") throw new Error("Classroom fixture unexpectedly active");
console.log(`PASS Admin can read scheduled staging class ${classroom.id}`);

for (const label of ["student1", "student2", "ineligible"]) {
  const { data, error } = await clients.get(label).rpc("can_join_live", { target_session: classroom.id });
  if (error || data !== (label !== "ineligible")) throw error || new Error(`Incorrect live eligibility for ${label}`);
  console.log(`PASS ${label} live eligibility ${data}`);
}
const { data: assignment, error: assignmentError } = await clients.get("teacher").rpc("teacher_has_assignment", {
  target_exam: null, target_program: classroom.program_id, target_subject: classroom.subject_id, permission: null,
});
if (assignmentError || assignment !== true) throw assignmentError || new Error("Teacher assignment was not recognized");
console.log("PASS assigned Teacher scope");
for (const client of clients.values()) await client.auth.signOut();

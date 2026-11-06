// Read-only by default. This release runner can write ONLY the named ALS staging
// project, ONLY the two reviewed admissions migrations, after prerequisite checks.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";

const project = "slghshcdaijbcjfoqerq", organization = "oenarbsvxrmnsvugjdrz";
const allowed = ["20261106020602_admission_enquiries.sql", "20261106030644_harden_enquiry_submission_and_rpc_validation.sql"];
// Unrelated production cleanup privileges are intentionally not prerequisites
// for admissions and must not be broadened on staging by this release runner.
const productionOnly = ["20261004104013_production_live_cleanup_access.sql"];
const args = process.argv.slice(2), apply = args.includes("--apply");
const envFile = args.find(arg => arg.startsWith("--management-env="))?.slice("--management-env=".length);
const token = process.env.SUPABASE_ACCESS_TOKEN || (envFile ? parseEnv(readFileSync(envFile, "utf8")).SUPABASE_ACCESS_TOKEN : "");
assert.ok(token, "Supply SUPABASE_ACCESS_TOKEN in the environment or --management-env=<ignored local env file>; never paste it in chat");
if (apply) assert.ok(args.includes(`--approved-project=${project}`), "Applying requires the owner's explicit staging approval and --approved-project=slghshcdaijbcjfoqerq");
const api = async (path, body) => {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}${path}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.ok(response.ok, `Staging management ${path || "project"}: HTTP ${response.status}. No production fallback is permitted.`);
  return response.json();
};
const checkProject = async () => {
  const data = await api("");
  assert.equal(data.ref || data.id, project); assert.equal(data.name, "als-live-staging"); assert.equal(data.organization_id, organization);
  assert.equal(data.status, "ACTIVE_HEALTHY", "Staging must be healthy before migration review/application");
};
const normalize = name => String(name || "").replace(/\.sql$/, "").replace(/^\d{14}_/, "");
const known = (history, file) => history.some(row => normalize(row.name) === normalize(file) || String(row.version) === file.slice(0, 14));
await checkProject();
const history = await api("/database/migrations"); assert.ok(Array.isArray(history));
const files = readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).sort();
const missing = files.filter(file => !allowed.includes(file) && !productionOnly.includes(file) && !known(history, file));
const pending = allowed.filter(file => !known(history, file));
mkdirSync(".local-qa/admissions", { recursive: true });
const manifest = { project, organization, readOnly: !apply, missingPrerequisites: missing, excludedProductionOnly: productionOnly.filter(file => !known(history, file)), pending: pending.map(file => ({ file, sha256: createHash("sha256").update(readFileSync(`supabase/migrations/${file}`)).digest("hex") })), applied: [] };
writeFileSync(".local-qa/admissions/staging-migration-review.json", JSON.stringify(manifest, null, 2));
assert.equal(missing.length, 0, `Staging prerequisites missing: ${missing.join(", ")}. This runner never auto-applies prerequisite migrations.`);
const snapshot = await api("/database/query", { query: `select jsonb_build_object(
 'auth_insert_trigger',exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgfoid='private.handle_new_user()'::regprocedure and not tgisinternal and (tgtype & 4)=4 and tgenabled<>'D'),
 'auth_metadata_trigger',exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_lms_admission' and tgenabled<>'D'),
 'admission_handler',pg_get_functiondef('private.handle_new_user()'::regprocedure),
 'programs',(select count(*) from public.programs),'profiles',(select count(*) from public.profiles),
 'enrollments',(select count(*) from public.enrollments),'live_sessions',(select count(*) from public.live_sessions),
 'active_live',(select count(*) from public.live_sessions where status='live')) as baseline` });
writeFileSync(".local-qa/admissions/staging-migration-baseline.json", JSON.stringify(snapshot, null, 2));
const baseline = snapshot[0]?.baseline;
assert.ok(baseline?.auth_insert_trigger && baseline?.auth_metadata_trigger, "Canonical transactional Auth admission triggers are required");
assert.equal(Number(baseline.active_live), 0, "Do not alter staging admission schema during active classes");
console.log(`PASS read-only review: ${files.length - allowed.length - productionOnly.length} prerequisites recorded; ${pending.length} admissions migrations pending on ${project}.`);
if (apply) {
  for (const file of pending) {
    await checkProject();
    const latest = await api("/database/migrations"); if (known(latest, file)) continue;
    await api("/database/migrations", { name: file.replace(/\.sql$/, ""), query: readFileSync(`supabase/migrations/${file}`, "utf8") });
    manifest.applied.push(file);
    writeFileSync(".local-qa/admissions/staging-migration-review.json", JSON.stringify(manifest, null, 2));
  }
  const latest = await api("/database/migrations"); assert.ok(allowed.every(file => known(latest, file)), "Verify both migration history entries after application");
  console.log(`PASS applied and verified admissions migrations on ${project}; production was not accessed.`);
}

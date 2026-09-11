// Explicitly authorized fresh production setup only; never seeds or changes vault.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { management, PRODUCTION } from "./helper-grants-lib.mjs";

assert.equal(process.argv[2], PRODUCTION, "Explicit production target required");
assert.ok(["--dry-run", "--apply"].includes(process.argv[3]));
const preflight = JSON.parse(readFileSync(".local-qa/helper-grants/production-preflight.json"));
const replay = JSON.parse(readFileSync(".local-qa/helper-grants/local-fresh-replay.json"));
const qa = JSON.parse(readFileSync(".local-qa/helper-grants/portability-qa-reconciliation.json"));
assert.equal(preflight.project, PRODUCTION);
assert.deepEqual(preflight.blocks, []);
assert.equal(replay.conditional, false);
assert.equal(replay.error, null);
assert.equal(qa.helperRepairIdempotent, true);
assert.equal(qa.historyUnchanged, true);
assert.deepEqual(replay.applied, preflight.pending.map((m) => m.file));
for (const m of preflight.pending) {
  assert.equal(createHash("sha256").update(readFileSync(`supabase/migrations/${m.file}`)).digest("hex"), m.sha256);
}
assert.deepEqual(await management(PRODUCTION, "database/migrations"), [], "Fresh production required; inspect partial state rather than retrying");
const credential = await management(PRODUCTION, "cli/login-role", {method: "POST", body: {read_only: false}});
// No shell metacharacters in this URL: Windows .cmd wrappers reparse arguments.
const url = `postgresql://${encodeURIComponent(credential.role)}:${encodeURIComponent(credential.password)}@db.${PRODUCTION}.supabase.co:5432/postgres?sslmode=require`;
assert.ok(!/[&|<>^\r\n]/.test(url));
const apply = process.argv[3] === "--apply";
const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", `pnpm dlx supabase db push --skip-vault ${apply ? "--yes" : "--dry-run"} --db-url $env:ALS_PORTABILITY_DB_URL`], {
  env: {...process.env, ALS_PORTABILITY_DB_URL: url}, encoding: "utf8", timeout: 180000,
});
const output = `${result.stdout || ""}${result.stderr || ""}`.replaceAll(url, "[redacted URL]").replaceAll(credential.password, "[redacted]");
const history = await management(PRODUCTION, "database/migrations");
writeFileSync(`.local-qa/helper-grants/production-cli-${apply ? "apply" : "dry-run"}.json`, JSON.stringify({project: PRODUCTION, apply, exit: result.status, output, history, temporaryCredentialTtlSeconds: credential.ttl_seconds}, null, 2));
console.log(output);
assert.equal(result.status, 0, "CLI failed; inspect actual history before any retry");
assert.deepEqual(history.map((m) => m.version), apply ? preflight.pending.map((m) => m.file.split("_")[0]) : []);
console.log(`PASS production ${apply ? "application" : "dry-run"}: ${history.length} applied migrations`);

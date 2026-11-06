// Disposable localhost PostgreSQL verification. Never reads production env files.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
const exe = process.env.ALS_TEST_PSQL, port = process.env.ALS_TEST_PGPORT;
assert.ok(exe, "Set ALS_TEST_PSQL to a local psql executable");
assert.match(port || "", /^\d{4,5}$/, "Set ALS_TEST_PGPORT for your disposable localhost cluster");
const database = `als_batch_guard_${Date.now()}`, marker = randomUUID();
function sql(input, db = database) {
  const result = spawnSync(exe, ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", db, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-v", `guard_project=${database}`, "-v", `guard_marker=${marker}`], { input, encoding: "utf8", maxBuffer: 20_000_000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result.stdout.trim();
}
sql(`create database ${database}`, "postgres");
sql(`comment on database ${database} is 'als-batch-guard:${marker}:${database}'`);
sql(readFileSync("scripts/fixtures/helper-grants-provider.sql", "utf8"));
// Provider-owned interfaces used by current ALS migrations. These shims exercise
// SQL transactions/RLS, not hosted GoTrue, Realtime delivery or Storage services.
sql(`alter table auth.users add column banned_until timestamptz;
create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)]$$;
create publication supabase_realtime;
create schema realtime;
create table realtime.messages(id bigint generated always as identity,extension text);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
grant usage on schema realtime to authenticated;
grant select,insert on realtime.messages to authenticated;
grant execute on function realtime.topic() to authenticated;`);
const applied = [];
for (const file of readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).sort()) {
  try {
    sql(`begin;\n${readFileSync(`supabase/migrations/${file}`, "utf8")}\ncommit;`); applied.push(file);
    // This historical regression asserts exactly five FKs; later LMS migrations
    // add three history references. Run it at its intended migration boundary.
    if (file === "20260928075559_restrict_referenced_batch_deletion.sql") sql(readFileSync("supabase/tests/restrict_referenced_batch_deletion.sql", "utf8"));
  }
  catch (error) { throw new Error(`Migration ${file}: ${error.message}`); }
}
sql(readFileSync("supabase/tests/admission_enquiries.sql", "utf8"));
mkdirSync(".local-qa/admissions", { recursive: true });
writeFileSync(".local-qa/admissions/sql-report.json", JSON.stringify({ host: "127.0.0.1", port, database, applied, passed: ["admissions permissions, validation, rate exhaustion, deduplication, CRM mutations, atomic conversion, code generation, duplicate conversion rollback", "existing batch deletion regression at its migration boundary"] }, null, 2));
console.log(`PASS: ${applied.length} migrations replayed; admissions/security/conversion and batch deletion SQL regressions passed on disposable localhost PostgreSQL.`);

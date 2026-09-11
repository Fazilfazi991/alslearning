// Read-only: this script never applies migrations or changes production objects.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { management, query, PRODUCTION } from "./helper-grants-lib.mjs";
assert.equal(process.argv[2], PRODUCTION, "Explicit production ref required");
const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migrations = files.map((file) => ({
  file,
  sha256: createHash("sha256")
    .update(readFileSync(`supabase/migrations/${file}`))
    .digest("hex"),
}));
const history = await management(PRODUCTION, "database/migrations");
const [actual] = await query(
  PRODUCTION,
  `select
 to_regprocedure('public.rls_auto_enable()')::text as required_platform_function,
 (select count(*) from pg_tables where schemaname='public') as public_tables,
 (select count(*) from auth.users) as auth_users`,
);
const dependent = "20260905052130_harden_academic_rls.sql";
const source = readFileSync(`supabase/migrations/${dependent}`, "utf8");
assert.ok(source.includes("revoke all on function public.rls_auto_enable()"));
const blocks = [];
if (
  !actual.required_platform_function &&
  !source.includes("if to_regprocedure('public.rls_auto_enable()') is not null then") &&
  !history.some((m) => m.version === dependent.split("_")[0])
) {
  blocks.push(
    `${dependent}: unconditional REVOKE references absent platform function public.rls_auto_enable(); an appended grant migration cannot repair this earlier prerequisite.`,
  );
}
const report = {
  project: PRODUCTION,
  history,
  pending: migrations.filter(
    (m) => !history.some((h) => m.file.startsWith(`${h.version}_`)),
  ),
  actual,
  blocks,
  production_writes: false,
};
writeFileSync(
  ".local-qa/helper-grants/production-preflight.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (blocks.length) process.exitCode = 1;

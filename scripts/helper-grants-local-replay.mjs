// Isolated local PostgreSQL only. The provider shim implements the SQL surface
// used by the migrations, not the Supabase HTTP services. The clean replay has
// no optional legacy helper; conditional mode also checks an existing QA helper.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { catalogSql, checkPrivileges } from "./helper-grants-lib.mjs";
import { schemaSql } from "./migration-portability-schema.mjs";
const exe = process.env.ALS_TEST_PSQL,
  port = process.env.ALS_TEST_PGPORT;
assert.ok(
  exe && port,
  "Supply ALS_TEST_PSQL and ALS_TEST_PGPORT for an isolated local PostgreSQL cluster",
);
assert.match(port, /^\d{4,5}$/);
const database = `als_grants_${Date.now()}`;
assert.match(database, /^als_grants_\d+$/);
function sql(text, db = database) {
  const result = spawnSync(
    exe,
    [
      "-h",
      "127.0.0.1",
      "-p",
      port,
      "-U",
      "postgres",
      "-d",
      db,
      "-X",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: text, encoding: "utf8", maxBuffer: 10_000_000 },
  );
  if (result.status !== 0) throw Error(result.stderr || String(result.error));
  return result.stdout.trim();
}
const conditional = process.argv.includes("--with-qa-platform-helper");
const report = {
  conditional,
  applied: [],
  assertions: [],
  failed_migration: null,
  error: null,
};
sql(`create database ${database}`, "postgres");
try {
  sql(readFileSync("scripts/fixtures/helper-grants-provider.sql", "utf8"));
  if (conditional) {
    const qa = JSON.parse(
      readFileSync(".local-qa/helper-grants/qa-before.json", "utf8"),
    );
    const helper = qa.functions.find(
      (f) => f.name === "rls_auto_enable" && f.schema === "public",
    );
    assert.ok(
      helper,
      "Observed QA platform helper required for conditional replay",
    );
    sql(helper.definition);
  }
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    report.failed_migration = file;
    sql(
      `begin;\n${readFileSync(`supabase/migrations/${file}`, "utf8")}\ncommit;`,
    );
    report.applied.push(file);
  }
  report.failed_migration = null;
  report.assertions = checkPrivileges(JSON.parse(sql(catalogSql)));
  report.inventory = JSON.parse(sql(catalogSql));
  report.structure = JSON.parse(sql(schemaSql));
  assert.equal(report.inventory.tables.length, 34, "All 34 application tables");
  report.assertions.push("All 34 application tables");
  const auth = spawnSync(process.execPath, ["scripts/migration-portability-authorization.mjs", "local"], {
    env: {...process.env, ALS_TEST_PGDATABASE: database}, encoding: "utf8",
  });
  assert.equal(auth.status, 0, auth.stderr);
  report.authorization = JSON.parse(readFileSync(".local-qa/helper-grants/local-portability-authorization.json", "utf8"));
  console.log(
    `PASS ${conditional ? "conditional" : "fresh"} local replay: ${report.applied.length} migrations, ${report.assertions.length} assertions`,
  );
} catch (error) {
  report.error = error.message;
  console.log(
    `FAIL ${conditional ? "conditional" : "fresh"} local replay: ${report.failed_migration}: ${error.message}`,
  );
  process.exitCode = 1;
} finally {
  writeFileSync(
    `.local-qa/helper-grants/local-${conditional ? "conditional" : "fresh"}-replay.json`,
    JSON.stringify(report, null, 2),
  );
  // This exact database was created above in the explicitly local test cluster.
  sql(`drop database ${database}`, "postgres");
}

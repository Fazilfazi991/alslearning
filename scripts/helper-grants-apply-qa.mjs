// QA-only forward application. SQL and the original-version history entry commit
// atomically; an uncertain response must be resolved by reading history, not retrying.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  QA,
  query,
  management,
  migration,
  publicHelpers,
} from "./helper-grants-lib.mjs";
assert.equal(
  process.argv[2],
  QA,
  "Explicit QA ref required; production is not supported",
);
const history = await management(QA, "database/migrations");
const version = migration.split("_")[0],
  name = migration.slice(version.length + 1, -4);
const previous = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f !== migration)
  .sort();
assert.deepEqual(
  history.map((m) => m.version),
  previous.map((f) => f.split("_")[0]),
  "Exact 22-migration QA baseline required",
);
const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const assertion = publicHelpers
  .map(
    (signature) =>
      `if not has_function_privilege('authenticated',${literal(signature)},'EXECUTE') or has_function_privilege('anon',${literal(signature)},'EXECUTE') or has_function_privilege('service_role',${literal(signature)},'EXECUTE') then raise exception 'Unexpected helper privileges'; end if;`,
  )
  .join("\n");
await query(
  QA,
  `begin;
select pg_advisory_xact_lock(hashtext('als-helper-grants'));
${sql}
do $check$ begin ${assertion} end $check$;
insert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(version)},${literal(name)},array[${literal(sql)}]);
commit;`,
);
const after = await management(QA, "database/migrations");
assert.equal(after.at(-1).version, version);
writeFileSync(
  ".local-qa/helper-grants/qa-migration.json",
  JSON.stringify(
    {
      project: QA,
      migration,
      sha256: createHash("sha256").update(sql).digest("hex"),
      before: history,
      after,
    },
    null,
    2,
  ),
);
console.log(
  `PASS QA: ${migration}; history ${history.length} -> ${after.length}`,
);

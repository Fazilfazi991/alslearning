import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  query,
  catalogSql,
  checkPrivileges,
  signature,
  publicHelpers,
  QA,
  PRODUCTION,
} from "./helper-grants-lib.mjs";
const target = process.argv[2];
assert.ok(
  [QA, PRODUCTION].includes(target),
  "Supply the exact QA or production ref",
);
const inventory = (await query(target, catalogSql))[0].inventory;
const checks = checkPrivileges(inventory);
if (process.argv[3]) {
  const before = JSON.parse(readFileSync(process.argv[3], "utf8"));
  assert.deepEqual(inventory.policies, before.policies, "Policies unchanged");
  checks.push("Policies unchanged");
  for (const prior of before.functions) {
    const name = signature(prior),
      now = inventory.functions.find((f) => signature(f) === name);
    assert.ok(now, name);
    assert.equal(
      now.definition,
      prior.definition,
      `${name} definition unchanged`,
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      if (!publicHelpers.includes(name))
        assert.equal(now[role], prior[role], `${name}: ${role} unchanged`);
      else if (role !== "authenticated") assert.equal(now[role], false);
    }
    checks.push(`${name}: definition and unrelated role grants unchanged`);
  }
}
writeFileSync(
  `.local-qa/helper-grants/${target}-verified.json`,
  JSON.stringify({ target, checks, inventory }, null, 2),
);
console.log(`PASS ${target}: ${checks.length} privilege/schema assertions`);

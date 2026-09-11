// Read-only policy/function fingerprint verification; never changes grants.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { query, catalogSql, QA, PRODUCTION } from './helper-grants-lib.mjs';
const baseline = JSON.parse(readFileSync('docs/question-bank-security-before.json'));
const result = {};
for (const ref of [QA, PRODUCTION]) {
  const rows = await query(ref, catalogSql);
  const inventory = rows[0].inventory;
  const sha256 = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  result[ref] = { sha256, policies: inventory.policies.length, functions: inventory.functions.length, matchesBaseline: sha256 === baseline[ref].sha256 };
}
writeFileSync('docs/question-bank-security-after.json', JSON.stringify(result, null, 2) + '\n');
console.log(result);
if (Object.values(result).some(r => !r.matchesBaseline)) process.exitCode = 1;

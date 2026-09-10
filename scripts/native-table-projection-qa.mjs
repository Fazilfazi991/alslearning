// Read-only QA validation of all local source tables. No question/media writes.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
  ".",
)[0];
assert.equal(ref, "xstssknlgdraulebdsfd");
assert.equal(process.env.CORE_QA_PROJECT_REF, ref);
const fixtures = JSON.parse(
  readFileSync(".local-qa/native-table-source-fixtures.json", "utf8"),
);
const plain = (d) =>
  d.blocks
    .map((b) =>
      b.type === "media"
        ? ""
        : b.type === "table"
          ? b.rows
              .map((r) => r.cells.map((c) => plain(c.content)).join("\t"))
              .join("\n")
          : b.runs.map((r) => r.text).join(""),
    )
    .join("\n");
const tables = fixtures
  .flatMap((q) => [
    q.prompt_rich,
    q.explanation_rich,
    ...q.options.map((o) => o.content_rich),
  ])
  .flatMap((d) => d.blocks.filter((b) => b.type === "table"));
assert.equal(tables.length, 24);
const literal = (value) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const rows = tables.map((t) => {
  const d = { version: 2, blocks: [t] };
  return `(${literal(d)}, ${literal(plain(d))} #>> '{}')`;
});
const query = `select count(*)::int as tables_validated, bool_and(private.rich_plain(doc)=expected) as all_match from (values ${rows.join(",")}) v(doc,expected)`;
const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);
assert.equal(response.ok, true, `Database response ${response.status}`);
const result = await response.json();
assert.deepEqual(result, [{ tables_validated: 24, all_match: true }]);
writeFileSync(
  "docs/native-table-projection-verification.json",
  JSON.stringify({ project: ref, writes: 0, result }, null, 2) + "\n",
);
console.log(
  "PASS: all 24 source table projections agree with QA database validation; zero writes",
);

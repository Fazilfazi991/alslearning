import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { identity } from "./microbiology-import-model.mjs";

test("established deterministic ID function keeps all BIO source occurrences distinct", () => {
  const rows = JSON.parse(readFileSync(".local-qa/biochemistry-preflight-records.json", "utf8"));
  const ids = rows.map((q) => identity(q.source_key));
  assert.equal(ids.length, 714);
  assert.equal(new Set(ids).size, 714);
  const six = new Set(rows.filter((q) => q.bio === 6).map((q) => identity(q.source_key)));
  for (const q of rows.filter((q) => q.bio === 7)) assert.equal(six.has(identity(q.source_key)), false);
  assert.deepEqual(ids, rows.map((q) => identity(q.source_key)));
});

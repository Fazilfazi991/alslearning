import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
const { admin } = await clients();
const { q } = JSON.parse(
  readFileSync(".local-qa/media-compatibility-qa.json", "utf8"),
);
const results = [];
for (const [name, patch] of [
  ["blank", { prompt: "", prompt_rich: null }],
  ["whitespace", { prompt: "\n\t  ", prompt_rich: null }],
  [
    "empty rich paragraphs",
    {
      prompt: "",
      prompt_rich: { version: 1, blocks: [{ runs: [] }, { runs: [] }] },
    },
  ],
]) {
  const result = await admin.rpc("core_save_question", {
    value: { ...q, ...patch, media: [] },
  });
  assert.ok(result.error);
  results.push(`${name} without media rejected`);
}
ok(await admin.rpc("core_save_question", { value: q }));
assert.equal(
  ok(await admin.from("questions").select("prompt").eq("id", q.id).single())
    .prompt,
  "",
);
results.push("Image-only media remains valid and original question unchanged");
writeFileSync(
  "docs/meaningful-stem-verification.json",
  JSON.stringify({ results }, null, 2) + "\n",
);
console.log("PASS: meaningful-stem guard, four assertions");

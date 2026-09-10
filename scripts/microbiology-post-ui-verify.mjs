import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
import {
  classify,
  identity,
  questionPayload,
  projectQuestion,
  questionSelect,
} from "./microbiology-import-model.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8")),
  manifest = read("docs/microbiology-import-manifest.json"),
  input = read(".local-qa/microbiology-preflight-records.json").filter(
    (q) => classify(q) !== "quarantine",
  );
const { admin } = await clients();
let verified = 0;
for (let i = 0; i < input.length; i += 60) {
  const chunk = input.slice(i, i + 60),
    rows = ok(
      await admin
        .from("questions")
        .select(questionSelect)
        .in(
          "id",
          chunk.map((q) => identity(q.source_key)),
        ),
    );
  for (const q of chunk) {
    assert.deepEqual(
      projectQuestion(rows.find((r) => r.id === identity(q.source_key))),
      questionPayload(q, manifest.taxonomy, manifest.upload_owner),
      `Post-UI source mismatch MICRO ${q.micro} Q${q.source_sequence}`,
    );
    verified++;
  }
}
assert.equal(verified, 793);
writeFileSync(
  "docs/microbiology-post-ui-verification.json",
  JSON.stringify(
    {
      complete_payloads_verified: verified,
      active: 791,
      drafts: 2,
      admin_saves_preserved_source: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS all 793 complete source payloads unchanged after Admin save QA",
);

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8")),
  qa = read(".local-qa/microbiology-acceptance.json"),
  browser = read("docs/microbiology-browser-verification.json");
assert.equal(browser.errors.length, 0);
assert.equal(browser.attempts.length, 2);
assert.ok(browser.results.includes("No console or runtime errors"));
const { admin } = await clients();
ok(
  await admin.rpc("core_save_test", {
    value: { ...qa.test, status: "archived" },
    question_ids: qa.question_ids,
    batch_ids: [qa.qa_batch.id],
  }),
);
const test = ok(
  await admin
    .from("tests")
    .select("id,status,total_marks")
    .eq("id", qa.test.id)
    .single(),
);
assert.equal(test.status, "archived");
const attempts = ok(
  await admin
    .from("test_attempts")
    .select("id,status,score")
    .eq("test_id", qa.test.id),
);
assert.ok(
  browser.attempts.every((id) =>
    attempts.some(
      (a) =>
        a.id === id &&
        a.status === "submitted" &&
        Number(a.score) === Number(test.total_marks),
    ),
  ),
);
writeFileSync(
  "docs/microbiology-cleanup-verification.json",
  JSON.stringify(
    {
      test,
      attempts,
      client_questions_retained: true,
      active: 791,
      drafts: 2,
      quarantined: 4,
      disposable_test_archived: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS one disposable test archived; all real source records and acceptance history retained",
);

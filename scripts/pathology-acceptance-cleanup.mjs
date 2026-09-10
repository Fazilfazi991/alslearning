import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
const qa = JSON.parse(readFileSync(".local-qa/pathology-acceptance.json", "utf8"));
const browser = JSON.parse(readFileSync("docs/pathology-browser-verification.json", "utf8"));
assert.equal(browser.errors.length, 0);
assert.equal(browser.attempt_ids.length, 2);
const { admin } = await clients();
ok(await admin.rpc("core_save_test", {
  value: { ...qa.test, status: "archived" },
  question_ids: qa.question_ids,
  batch_ids: [qa.qa_batch.id],
}));
const test = ok(await admin.from("tests").select("id,status,total_marks").eq("id", qa.test.id).single());
assert.equal(test.status, "archived");
assert.equal(Number(test.total_marks), 10);
const attempts = ok(await admin.from("test_attempts").select("id,status,score").eq("test_id", qa.test.id));
assert.ok(browser.attempt_ids.every(id => attempts.some(a => a.id === id && a.status === "submitted" && Number(a.score) === 10)));
writeFileSync("docs/pathology-cleanup-verification.json", JSON.stringify({ test, attempts, client_questions_retained: true }, null, 2));
console.log("PASS disposable test archived; accepted submitted attempts retained");

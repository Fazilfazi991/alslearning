import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
const { root, admin } = await clients();
const qa = JSON.parse(
  readFileSync(".local-qa/media-compatibility-qa.json", "utf8"),
);
const q = ok(
  await admin
    .from("questions")
    .select("source_label")
    .eq("id", qa.q.id)
    .single(),
);
assert.equal(q.source_label, "QA ONLY media compatibility");
assert.ok(
  qa.paths.every((p) =>
    p.startsWith(qa.fixture.users.admin.id + "/media-compatibility-"),
  ),
);
assert.equal(qa.backup.test.id, qa.test.id);
// The original test and question are archived. Normal authoring deliberately
// refuses to select an archived question, so restore this exact QA backup only.
assert.deepEqual(
  ok(
    await root
      .from("test_questions")
      .select("question_id")
      .eq("test_id", qa.test.id)
      .order("display_order"),
  ).map((r) => r.question_id),
  qa.backup.question_ids,
);
assert.deepEqual(
  ok(
    await root
      .from("test_batches")
      .select("batch_id")
      .eq("test_id", qa.test.id),
  )
    .map((r) => r.batch_id)
    .sort(),
  [...qa.backup.batch_ids].sort(),
);
ok(await root.from("tests").update(qa.backup.test).eq("id", qa.test.id));
const attempts = [
  ...new Set([
    qa.attempt,
    qa.hidden_attempt,
    ...JSON.parse(
      readFileSync(".local-qa/media-browser-attempts.json", "utf8"),
    ),
  ]),
];
const owned = ok(
  await root
    .from("test_attempts")
    .select("id,test_id,student_id")
    .in("id", attempts),
);
assert.ok(
  owned.every(
    (a) =>
      a.test_id === qa.test.id && a.student_id === qa.fixture.users.second.id,
  ),
);
ok(await root.from("test_attempts").delete().in("id", attempts));
ok(await root.from("questions").delete().eq("id", qa.q.id));
ok(await root.storage.from("question-media").remove(qa.paths));
assert.equal(
  ok(await root.from("questions").select("id").eq("id", qa.q.id)).length,
  0,
);
assert.equal(
  ok(await root.from("test_attempts").select("id").in("id", attempts)).length,
  0,
);
for (const p of qa.paths)
  assert.ok(
    (await admin.storage.from("question-media").createSignedUrl(p, 60)).error,
  );
writeFileSync(
  "docs/media-compatibility-cleanup.json",
  JSON.stringify(
    {
      qa_project: "xstssknlgdraulebdsfd",
      original_test_restored: qa.test.id,
      created_tests: 0,
      removed_synthetic_question: qa.q.id,
      removed_attempts: attempts,
      removed_synthetic_storage_objects: qa.paths.length,
      real_source_uploads: 0,
      production_touched: false,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS: existing test restored; synthetic question, six acceptance attempts and five storage objects removed",
);

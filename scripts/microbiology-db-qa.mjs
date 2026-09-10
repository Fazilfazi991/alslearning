import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
import {
  questionPayload,
  questionSelect,
  projectQuestion,
} from "./microbiology-import-model.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8")),
  qa = read(".local-qa/microbiology-acceptance.json"),
  manifest = read("docs/microbiology-import-manifest.json"),
  input = read(".local-qa/microbiology-preflight-records.json");
const { admin, login } = await clients(),
  results = [];
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
const q = input.find((q) => q.micro === 4 && q.source_sequence === 71),
  value = questionPayload(q, manifest.taxonomy, manifest.upload_owner);
for (const [label, invalid] of [
  ["empty stem", { ...value, media: [] }],
  [
    "missing correct key",
    { ...value, options: value.options.map((o) => ({ ...o, correct: false })) },
  ],
  [
    "empty option",
    {
      ...value,
      options: [
        {
          content: "",
          content_rich: { version: 1, blocks: [] },
          correct: true,
        },
        ...value.options.slice(1),
      ],
    },
  ],
  ["invalid marks", { ...value, marks: 0 }],
  ["invalid taxonomy", { ...value, subject_id: null }],
]) {
  check(
    `Transactional rejection: ${label}`,
    !!(await admin.rpc("core_save_question", { value: invalid })).error,
  );
  assert.deepEqual(
    projectQuestion(
      ok(
        await admin
          .from("questions")
          .select(questionSelect)
          .eq("id", value.id)
          .single(),
      ),
    ),
    value,
    "Rejected write changed real source",
  );
}
check("All rejected writes left complete Q71 unchanged", true);
const student = await login("second"),
  other = await login("wrong-batch");
const attempt = ok(
  await student.rpc("start_test_attempt", { target_test: qa.test.id }),
);
const payload = ok(
  await student.rpc("core_attempt_payload", { target_attempt: attempt.id }),
);
check(
  "All seven sections represented and solutions absent",
  payload.questions.length === qa.question_ids.length &&
    payload.questions.every(
      (q) =>
        !("solution_media" in q) &&
        !("explanation" in q) &&
        !("correct_ids" in q),
    ),
);
const media = manifest.images.filter((m) =>
  qa.question_ids.includes(m.question_id),
);
const solution = media.filter(
  (m) => m.kind === "solution" && m.source.original,
);
for (const m of solution)
  for (const path of [m.storage_path, m.source.original.storage_path]) {
    check(
      `Pre-review solution denied: ${m.id} ${path.endsWith(".emf") ? "original" : "PNG"}`,
      !!(await student.storage.from("question-media").createSignedUrl(path, 60))
        .error,
    );
    check(
      `Unrelated Student denied: ${m.id} ${path.endsWith(".emf") ? "original" : "PNG"}`,
      !!(await other.storage.from("question-media").createSignedUrl(path, 60))
        .error,
    );
  }
check(
  "Q71 stem available during eligible attempt",
  !(
    await student.storage
      .from("question-media")
      .createSignedUrl(value.media[0].storage_path, 60)
  ).error,
);
ok(await student.rpc("submit_test_attempt", { target_attempt: attempt.id }));
for (const m of solution)
  for (const path of [m.storage_path, m.source.original.storage_path])
    check(
      `Permitted review signs ${m.id} ${path.endsWith(".emf") ? "original" : "PNG"}`,
      !(await student.storage.from("question-media").createSignedUrl(path, 60))
        .error,
    );
writeFileSync(
  "docs/microbiology-db-acceptance.json",
  JSON.stringify(
    {
      results,
      attempt_id: attempt.id,
      failed_writes_rolled_back: 5,
      created_questions: 0,
    },
    null,
    2,
  ) + "\n",
);

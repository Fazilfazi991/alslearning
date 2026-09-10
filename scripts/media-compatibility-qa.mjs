import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
import { png } from "./core-fixtures.mjs";
const { admin, fixture, login } = await clients();
const existing = JSON.parse(
  readFileSync(".local-qa/native-table-qa.json", "utf8"),
);
const testId = existing.test.id;
const originalTest = ok(
  await admin.from("tests").select("*").eq("id", testId).single(),
);
assert.ok(originalTest.title.startsWith("QA ONLY"));
const originalQuestions = ok(
  await admin
    .from("test_questions")
    .select("*")
    .eq("test_id", testId)
    .order("display_order"),
);
const originalBatches = ok(
  await admin.from("test_batches").select("*").eq("test_id", testId),
);
const backup = {
  test: originalTest,
  question_ids: originalQuestions.map((x) => x.question_id),
  batch_ids: originalBatches.map((x) => x.batch_id),
};
const results = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  results.push(name);
  console.log("PASS", name);
};
const hash = (b) => createHash("sha256").update(b).digest("hex");
const sourceBytes = readFileSync(".local-qa/synthetic-media.emf"),
  displayBytes = readFileSync(".local-qa/synthetic-media.png");
const prefix = `${fixture.users.admin.id}/media-compatibility-${randomUUID()}`;
const paths = [];
const upload = async (name, bytes, mime) => {
  const path = `${prefix}/${name}`;
  ok(
    await admin.storage
      .from("question-media")
      .upload(path, bytes, { contentType: mime }),
  );
  paths.push(path);
  return path;
};
const media = [];
for (const kind of ["stem", "solution"]) {
  const original = await upload(
    `${kind}-${hash(sourceBytes)}.emf`,
    sourceBytes,
    "image/x-emf",
  );
  const display = await upload(
    `${kind}-${hash(displayBytes)}.png`,
    displayBytes,
    "image/png",
  );
  media.push({
    id: randomUUID(),
    kind,
    position: 0,
    storage_path: display,
    mime_type: "image/png",
    original_filename: "synthetic-media.emf",
    source: {
      fixture: "media-compatibility",
      original: {
        storage_path: original,
        mime_type: "image/x-emf",
        filename: "synthetic-media.emf",
        sha256: hash(sourceBytes),
      },
      conversion: {
        kind: "windows-gdiplus-emf-docx-png-600dpi-white",
        version: "1",
        display_sha256: hash(displayBytes),
        width: 3600,
        height: 1800,
      },
    },
  });
}
const replacement = await upload("replacement.png", png, "image/png");
const q = {
  id: randomUUID(),
  exam_id: fixture.exam.id,
  program_id: fixture.program.id,
  subject_id: fixture.subject.id,
  chapter_id: fixture.chapter.id,
  topic_id: fixture.topic.id,
  type: "single_mcq",
  prompt: "",
  prompt_rich: { version: 1, blocks: [] },
  explanation: "Synthetic solution",
  marks: 1,
  negative_marks: 0.5,
  difficulty: "medium",
  source_type: "standard",
  source_label: "QA ONLY media compatibility",
  status: "active",
  media,
  options: [
    { content: "A", correct: true },
    { content: "B", correct: false },
  ],
};
const save = (value) => admin.rpc("core_save_question", { value });
const read = () => admin.from("questions").select("*").eq("id", q.id).single();
for (const [name, patch] of [
  ["image only", { prompt: "", prompt_rich: null }],
  ["text plus image", { prompt: "Synthetic text", prompt_rich: null }],
  ["text only", { prompt: "Synthetic text", prompt_rich: null, media: [] }],
  [
    "multiple stem images",
    {
      prompt: "",
      prompt_rich: null,
      media: [
        ...media,
        {
          id: randomUUID(),
          kind: "stem",
          position: 1,
          storage_path: replacement,
          mime_type: "image/png",
          original_filename: "replacement.png",
        },
      ],
    },
  ],
]) {
  ok(await save({ ...q, ...patch }));
  check(`${name} saves transactionally`, true);
}
ok(await save(q));
check(
  "Image-only prompt remains exactly empty",
  ok(await read()).prompt === "",
);
for (const [name, patch] of [
  ["completely empty", { media: [] }],
  ["solution only", { media: media.filter((m) => m.kind === "solution") }],
  [
    "invalid options",
    {
      options: [
        { content: "", correct: true },
        { content: "B", correct: false },
      ],
    },
  ],
  [
    "missing correct answer",
    { options: q.options.map((o) => ({ ...o, correct: false })) },
  ],
  ["invalid marks", { marks: 0 }],
  ["missing taxonomy", { subject_id: null }],
  [
    "missing stem object",
    { media: [{ ...media[0], storage_path: prefix + "/missing.png" }] },
  ],
  [
    "raw EMF as display",
    {
      media: [
        {
          ...media[0],
          storage_path: media[0].source.original.storage_path,
          mime_type: "image/x-emf",
        },
      ],
    },
  ],
])
  check(`${name} rejected`, !!(await save({ ...q, ...patch })).error);
for (const [name, patch] of [
  ["missing original", { storage_path: prefix + "/missing.emf" }],
  ["invalid original hash", { sha256: "bad" }],
  ["wrong original MIME", { mime_type: "image/png" }],
]) {
  const bad = structuredClone(media);
  Object.assign(bad[1].source.original, patch);
  check(
    `${name} rejected atomically`,
    !!(await save({ ...q, media: bad })).error,
  );
}
assert.equal(ok(await read()).prompt, "");
const stored = ok(
  await admin
    .from("question_media")
    .select("*")
    .eq("question_id", q.id)
    .order("kind"),
);
ok(await save(q));
const rerun = ok(
  await admin
    .from("question_media")
    .select("*")
    .eq("question_id", q.id)
    .order("kind"),
);
check(
  "Rerun retains exactly two media identities and source/display relationships",
  stored.length === 2 &&
    JSON.stringify(stored.map((m) => [m.id, m.storage_path, m.source])) ===
      JSON.stringify(rerun.map((m) => [m.id, m.storage_path, m.source])),
);
const student = await login("second"),
  stranger = await login("wrong-batch");
const denied = async (client, path) =>
  !!(await client.storage.from("question-media").createSignedUrl(path, 60))
    .error;
for (const m of media)
  for (const path of [m.storage_path, m.source.original.storage_path])
    check(
      "Unrelated student cannot sign " + path.split("/").at(-1),
      await denied(stranger, path),
    );
check(
  "Student cannot author image-only question",
  !!(await student.rpc("core_save_question", { value: q })).error,
);
const test = {
  ...originalTest,
  status: "active",
  max_attempts: 100,
  available_from: null,
  available_until: null,
  question_count: 1,
  selection_mode: "manual",
  selection_rules: {},
  show_results: true,
  show_answers: true,
  show_explanations: true,
  randomize_options: false,
  randomize_questions: false,
};
const saveTest = () =>
  admin.rpc("core_save_test", {
    value: test,
    question_ids: [q.id],
    batch_ids: [fixture.batch.id],
  });
const state = { fixture, q, test, backup, paths, replacement, results };
writeFileSync(
  ".local-qa/media-compatibility-qa.json",
  JSON.stringify(state, null, 2),
);
ok(await saveTest());
const starts = await Promise.all([
  student.rpc("start_test_attempt", { target_test: testId }),
  student.rpc("start_test_attempt", { target_test: testId }),
]);
const a = ok(starts[0]);
check("Concurrent starts resume one attempt", a.id === ok(starts[1]).id);
const payload = ok(
  await student.rpc("core_attempt_payload", { target_attempt: a.id }),
);
check(
  "Attempt carries empty text and original stem/display metadata",
  payload.questions[0].prompt === "" &&
    payload.questions[0].stem_media[0].source.original.sha256 ===
      hash(sourceBytes),
);
check(
  "Solution keys and source/display media absent before submission",
  !("solution_media" in payload.questions[0]) &&
    !("correct_ids" in payload.questions[0]),
);
for (const path of [
  media[0].storage_path,
  media[0].source.original.storage_path,
])
  check(
    "Eligible attempt can sign stem " + path.split("/").at(-1),
    !(await denied(student, path)),
  );
for (const path of [
  media[1].storage_path,
  media[1].source.original.storage_path,
])
  check(
    "Solution unavailable before review " + path.split("/").at(-1),
    await denied(student, path),
  );
const choice = payload.questions[0].options[0].id;
check(
  "Forged option denied",
  !!(
    await student.rpc("save_attempt_answer", {
      target_attempt: a.id,
      target_question: q.id,
      option_ids: [randomUUID()],
    })
  ).error,
);
check(
  "Duplicate options denied",
  !!(
    await student.rpc("save_attempt_answer", {
      target_attempt: a.id,
      target_question: q.id,
      option_ids: [choice, choice],
    })
  ).error,
);
check(
  "Direct score write denied",
  !!(
    await student
      .from("attempt_answers")
      .insert({
        attempt_id: a.id,
        question_id: q.id,
        is_correct: true,
        marks_awarded: 999,
      })
  ).error,
);
ok(
  await student.rpc("save_attempt_answer", {
    target_attempt: a.id,
    target_question: q.id,
    option_ids: [choice],
  }),
);
check(
  "Refreshed payload retains saved answer",
  ok(await student.rpc("core_attempt_payload", { target_attempt: a.id }))
    .answers[q.id][0] === choice,
);
const submits = await Promise.all([
  student.rpc("submit_test_attempt", { target_attempt: a.id }),
  student.rpc("submit_test_attempt", { target_attempt: a.id }),
]);
check(
  "Concurrent submissions are idempotent",
  ok(submits[0]) === 1 && ok(submits[1]) === 1,
);
for (const path of [
  media[1].storage_path,
  media[1].source.original.storage_path,
]) {
  const signed = ok(
    await student.storage.from("question-media").createSignedUrl(path, 60),
  );
  const response = await fetch(signed.signedUrl);
  const bytes = Buffer.from(await response.arrayBuffer());
  check(
    "Permitted review retrieves exact " + path.split("/").at(-1),
    response.ok &&
      hash(bytes) ===
        (path.endsWith(".emf") ? hash(sourceBytes) : hash(displayBytes)),
  );
}
const changed = {
  ...q,
  prompt: "Synthetic edited source",
  prompt_rich: null,
  media: [
    {
      id: randomUUID(),
      kind: "stem",
      position: 0,
      storage_path: replacement,
      mime_type: "image/png",
      original_filename: "replacement.png",
    },
  ],
};
ok(await save(changed));
const review = ok(
  await student.rpc("get_test_review", { target_attempt: a.id }),
);
check(
  "Historical review retains original image-only stem and derivative after edit",
  review.answers[0].prompt === "" &&
    review.answers[0].stem_media[0].storage_path === media[0].storage_path &&
    review.answers[0].solution_media[0].source.original.sha256 ===
      hash(sourceBytes),
);
check(
  "Historical original remains signable after edit",
  !(await denied(student, media[1].source.original.storage_path)),
);
check(
  "Cross-student historical review denied",
  ok(await stranger.rpc("get_test_review", { target_attempt: a.id })) === null,
);
ok(await save(q));
test.show_explanations = false;
ok(await saveTest());
const hidden = ok(
  await student.rpc("start_test_attempt", { target_test: testId }),
);
ok(await student.rpc("submit_test_attempt", { target_attempt: hidden.id }));
check(
  "Hidden explanation settings suppress source and derivative metadata",
  ok(await student.rpc("get_test_review", { target_attempt: hidden.id }))
    .answers[0].solution_media === null,
);
test.show_explanations = true;
ok(await saveTest());
state.test = test;
state.attempt = a.id;
state.hidden_attempt = hidden.id;
writeFileSync(
  ".local-qa/media-compatibility-qa.json",
  JSON.stringify(state, null, 2),
);
writeFileSync(
  "docs/media-compatibility-db-verification.json",
  JSON.stringify(
    {
      results,
      question_id: q.id,
      reused_test_id: testId,
      created_tests: 0,
      synthetic_storage_objects: paths.length,
    },
    null,
    2,
  ) + "\n",
);

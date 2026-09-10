import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { clients, ok } from "./pathology-client.mjs";
import { png } from "./core-fixtures.mjs";
const { admin, fixture, login } = await clients();
const p = (text) => ({ runs: [{ text, marks: [] }] });
const doc = (text) => ({ version: 1, blocks: [p(text)] });
const cell = (text, colspan = 1, rowspan = 1, header = false) => ({
  content: doc(text),
  colspan,
  rowspan,
  header,
});
const table = {
  type: "table",
  columns: 5,
  rows: [
    { cells: [cell("TABLE SEARCH NEEDLE", 5, 1, true)] },
    {
      cells: [
        cell("Original rowspan", 1, 2),
        cell("Column two"),
        cell("Column three"),
        cell("Column four"),
        cell("Column five"),
      ],
    },
    {
      cells: [
        cell(""),
        cell("CO₂ β 10⁵"),
        cell("Next paragraph\nAnother line"),
        cell('<img src=x onerror="alert(1)">'),
      ],
    },
    {
      before: 1,
      after: 1,
      cells: [cell("Offset A"), cell("Offset B"), cell("Offset C")],
    },
  ],
};
table.rows[1].cells[1].content = {
  version: 1,
  blocks: [
    {
      runs: [
        { text: "x", marks: [] },
        { text: "2", marks: ["superscript", "bold"] },
        { text: " CO", marks: [] },
        { text: "2", marks: ["subscript"] },
      ],
    },
  ],
};
const one = {
  type: "table",
  columns: 1,
  rows: [{ cells: [cell("One cell")] }],
};
const ast = {
  version: 2,
  blocks: [
    p("QA ONLY native table fixture"),
    table,
    p("Before stem image"),
    { type: "media", position: 0 },
    p("After stem image"),
    one,
  ],
};
const explanation = {
  version: 2,
  blocks: [
    p("PRIVATE TABLE EXPLANATION"),
    { type: "media", position: 0 },
    table,
    p("Between solution images"),
    { type: "media", position: 1 },
    one,
  ],
};
const media = [];
for (const [i, kind, position] of [
  [0, "stem", 0],
  [1, "solution", 0],
  [2, "solution", 1],
]) {
  const path = `${fixture.users.admin.id}/native-table-${randomUUID()}-${i}.png`;
  ok(
    await admin.storage
      .from("question-media")
      .upload(path, png, { contentType: "image/png" }),
  );
  media.push({
    id: randomUUID(),
    kind,
    position,
    storage_path: path,
    mime_type: "image/png",
    original_filename: "synthetic.png",
    source: { fixture: "native-table-qa" },
  });
}
const q = {
  id: randomUUID(),
  exam_id: fixture.exam.id,
  program_id: fixture.program.id,
  subject_id: fixture.subject.id,
  chapter_id: fixture.chapter.id,
  topic_id: fixture.topic.id,
  type: "single_mcq",
  prompt: "placeholder",
  prompt_rich: ast,
  explanation: "placeholder",
  explanation_rich: explanation,
  marks: 1,
  negative_marks: 0,
  difficulty: "medium",
  source_type: "standard",
  source_label: "QA ONLY native-table fixture",
  status: "active",
  media,
  options: [
    {
      content: "one",
      content_rich: { version: 2, blocks: [one] },
      correct: true,
    },
    { content: "Plain other option", correct: false },
  ],
};
const results = [];
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
const save = (value) => admin.rpc("core_save_question", { value });
ok(await save(q));
const read = () =>
  admin
    .from("questions")
    .select("*,question_options!question_options_question_id_fkey(*)")
    .eq("id", q.id)
    .single();
let saved = ok(await read());
check(
  "Server derives searchable table-cell text",
  saved.prompt.includes("TABLE SEARCH NEEDLE") &&
    saved.explanation.includes("PRIVATE TABLE EXPLANATION"),
);
assert.deepEqual(saved.prompt_rich, ast);
assert.deepEqual(saved.explanation_rich, explanation);
ok(await save(q));
assert.deepEqual(ok(await read()).prompt_rich, ast);
check("Admin no-op transaction preserves table AST", true);
const invalid = [];
for (const patch of [
  { onclick: "bad()" },
  { colspan: 0 },
  { rowspan: 9999 },
  { header: "yes" },
]) {
  const bad = structuredClone(ast);
  Object.assign(bad.blocks[1].rows[0].cells[0], patch);
  invalid.push(bad);
}
invalid.push(
  { version: 2, blocks: [{ type: "media", position: 99 }] },
  {
    version: 2,
    blocks: [{ type: "media", position: 0, url: "javascript:bad()" }],
  },
);
for (const [i, bad] of invalid.entries())
  check(
    `Malformed or malicious AST ${i + 1} rejected`,
    !!(await save({ ...q, prompt_rich: bad })).error,
  );
assert.deepEqual(ok(await read()).prompt_rich, ast);
check("Rejected edits roll back completely", true);
const student = await login("second");
check(
  "Student cannot author structured question",
  !!(await student.rpc("core_save_question", { value: q })).error,
);
const originalTest = ok(
  await admin.from("tests").select("*").eq("id", fixture.testId).single(),
);
const test = {
  ...originalTest,
  id: randomUUID(),
  slug: undefined,
  title: "QA ONLY — Native table fidelity",
  question_count: 1,
  selection_mode: "manual",
  selection_rules: {},
  status: "active",
  max_attempts: 10,
  show_answers: true,
  show_results: true,
  show_explanations: false,
  randomize_options: false,
  randomize_questions: false,
  available_from: null,
  available_until: null,
};
const saveTest = () =>
  admin.rpc("core_save_test", {
    value: test,
    question_ids: [q.id],
    batch_ids: [fixture.batch.id],
  });
ok(await saveTest());
const start = ok(
  await student.rpc("start_test_attempt", { target_test: test.id }),
);
const attemptId = typeof start === "string" ? start : start.id;
const payload = ok(
  await student.rpc("core_attempt_payload", { target_attempt: attemptId }),
);
check(
  "In-progress payload excludes explanation table and solution media",
  !JSON.stringify(payload).includes("PRIVATE TABLE EXPLANATION") &&
    !("solution_media" in payload.questions[0]),
);
ok(await student.rpc("submit_test_attempt", { target_attempt: attemptId }));
const hidden = ok(
  await student.rpc("get_test_review", { target_attempt: attemptId }),
);
check(
  "Hidden review settings omit solution table",
  hidden.answers[0].explanation_rich === null &&
    hidden.answers[0].solution_media === null,
);
test.show_explanations = true;
ok(await saveTest());
const stillHidden = ok(
  await student.rpc("get_test_review", { target_attempt: attemptId }),
);
check(
  "Historical settings remain hidden after test edit",
  stillHidden.answers[0].explanation_rich === null,
);
writeFileSync(
  ".local-qa/native-table-qa.json",
  JSON.stringify(
    { fixture, q, test, results, hidden_attempt: attemptId },
    null,
    2,
  ),
);
writeFileSync(
  "docs/native-table-db-verification.json",
  JSON.stringify(
    { results, question_id: q.id, test_id: test.id, hidden_attempt: attemptId },
    null,
    2,
  ),
);

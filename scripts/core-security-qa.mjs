import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const fixtures = JSON.parse(readFileSync("core-qa-results.json", "utf8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  ref = new URL(url).hostname.split(".")[0];
if (ref !== process.env.CORE_QA_PROJECT_REF)
  throw Error("Explicit QA project confirmation required");
const keys = await (
  await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
  })
).json();
const root = createClient(
  url,
  keys.find((k) => k.name === "service_role").api_key,
  { auth: { persistSession: false } },
);
const ok = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const results = [];
const check = (label, value) => {
  assert.ok(value, label);
  results.push(label);
  console.log("PASS", label);
};
async function login(label) {
  const email = fixtures.users[label].email;
  if (!email.startsWith(fixtures.prefix))
    throw Error("Synthetic account required");
  const link = ok(
    await root.auth.admin.generateLink({ type: "magiclink", email }),
  );
  const db = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  ok(
    await db.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "magiclink",
    }),
  );
  return db;
}
const admin = await login("admin"),
  student = await login("second"),
  teacher = await login("teacher");
const original = ok(
  await admin.from("tests").select("*").eq("id", fixtures.testId).single(),
);
const test = {
  ...original,
  id: crypto.randomUUID(),
  title: "Core QA Concurrency and marking",
  max_attempts: 3,
};
ok(
  await admin.rpc("core_save_test", {
    value: test,
    question_ids: [fixtures.questionId],
    batch_ids: [fixtures.batch.id],
  }),
);
const attempts = await Promise.all([
  student.rpc("start_test_attempt", { target_test: test.id }),
  student.rpc("start_test_attempt", { target_test: test.id }),
]);
check(
  "Concurrent starts resume one attempt",
  ok(attempts[0]).id === ok(attempts[1]).id,
);
const a = attempts[0].data;
const payload = ok(
    await student.rpc("core_attempt_payload", { target_attempt: a.id }),
  ),
  question = payload.questions[0];
const wrong = question.options.find((o) => o.content === "Three");
check(
  "Forged option denied",
  !!(
    await student.rpc("save_attempt_answer", {
      target_attempt: a.id,
      target_question: question.id,
      option_ids: [crypto.randomUUID()],
    })
  ).error,
);
check(
  "Duplicate options denied",
  !!(
    await student.rpc("save_attempt_answer", {
      target_attempt: a.id,
      target_question: question.id,
      option_ids: [wrong.id, wrong.id],
    })
  ).error,
);
check(
  "Direct answer result write denied",
  !!(
    await student
      .from("attempt_answers")
      .insert({
        attempt_id: a.id,
        question_id: question.id,
        is_correct: true,
        marks_awarded: 999,
      })
  ).error,
);
check(
  "Direct attempt insert denied",
  !!(
    await student
      .from("test_attempts")
      .insert({
        test_id: test.id,
        student_id: fixtures.users.second.id,
        score: 999,
      })
  ).error,
);
ok(
  await student.rpc("save_attempt_answer", {
    target_attempt: a.id,
    target_question: question.id,
    option_ids: [wrong.id],
  }),
);
const submitted = await Promise.all([
  student.rpc("submit_test_attempt", { target_attempt: a.id }),
  student.rpc("submit_test_attempt", { target_attempt: a.id }),
]);
check(
  "Concurrent submissions are idempotent",
  ok(submitted[0]) === -0.5 && ok(submitted[1]) === -0.5,
);
check(
  "Negative marks persist",
  ok(await student.rpc("get_test_review", { target_attempt: a.id })).score ===
    -0.5,
);
const blank = ok(
  await student.rpc("start_test_attempt", { target_test: test.id }),
);
ok(await student.rpc("submit_test_attempt", { target_attempt: blank.id }));
check(
  "Unanswered question receives no penalty",
  ok(await student.rpc("get_test_review", { target_attempt: blank.id }))
    .score === 0,
);
check(
  "Teacher program-wide reorder denied",
  !!(
    await teacher.rpc("core_move_content", {
      target: fixtures.materials[0].id,
      direction: 1,
    })
  ).error,
);
ok(
  await admin.rpc("core_move_content", {
    target: fixtures.materials[0].id,
    direction: 1,
  }),
);
const rows = ok(
  await admin
    .from("learning_content")
    .select("display_order")
    .eq("program_id", fixtures.program.id),
);
check(
  "Admin reorder leaves distinct positions",
  new Set(rows.map((r) => r.display_order)).size === rows.length,
);
// Actual signed PDF retrieval, not just creation of a link.
const material = ok(
  await student
    .from("learning_content")
    .select("storage_path")
    .eq("id", fixtures.materials.find(m=>m.kind==="pdf").id)
    .single(),
);
const signed = ok(
  await student.storage
    .from("learning-content")
    .createSignedUrl(material.storage_path, 60),
);
const response = await fetch(signed.signedUrl);
const bytes = Buffer.from(await response.arrayBuffer());
check(
  "Private PDF returns PDF bytes",
  response.ok &&
    response.headers.get("content-type").includes("application/pdf") &&
    bytes.subarray(0, 5).toString() === "%PDF-",
);
const inaccessible = await login("wrong-batch");
check(
  "Cross-student review hidden",
  ok(await inaccessible.rpc("get_test_review", { target_attempt: a.id })) ===
    null,
);
mkdirSync(".local-qa",{recursive:true});
writeFileSync(
  ".local-qa/additional-results.json",
  JSON.stringify({ results }, null, 2),
);
console.log(`Completed ${results.length} additional assertions.`);

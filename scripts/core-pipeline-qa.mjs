// Real Supabase clients; isolated, synthetic fixtures. Never run against production.
import assert from "node:assert/strict";
import { png, pdf } from "./core-fixtures.mjs";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  ref = new URL(url).hostname.split(".")[0];
if (process.env.CORE_QA_PROJECT_REF !== ref)
  throw Error("Explicit QA project confirmation required");
const keys = await (
  await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
  })
).json();
const root = createClient(
  url,
  keys.find((x) => x.name === "service_role").api_key,
  { auth: { persistSession: false } },
);
const results = [];
const check = (label, condition) => {
  assert.ok(condition, label);
  results.push(label);
  console.log("PASS", label);
};
const ok = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const prefix = `core-qa-${Date.now()}`;
const users = {};
async function account(label, role = "student") {
  const email = `${prefix}-${label}@example.invalid`;
  const u = ok(
    await root.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { full_name: `Core QA ${label}` },
    }),
  ).user;
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
  users[label] = { id: u.id, email };
  return db;
}
const admin = await account("admin", "admin"),
  teacher = await account("teacher", "teacher"),
  student = await account("student");
const insert = async (table, row) =>
  ok(await admin.from(table).insert(row).select().single());
const exam = await insert("entrance_exams", {
  name: `${prefix} Exam`,
  slug: `${prefix}-exam`,
  status: "active",
});
const program = await insert("programs", {
  name: `${prefix} Program`,
  slug: `${prefix}-program`,
  exam_id: exam.id,
  status: "active",
  duration_days: 90,
  access_validity_days: 90,
});
const subject = await insert("subjects", {
  name: `${prefix} Subject`,
  slug: `${prefix}-subject`,
  status: "active",
});
ok(
  await admin.rpc("core_program_subjects", {
    target_program: program.id,
    subject_ids: [subject.id],
  }),
);
const chapter = await insert("chapters", {
  name: "Core QA Chapter",
  slug: prefix,
  subject_id: subject.id,
  status: "active",
});
const topic = await insert("topics", {
  name: "Core QA Topic",
  slug: prefix,
  subject_id: subject.id,
  chapter_id: chapter.id,
  status: "active",
});
const batch = await insert("batches", {
  name: "Core QA Batch",
  slug: `${prefix}-batch`,
  program_id: program.id,
  status: "active",
});
const otherBatch = await insert("batches", {
  name: "Core QA Other Batch",
  slug: `${prefix}-other-batch`,
  program_id: program.id,
  status: "active",
});
const otherProgram = await insert("programs", {
  name: "Core QA Other Program",
  slug: `${prefix}-other-program`,
  exam_id: exam.id,
  status: "active",
});
const tax = {
  exam_id: exam.id,
  program_id: program.id,
  subject_id: subject.id,
  chapter_id: chapter.id,
  topic_id: topic.id,
};
const enrollment = async (id, extra = {}) =>
  insert("enrollments", {
    student_id: id,
    program_id: program.id,
    batch_id: batch.id,
    status: "active",
    access_starts_at: new Date(Date.now() - 86400000).toISOString(),
    access_expires_at: new Date(Date.now() + 86400000).toISOString(),
    ...extra,
  });
await enrollment(users.student.id);
await insert("faculty_assignments", {
  faculty_id: users.teacher.id,
  ...{ exam_id: exam.id, program_id: program.id, subject_id: subject.id },
  can_manage_content: true,
  can_manage_questions: true,
  can_manage_tests: true,
});
ok(
  await root
    .from("batch_faculty")
    .insert({ faculty_id: users.teacher.id, batch_id: batch.id }),
);
const q = {
  id: crypto.randomUUID(),
  ...tax,
  prompt: "Core QA: select four",
  type: "single_mcq",
  explanation: "Two plus two is four.",
  difficulty: "easy",
  marks: 2,
  negative_marks: 0.5,
  status: "draft",
  source_type: "previous_exam",
  source_reference: "QA reference",
  exam_year: 2025,
  exam_session: "Session A",
  source_label: "Synthetic acceptance",
  options: [
    { content: "Four", correct: true },
    { content: "Three", correct: false },
    { content: "Two", correct: false },
    { content: "One", correct: false },
  ],
};
ok(await admin.rpc("core_save_question", { value: q }));
let test = {
  id: crypto.randomUUID(),
  ...tax,
  title: "Core QA Assessment",
  type: "mock",
  duration_minutes: 10,
  question_count: 1,
  default_negative_marks: 0.5,
  max_attempts: 3,
  show_results: true,
  show_answers: true,
  show_explanations: true,
  selection_mode: "manual",
  status: "draft",
};
const saveTest = () =>
  admin.rpc("core_save_test", {
    value: test,
    question_ids: [q.id],
    batch_ids: [batch.id],
  });
check("Draft question cannot be selected", Boolean((await saveTest()).error));
q.status = "active";
ok(await admin.rpc("core_save_question", { value: q }));
ok(await saveTest());
check(
  "Draft test hidden",
  ok(await student.from("tests").select("id").eq("id", test.id)).length === 0,
);
test.status = "active";
ok(await saveTest());
check(
  "Published test visible",
  ok(await student.from("tests").select("id").eq("id", test.id)).length === 1,
);
check(
  "Student batch visible",
  ok(await student.from("batches").select("id").eq("id", batch.id)).length ===
    1,
);
check(
  "Teacher assignment content scope",
  ok(await teacher.from("questions").select("id").eq("id", q.id)).length === 1,
);
check(
  "Student question table does not leak keys or explanations",
  ok(await student.from("questions").select("*").eq("id", q.id)).length === 0,
);
check(
  "Answer keys hidden",
  ok(
    await student
      .from("question_answer_keys")
      .select("*")
      .eq("question_id", q.id),
  ).length === 0,
);
const failId = crypto.randomUUID();
check(
  "Invalid question transaction rejected",
  !!(
    await admin.rpc("core_save_question", {
      value: { ...q, id: failId, options: [] },
    })
  ).error,
);
check(
  "Failed transaction leaves no question",
  ok(await root.from("questions").select("id").eq("id", failId)).length === 0,
);
const attempt = ok(
  await student.rpc("start_test_attempt", { target_test: test.id }),
);
for (const [field, value] of Object.entries({
  score: 999,
  status: "submitted",
  expires_at: "2099-01-01T00:00:00Z",
  submitted_at: "2020-01-01T00:00:00Z",
  correct_count: 999,
  negative_marks_total: 0,
}))
  check(
    `Student direct ${field} write DENIED`,
    !!(
      await student
        .from("test_attempts")
        .update({ [field]: value })
        .eq("id", attempt.id)
    ).error,
  );
let payload = ok(
  await student.rpc("core_attempt_payload", { target_attempt: attempt.id }),
);
check(
  "Pre-submission payload has no key/explanation",
  !JSON.stringify(payload).includes("correct_ids") &&
    !JSON.stringify(payload).includes("Two plus two"),
);
check(
  "Pre-submission review denied",
  ok(await student.rpc("get_test_review", { target_attempt: attempt.id })) ===
    null,
);
const option = payload.questions[0].options.find(
  (x) => x.content === "Four",
).id;
ok(
  await student.rpc("save_attempt_answer", {
    target_attempt: attempt.id,
    target_question: q.id,
    option_ids: [option],
  }),
);
check(
  "Answers survive refresh",
  ok(await student.rpc("core_attempt_payload", { target_attempt: attempt.id }))
    .answers[q.id][0] === option,
);
ok(await student.rpc("submit_test_attempt", { target_attempt: attempt.id }));
check(
  "Server score correct",
  ok(await student.rpc("get_test_review", { target_attempt: attempt.id }))
    .score === 2,
);
check(
  "Submitted result tampering DENIED",
  !!(
    await student
      .from("test_attempts")
      .update({ score: 999 })
      .eq("id", attempt.id)
  ).error,
);
q.prompt = "Core QA edited question";
q.options[0].content = "Four (edited)";
ok(await admin.rpc("core_save_question", { value: q }));
check(
  "History snapshot survives question edit",
  ok(await student.rpc("get_test_review", { target_attempt: attempt.id }))
    .answers[0].prompt === "Core QA: select four",
);
for (let i = 0; i < 2; i++) {
  const a = ok(
    await student.rpc("start_test_attempt", { target_test: test.id }),
  );
  ok(await student.rpc("submit_test_attempt", { target_attempt: a.id }));
}
check(
  "Three-attempt limit enforced",
  !!(await student.rpc("start_test_attempt", { target_test: test.id })).error,
);
check(
  "History retains all attempts",
  ok(await student.rpc("core_attempt_history", { target_test: test.id }))
    .length === 3,
);
for (const [label, extra, inactive] of [
  [
    "future",
    { access_starts_at: new Date(Date.now() + 3600000).toISOString() },
    false,
  ],
  [
    "expired",
    { access_expires_at: new Date(Date.now() - 1000).toISOString() },
    false,
  ],
  ["suspended", { status: "suspended" }, false],
  ["inactive", {}, true],
  ["wrong-batch", { batch_id: otherBatch.id }, false],
  ["wrong-program", { program_id: otherProgram.id, batch_id: null }, false],
]) {
  const db = await account(label);
  await enrollment(users[label].id, extra);
  if (inactive)
    ok(
      await root
        .from("profiles")
        .update({ is_active: false })
        .eq("id", users[label].id),
    );
  check(
    `${label}: test hidden`,
    ok(await db.from("tests").select("id").eq("id", test.id)).length === 0,
  );
  check(
    `${label}: start denied`,
    !!(await db.rpc("start_test_attempt", { target_test: test.id })).error,
  );
}
const second = await account("second");
await enrollment(users.second.id);
test.status = "draft";
ok(await saveTest());
check(
  "Unpublish prevents new attempt",
  !!(await second.rpc("start_test_attempt", { target_test: test.id })).error,
);
test.status = "active";
ok(await saveTest());
const expired = ok(
  await second.rpc("start_test_attempt", { target_test: test.id }),
);
ok(
  await root
    .from("test_attempts")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", expired.id),
);
check(
  "Server rejects answers after expiry",
  !!(
    await second.rpc("save_attempt_answer", {
      target_attempt: expired.id,
      target_question: q.id,
      option_ids: [],
    })
  ).error,
);
check(
  "Expired attempt finalized on reload",
  ok(await second.rpc("core_attempt_payload", { target_attempt: expired.id }))
    .status === "submitted",
);

// Material delivery uses the same authenticated clients and storage policies as the UI.
const imgPath = users.admin.id + "/" + crypto.randomUUID() + ".png";
ok(
  await admin.storage
    .from("question-media")
    .upload(imgPath, png, { contentType: "image/png" }),
);
const solutionPath = users.admin.id + "/" + crypto.randomUUID() + ".png";
ok(
  await admin.storage
    .from("question-media")
    .upload(solutionPath, png, { contentType: "image/png" }),
);
const types = [];
for (const type of ["multiple_mcq", "true_false", "image_mcq", "case_based"]) {
  const value = {
    ...q,
    id: crypto.randomUUID(),
    type,
    prompt: "Core QA " + type,
    stem_image_path: type === "image_mcq" ? imgPath : null,
    explanation_image_path: solutionPath,
    options:
      type === "true_false"
        ? [
            { content: "True", correct: true },
            { content: "False", correct: false },
          ]
        : q.options.map((o, i) => ({
            ...o,
            correct: type === "multiple_mcq" ? i < 2 : i === 0,
          })),
  };
  ok(await admin.rpc("core_save_question", { value }));
  types.push(value);
  check(
    type + " persists",
    ok(await admin.from("questions").select("type").eq("id", value.id).single())
      .type === type,
  );
}
check(
  "Matching explicitly disabled",
  !!(
    await admin.rpc("core_save_question", {
      value: { ...q, id: crypto.randomUUID(), type: "match_following" },
    })
  ).error,
);
const full = {
  ...test,
  id: crypto.randomUUID(),
  title: "Core QA Formats",
  max_attempts: 1,
  type: "full_exam",
};
ok(
  await admin.rpc("core_save_test", {
    value: full,
    question_ids: types.map((q) => q.id),
    batch_ids: [batch.id],
  }),
);
const a = ok(await second.rpc("start_test_attempt", { target_test: full.id }));
const ap = ok(
  await second.rpc("core_attempt_payload", { target_attempt: a.id }),
);
check(
  "Stem image authorized during attempt",
  !(await second.storage.from("question-media").createSignedUrl(imgPath, 60))
    .error,
);
check(
  "Solution image denied before submission",
  !!(
    await second.storage
      .from("question-media")
      .createSignedUrl(solutionPath, 60)
  ).error,
);
for (const question of ap.questions) {
  const expected = types.find((x) => x.id === question.id);
  const ids = question.options
    .filter((o) =>
      expected.options.some((x) => x.correct && x.content === o.content),
    )
    .map((o) => o.id);
  ok(
    await second.rpc("save_attempt_answer", {
      target_attempt: a.id,
      target_question: question.id,
      option_ids: ids,
    }),
  );
}
ok(await second.rpc("submit_test_attempt", { target_attempt: a.id }));
check(
  "All supported formats scored correctly",
  ok(await second.rpc("get_test_review", { target_attempt: a.id })).score === 8,
);
check(
  "Solution image authorized after submission",
  !(
    await second.storage
      .from("question-media")
      .createSignedUrl(solutionPath, 60)
  ).error,
);
check(
  "One-attempt limit enforced",
  !!(await second.rpc("start_test_attempt", { target_test: full.id })).error,
);
const random = {
  ...test,
  id: crypto.randomUUID(),
  title: "Core QA Random Bank",
  selection_mode: "generated",
  selection_rules: { difficulty: "easy" },
  question_count: 2,
};
ok(
  await admin.rpc("core_save_test", {
    value: random,
    question_ids: [],
    batch_ids: [batch.id],
  }),
);
const ra = ok(
  await second.rpc("start_test_attempt", { target_test: random.id }),
);
const rp = ok(
  await second.rpc("core_attempt_payload", { target_attempt: ra.id }),
);
check(
  "Random sample has requested distinct eligible questions",
  rp.questions.length === 2 &&
    new Set(rp.questions.map((q) => q.id)).size === 2 &&
    rp.questions.every((x) => [q, ...types].some((q) => q.id === x.id)),
);
ok(await second.rpc("submit_test_attempt", { target_attempt: ra.id }));
const hidden = {
  ...test,
  id: crypto.randomUUID(),
  title: "Core QA Hidden Review",
  show_results: false,
  show_answers: false,
  show_explanations: false,
};
ok(
  await admin.rpc("core_save_test", {
    value: hidden,
    question_ids: [q.id],
    batch_ids: [batch.id],
  }),
);
const ha = ok(
  await second.rpc("start_test_attempt", { target_test: hidden.id }),
);
check(
  "Submit does not reveal hidden score",
  ok(await second.rpc("submit_test_attempt", { target_attempt: ha.id })) ===
    null,
);
check(
  "Idempotent submit does not reveal hidden score",
  ok(await second.rpc("submit_test_attempt", { target_attempt: ha.id })) ===
    null,
);
const hr = ok(await second.rpc("get_test_review", { target_attempt: ha.id }));
check(
  "Review respects hidden flags",
  hr.score === null && hr.answers.length === 0,
);
const materials = [];
for (const kind of ["video", "pdf", "image"]) {
  const path =
    users.admin.id +
    "/" +
    crypto.randomUUID() +
    (kind === "image" ? ".png" : ".pdf");
  if (kind !== "video")
    ok(
      await admin.storage
        .from("learning-content")
        .upload(path, kind === "image" ? png : pdf, {
          contentType: kind === "image" ? "image/png" : "application/pdf",
        }),
    );
  const c = {
    id: crypto.randomUUID(),
    ...tax,
    title: "Core QA " + kind,
    kind,
    status: "active",
    allow_download: true,
    ...(kind === "video"
      ? {
          external_url:
            "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        }
      : { storage_bucket: "learning-content", storage_path: path }),
  };
  ok(await admin.rpc("core_save_content", { value: c, batch_ids: [batch.id] }));
  const before = ok(
    await admin.from("learning_content").select("*").eq("id", c.id).single(),
  );
  c.title += " edited";
  ok(await admin.rpc("core_save_content", { value: c, batch_ids: [batch.id] }));
  const after = ok(
    await admin.from("learning_content").select("*").eq("id", c.id).single(),
  );
  check(
    kind + " metadata edit preserves slug/order/file",
    before.slug === after.slug &&
      before.display_order === after.display_order &&
      before.storage_path === after.storage_path,
  );
  materials.push(after);
  check(
    kind + " visible to eligible student",
    ok(await second.from("learning_content").select("id").eq("id", c.id))
      .length === 1,
  );
  if (kind !== "video")
    check(
      kind + " signed file authorized",
      !(await second.storage.from("learning-content").createSignedUrl(path, 60))
        .error,
    );
}
for (const label of [
  "future",
  "expired",
  "suspended",
  "inactive",
  "wrong-batch",
  "wrong-program",
]) {
  const link = ok(
    await root.auth.admin.generateLink({
      type: "magiclink",
      email: users[label].email,
    }),
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
  check(
    label + ": material hidden",
    ok(
      await db
        .from("learning_content")
        .select("id")
        .in(
          "id",
          materials.map((x) => x.id),
        ),
    ).length === 0,
  );
  check(
    label + ": private material URL denied",
    !!(
      await db.storage
        .from("learning-content")
        .createSignedUrl(materials[1].storage_path, 60)
    ).error,
  );
}
check(
  "Teacher wrong program mutation denied",
  !!(
    await teacher.rpc("core_save_question", {
      value: { ...q, id: crypto.randomUUID(), program_id: otherProgram.id },
    })
  ).error,
);
check(
  "Teacher unassigned batch mutation denied",
  !!(
    await teacher.rpc("core_save_content", {
      value: { ...materials[0], id: crypto.randomUUID() },
      batch_ids: [otherBatch.id],
    })
  ).error,
);
ok(
  await root
    .from("faculty_assignments")
    .update({ can_manage_questions: false, can_manage_content: false })
    .eq("faculty_id", users.teacher.id),
);
check(
  "Teacher revoked question permission denied",
  !!(await teacher.rpc("core_save_question", { value: q })).error,
);
check(
  "Teacher revoked content permission denied",
  !!(
    await teacher.rpc("core_save_content", {
      value: materials[0],
      batch_ids: [batch.id],
    })
  ).error,
);
check(
  "Test-only teacher can select active bank",
  ok(await teacher.rpc("core_test_bank")).length >= types.length,
);
check(
  "Test-only teacher cannot read keys",
  ok(
    await teacher
      .from("question_answer_keys")
      .select("*")
      .eq("question_id", q.id),
  ).length === 0,
);
// Keep this restricted assignment for browser permission acceptance.
ok(
  await admin.rpc("core_save_test", {
    value: { ...full, status: "draft" },
    question_ids: types.map((q) => q.id),
    batch_ids: [batch.id],
  }),
);
check(
  "Historical result summary survives unpublishing",
  ok(await second.rpc("core_test_summary", { test_slug: "test-" + full.id }))
    .can_start === false,
);
check(
  "History refuses another student attempt",
  !!(await student.rpc("core_attempt_payload", { target_attempt: a.id })).error,
);
const artifacts = {
  prefix,
  users,
  exam,
  program,
  subject,
  chapter,
  topic,
  batch,
  questionId: q.id,
  testId: test.id,
  materials,
  results,
};
writeFileSync("core-qa-results.json", JSON.stringify(artifacts, null, 2));
console.log(
  "Completed " +
    results.length +
    " assertions. Synthetic fixtures retained for browser acceptance.",
);

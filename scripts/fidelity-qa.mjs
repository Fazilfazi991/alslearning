import {fixturesBytes} from "./fidelity-fixtures.mjs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
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
  outsider = await login("wrong-batch");
const original = ok(
  await admin
    .from("questions")
    .select("*")
    .eq("id", fixtures.questionId)
    .single(),
);
const ast = {
  version: 1,
  blocks: [
    {
      runs: [
        { text: "CO", marks: ["bold"] },
        { text: "2", marks: ["subscript"] },
        { text: " + x", marks: [] },
        { text: "2", marks: ["superscript", "italic"] },
      ],
    },
  ],
};
const media = [];

for (const [i, ext] of ["png", "jpeg", "gif", "png", "jpeg", "gif"].entries()) {
  const path = `${fixtures.users.admin.id}/fidelity-${crypto.randomUUID()}/image.${ext}`;
  const bytes = fixturesBytes[ext];
  ok(
    await admin.storage
      .from("question-media")
      .upload(path, bytes, { contentType: `image/${ext}` }),
  );
  media.push({
    id: crypto.randomUUID(),
    kind: i < 2 ? "stem" : "solution",
    position: i < 2 ? i : i - 2,
    storage_path: path,
    mime_type: `image/${ext}`,
    original_filename: `image.${ext}`,
    source: { batch: "synthetic-fidelity-qa" },
  });
}
let q = {
  ...original,
  id: crypto.randomUUID(),
  prompt: "search fallback",
  prompt_rich: ast,
  explanation: "fallback",
  explanation_rich: ast,
  options: [
    { content: "CO2 + x2", content_rich: ast, correct: true },
    { content: "Plain", correct: false },
  ],
  media,
  status: "active",
};
ok(await admin.rpc("core_save_question", { value: q }));
const saved = ok(
  await admin
    .from("questions")
    .select(
      "*,question_media(*),question_options!question_options_question_id_fkey(*)",
    )
    .eq("id", q.id)
    .single(),
);
check("Plain search text derived from rich AST", saved.prompt === "CO2 + x2");
check(
  "Option and explanation formatting persisted",
  saved.question_options.some((o) => o.content_rich?.version === 1) &&
    saved.explanation_rich.version === 1,
);
check(
  "Mixed two stem and four solution attachments atomic",
  saved.question_media.length === 6,
);
const bad = {
  ...q,
  prompt_rich: {
    version: 1,
    blocks: [{ runs: [{ text: "x", marks: ["script"] }] }],
  },
};
check(
  "Unknown executable rich mark rejected",
  !!(await admin.rpc("core_save_question", { value: bad })).error,
);
check(
  "Untrusted AST attributes rejected",
  !!(
    await admin.rpc("core_save_question", {
      value: { ...q, prompt_rich: { ...ast, onclick: "bad()" } },
    })
  ).error,
);
check(
  "Failed rich edit leaves original unchanged",
  isDeepStrictEqual(
    ok(
      await admin
        .from("questions")
        .select("prompt_rich")
        .eq("id", q.id)
        .single(),
    ).prompt_rich,
    ast,
  ),
);
check(
  "Invalid media edit rejected",
  !!(
    await admin.rpc("core_save_question", {
      value: {
        ...q,
        media: [
          ...media,
          {
            ...media[0],
            id: crypto.randomUUID(),
            position: 7,
            storage_path: "missing.png",
          },
        ],
      },
    })
  ).error,
);
check(
  "Media rollback retains all relations",
  ok(await admin.from("question_media").select("id").eq("question_id", q.id))
    .length === 6,
);
const badId = crypto.randomUUID();
check(
  "Failed creation rejects whole transaction",
  !!(
    await admin.rpc("core_save_question", {
      value: {
        ...q,
        id: badId,
        media: [
          { ...media[0], id: crypto.randomUUID(), storage_path: "absent" },
        ],
      },
    })
  ).error,
);
check(
  "No partial question from failed creation",
  ok(await admin.from("questions").select("id").eq("id", badId)).length === 0,
);
check(
  "Student cannot save formatted questions",
  !!(await student.rpc("core_save_question", { value: q })).error,
);
check(
  "Student cannot read normalized media table",
  ok(await student.from("question_media").select("*").eq("question_id", q.id))
    .length === 0,
);
for (const m of media)
  check(
    `No unrelated media signature ${m.kind} ${m.position}`,
    !!(
      await outsider.storage
        .from("question-media")
        .createSignedUrl(m.storage_path, 60)
    ).error,
  );
const t = ok(
  await admin.from("tests").select("*").eq("id", fixtures.testId).single(),
);
const test = {
  ...t,
  id: crypto.randomUUID(),
  title: "Fidelity QA synthetic",
  max_attempts: 10,
  show_results: true,
  show_answers: true,
  show_explanations: true,
  status: "active",
};
ok(
  await admin.rpc("core_save_test", {
    value: test,
    question_ids: [q.id],
    batch_ids: [fixtures.batch.id],
  }),
);
const attempt = ok(
  await student.rpc("start_test_attempt", { target_test: test.id }),
);
const payload = ok(
  await student.rpc("core_attempt_payload", { target_attempt: attempt.id }),
);
check(
  "Attempt contains formatted stem/options",
  payload.questions[0].prompt_rich.version === 1 &&
    payload.questions[0].options[0].content_rich.version === 1,
);
check(
  "Solution AST/media and key absent before submission",
  !["explanation_rich", "solution_media", "correct_ids", "explanation"].some(
    (k) => k in payload.questions[0],
  ),
);
for (const m of media) {
  const result = await student.storage
    .from("question-media")
    .createSignedUrl(m.storage_path, 60);
  check(
    `Attempt authorization ${m.kind} ${m.position}`,
    m.kind === "stem" ? !result.error : !!result.error,
  );
  if (m.kind === "stem")
    check(
      `Private ${m.mime_type} returns exact bytes`,
      Buffer.from(
        await (await fetch(result.data.signedUrl)).arrayBuffer(),
      ).equals(fixturesBytes[m.mime_type.split("/")[1]]),
    );
}
ok(
  await student.rpc("save_attempt_answer", {
    target_attempt: attempt.id,
    target_question: q.id,
    option_ids: [payload.questions[0].options[0].id],
  }),
);
ok(await student.rpc("submit_test_attempt", { target_attempt: attempt.id }));
const review = ok(
  await student.rpc("get_test_review", { target_attempt: attempt.id }),
);
check(
  "Allowed review includes all ordered solution images",
  review.answers[0].solution_media.map((m) => m.position).join() === "0,1,2,3",
);
for (const m of media.filter((m) => m.kind === "solution")) {
  const signed = ok(
    await student.storage
      .from("question-media")
      .createSignedUrl(m.storage_path, 60),
  );
  check(
    `Allowed review bytes ${m.mime_type} ${m.position}`,
    Buffer.from(await (await fetch(signed.signedUrl)).arrayBuffer()).equals(
      fixturesBytes[m.mime_type.split("/")[1]],
    ),
  );
}
q = {
  ...q,
  media: media.map((m) => ({
    ...m,
    position: m.kind === "solution" ? 3 - m.position : m.position,
  })),
  prompt_rich: {
    version: 1,
    blocks: [{ runs: [{ text: "Edited", marks: ["underline"] }] }],
  },
};
ok(await admin.rpc("core_save_question", { value: q }));
check(
  "Edit reorders without duplicating relations",
  ok(
    await admin
      .from("question_media")
      .select("*")
      .eq("question_id", q.id)
      .eq("kind", "solution")
      .order("position"),
  )[0].id === media[5].id,
);
ok(await admin.rpc("core_save_question", { value: q }));
check(
  "Repeated save idempotent",
  ok(await admin.from("question_media").select("id").eq("question_id", q.id))
    .length === 6,
);
const historical = ok(
  await student.rpc("get_test_review", { target_attempt: attempt.id }),
);
check(
  "Historical formatted snapshot survives source edit",
  isDeepStrictEqual(historical.answers[0].prompt_rich, ast),
);
check(
  "Historical media order survives source reorder",
  historical.answers[0].solution_media[0].id === media[2].id,
);
const hidden = {
  ...test,
  id: crypto.randomUUID(),
  title: "Fidelity hidden review",
  show_answers: false,
  show_explanations: false,
};
ok(
  await admin.rpc("core_save_test", {
    value: hidden,
    question_ids: [q.id],
    batch_ids: [fixtures.batch.id],
  }),
);
const hiddenAttempt = ok(
  await student.rpc("start_test_attempt", { target_test: hidden.id }),
);
ok(
  await student.rpc("submit_test_attempt", {
    target_attempt: hiddenAttempt.id,
  }),
);
check(
  "Hidden review excludes answers and all rich/media payloads",
  ok(await student.rpc("get_test_review", { target_attempt: hiddenAttempt.id }))
    .answers.length === 0,
);
for (const count of [0, 1]) {
  const legacy = {
    ...original,
    id: crypto.randomUUID(),
    type: "single_mcq",
    stem_image_path: count ? media[0].storage_path : null,
    explanation_image_path: count ? media[2].storage_path : null,
    options: [
      { content: "A", correct: true },
      { content: "B", correct: false },
    ],
  };
  ok(await admin.rpc("core_save_question", { value: legacy }));
  check(
    `Legacy ${count} image per role preserved`,
    ok(
      await admin
        .from("question_media")
        .select("id")
        .eq("question_id", legacy.id),
    ).length ===
      count * 2,
  );
}
// A fresh hidden-review question cannot borrow a grant from a previous allowed review.
const hiddenPath = `${fixtures.users.admin.id}/fidelity-hidden-${crypto.randomUUID()}/image.gif`;
ok(
  await admin.storage
    .from("question-media")
    .upload(hiddenPath, fixturesBytes.gif, { contentType: "image/gif" }),
);
const hiddenQ = {
  ...q,
  id: crypto.randomUUID(),
  media: [
    {
      id: crypto.randomUUID(),
      kind: "solution",
      position: 0,
      storage_path: hiddenPath,
      mime_type: "image/gif",
      original_filename: "hidden.gif",
    },
  ],
};
ok(await admin.rpc("core_save_question", { value: hiddenQ }));
const hiddenTest = { ...hidden, id: crypto.randomUUID() };
ok(
  await admin.rpc("core_save_test", {
    value: hiddenTest,
    question_ids: [hiddenQ.id],
    batch_ids: [fixtures.batch.id],
  }),
);
const ha = ok(
  await student.rpc("start_test_attempt", { target_test: hiddenTest.id }),
);
ok(await student.rpc("submit_test_attempt", { target_attempt: ha.id }));
check(
  "Hidden-review solution signature denied after submission",
  !!(
    await student.storage.from("question-media").createSignedUrl(hiddenPath, 60)
  ).error,
);
const expiring = ok(
  await student.storage
    .from("question-media")
    .createSignedUrl(media[0].storage_path, 1),
);
await new Promise((resolve) => setTimeout(resolve, 2500));
const expired = await fetch(expiring.signedUrl, {
  headers: { "Cache-Control": "no-cache" },
});
check("Expired signed URL denied", !expired.ok);
// Restore a formatted source for browser verification without changing its prior snapshot.
q = { ...q, prompt_rich: ast };
ok(await admin.rpc("core_save_question", { value: q }));
writeFileSync(
  ".local-qa/fidelity-results.json",
  JSON.stringify(
    {
      results,
      questionId: q.id,
      testId: test.id,
      testSlug: `test-${test.id}`,
      attemptId: attempt.id,
      media,
    },
    null,
    2,
  ),
);
console.log(`Completed ${results.length} fidelity assertions.`);

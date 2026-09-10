import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { clients, ok } from "./pathology-client.mjs";
import {
  classify,
  identity,
  questionPayload,
  projectQuestion,
  questionSelect,
} from "./pathology-import-model.mjs";
const { admin, root, login } = await clients();
const manifest = JSON.parse(
  readFileSync("docs/pathology-import-manifest.json", "utf8"),
);
const input = JSON.parse(
  readFileSync(".local-qa/pathology-import-input.json", "utf8"),
);
const results = [];
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
const imported = manifest.records.filter((r) => r.question_id);
const rows = [];
for (let i = 0; i < imported.length; i += 80)
  rows.push(
    ...ok(
      await admin
        .from("questions")
        .select(questionSelect)
        .in(
          "id",
          imported.slice(i, i + 80).map((r) => r.question_id),
        ),
    ),
  );
check(
  "966 imported questions with distinct deterministic identities",
  rows.length === 966 && new Set(rows.map((r) => r.id)).size === 966,
);
let fieldsVerified = 0;
for (const q of input.filter((q) => classify(q) !== "quarantine")) {
  const expected = questionPayload(q, manifest.taxonomy, manifest.upload_owner),
    row = rows.find((r) => r.id === expected.id);
  assert.ok(
    isDeepStrictEqual(projectQuestion(row), expected),
    `Source mismatch at PATHO ${q.subhead} Q${q.source_sequence}`,
  );
  fieldsVerified++;
}
check(
  "Every imported field, option, key, rich AST, metadata and media matches source payload",
  fieldsVerified === 966,
);
check(
  "961 active and five review drafts",
  rows.filter((r) => r.status === "active").length === 961 &&
    rows.filter(
      (r) =>
        r.status === "draft" &&
        r.source_label.startsWith("CONTENT REVIEW REQUIRED"),
    ).length === 5,
);
check(
  "3864 ordered options and 966 keys",
  rows.reduce((n, r) => n + r.question_options.length, 0) === 3864 &&
    rows.reduce((n, r) => n + r.question_answer_keys.length, 0) === 966,
);
check(
  "All answer keys reference their own question options",
  rows.every((r) =>
    r.question_answer_keys.every((k) =>
      r.question_options.some((o) => o.id === k.option_id),
    ),
  ),
);
const quarantine = JSON.parse(
  readFileSync("docs/pathology-quarantine.json", "utf8"),
);
check(
  "Two recoverable quarantine records with no database question",
  quarantine.length === 2 &&
    ok(
      await root
        .from("questions")
        .select("id")
        .in(
          "id",
          quarantine.map((q) => identity(q.source_key)),
        ),
    ).length === 0,
);
check(
  "Six canonical chapters and no invented Topics",
  manifest.taxonomy.chapters.length === 6 &&
    rows.every(
      (r) =>
        r.subject_id === manifest.taxonomy.subject.id &&
        manifest.taxonomy.chapters.some((c) => c.id === r.chapter_id) &&
        r.topic_id === null &&
        r.program_id === null,
    ),
);
check(
  "79 imported previous-paper records retain exact reference and year",
  rows.filter((r) => r.source_type === "previous_exam").length === 79 &&
    rows
      .filter((r) => r.source_type === "previous_exam")
      .every((r) => String(r.exam_year) === r.source_reference.split("/")[1]),
);
check(
  "99 imported blank solutions remain blank",
  rows.filter((r) => r.explanation === "").length === 99,
);
const media = rows.flatMap((r) => r.question_media);
check(
  "Eight media relations and no orphaned question media",
  media.length === 8 &&
    media.every((m) => rows.some((r) => r.id === m.question_id)),
);
for (const m of media) {
  const blob = ok(
    await admin.storage.from("question-media").download(m.storage_path),
  );
  check(
    `Original media bytes: ${m.source.source_sequence}/${m.position}/${m.mime_type}`,
    createHash("sha256")
      .update(Buffer.from(await blob.arrayBuffer()))
      .digest("hex") === m.source.sha256,
  );
}
const q190 = rows.find(
  (r) =>
    r.id ===
    identity(
      input.find((q) => q.subhead === 1 && q.source_sequence === 190)
        .source_key,
    ),
);
check(
  "Q190 stays draft with four ordered images including GIF",
  q190.status === "draft" &&
    q190.question_media.length === 4 &&
    q190.question_media.some((m) => m.mime_type === "image/gif"),
);
const student = await login("second");
check(
  "Student cannot directly read imported questions or keys",
  ok(
    await student
      .from("questions")
      .select("id")
      .in(
        "id",
        imported.slice(0, 80).map((r) => r.question_id),
      ),
  ).length === 0 &&
    ok(
      await student
        .from("question_answer_keys")
        .select("option_id")
        .in(
          "question_id",
          imported.slice(0, 80).map((r) => r.question_id),
        ),
    ).length === 0,
);
for (const m of q190.question_media)
  check(
    `Draft Q190 image ${m.position} cannot be signed by Student`,
    !!(
      await student.storage
        .from("question-media")
        .createSignedUrl(m.storage_path, 60)
    ).error,
  );
const table = manifest.taxonomy.chapters.map((chapter, i) => ({
  subhead: `PATHO ${i + 1}`,
  source: input.filter((q) => q.subhead === i + 1).length,
  active: rows.filter(
    (r) => r.chapter_id === chapter.id && r.status === "active",
  ).length,
  draft: rows.filter((r) => r.chapter_id === chapter.id && r.status === "draft")
    .length,
  quarantined: quarantine.filter((q) => q.subhead === i + 1).length,
  images: rows
    .filter((r) => r.chapter_id === chapter.id)
    .reduce((n, r) => n + r.question_media.length, 0),
}));
writeFileSync(
  "docs/pathology-database-verification.json",
  JSON.stringify(
    {
      results,
      table,
      imported: 966,
      active: 961,
      drafts: 5,
      quarantine: 2,
      options: 3864,
      keys: 966,
      media: 8,
      previous_paper: 79,
    },
    null,
    2,
  ) + "\n",
);

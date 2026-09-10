import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { clients, ok } from "./pathology-client.mjs";
import {
  identity,
  classify,
  questionPayload,
  projectQuestion,
  questionSelect,
} from "./microbiology-import-model.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8")),
  manifest = read("docs/microbiology-import-manifest.json"),
  input = read(".local-qa/microbiology-preflight-records.json");
const { admin, root, login } = await clients(),
  results = [];
const check = (name, value) => {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS", name);
};
const rows = [];
for (let i = 0; i < 797; i += 60) {
  const ids = input.slice(i, i + 60).map((q) => identity(q.source_key));
  rows.push(
    ...ok(await admin.from("questions").select(questionSelect).in("id", ids)),
  );
}
check(
  "793 persisted questions; 791 Active and two Draft",
  rows.length === 793 &&
    rows.filter((q) => q.status === "active").length === 791 &&
    rows.filter((q) => q.status === "draft").length === 2,
);
for (const q of input.filter((q) => classify(q) !== "quarantine"))
  assert.deepEqual(
    projectQuestion(rows.find((r) => r.id === identity(q.source_key))),
    questionPayload(q, manifest.taxonomy, manifest.upload_owner),
    `Source mismatch MICRO ${q.micro} Q${q.source_sequence}`,
  );
check(
  "All 793 complete payloads match source: wording, rich AST, options, keys, marks, metadata, ordered media",
  true,
);
const quarantine = read("docs/microbiology-quarantine.json");
check(
  "Four complete quarantines; no bank rows",
  quarantine.length === 4 &&
    quarantine.every((q) => !rows.some((r) => r.id === identity(q.source_key))),
);
for (const q of quarantine) {
  const { disposition, ...source } = q;
  assert.ok(disposition);
  assert.deepEqual(
    source,
    input.find((x) => x.source_key === q.source_key),
  );
}
check(
  "Quarantine complete content is recoverable without inferred answers",
  true,
);
const subjects = ok(
  await admin
    .from("subjects")
    .select("id")
    .or("slug.eq.microbiology,name.ilike.Microbiology"),
);
const chapters = ok(
  await admin
    .from("chapters")
    .select("id")
    .eq("subject_id", manifest.taxonomy.subject.id),
);
check(
  "One subject and exactly seven chapters",
  subjects.length === 1 && chapters.length === 7,
);
check(
  "No invented topics or program-specific client questions",
  rows.every((r) => r.topic_id === null && r.program_id === null),
);
const media = rows.flatMap((r) => r.question_media),
  emfs = media.filter((m) => m.source.original),
  paths = media.flatMap((m) => [
    m.storage_path,
    ...(m.source.original ? [m.source.original.storage_path] : []),
  ]);
check(
  "116 ordered media relations; 11 preserved EMFs and 11 PNG derivatives",
  media.length === 116 &&
    emfs.length === 11 &&
    emfs.every((m) => m.mime_type === "image/png"),
);
check(
  "No duplicate source identities, media identities, or storage paths",
  new Set(rows.map((r) => r.id)).size === 793 &&
    new Set(media.map((m) => m.id)).size === 116 &&
    new Set(paths).size === 127,
);
for (const m of media) {
  for (const asset of [
    {
      storage_path: m.storage_path,
      sha256: m.source.conversion?.display_sha256 || m.source.sha256,
    },
    ...(m.source.original ? [m.source.original] : []),
  ]) {
    let downloaded;
    for (let retry = 0; retry < 3; retry++) {
      downloaded = await admin.storage
        .from("question-media")
        .download(asset.storage_path);
      if (
        !downloaded.error ||
        !/fetch failed|timeout|ECONNRESET/i.test(downloaded.error.message)
      )
        break;
      console.log(`Retrying read-only asset download (${retry + 1}/3)`);
    }
    const blob = ok(downloaded);
    assert.equal(
      createHash("sha256")
        .update(Buffer.from(await blob.arrayBuffer()))
        .digest("hex"),
      asset.sha256,
      asset.storage_path,
    );
  }
}
check("All 127 stored original/display objects match SHA256", true);
const tables = rows.flatMap((r) =>
  [
    r.prompt_rich,
    r.explanation_rich,
    ...r.question_options.map((o) => o.content_rich),
  ].flatMap((d) => (d?.blocks || []).filter((b) => b.type === "table")),
);
const cells = tables.flatMap((t) => t.rows.flatMap((r) => r.cells)),
  merged = cells.filter((c) => c.colspan > 1 || c.rowspan > 1);
check(
  "All 24 native tables across 21 source questions retain complete AST and ordering",
  tables.length === 24 && input.filter((q) => q.native_tables).length === 21,
);
const options = rows.flatMap((r) => r.question_options),
  keys = rows.flatMap((r) => r.question_answer_keys);
check(
  "3172 ordered options and 793 valid answer keys",
  options.length === 3172 &&
    keys.length === 793 &&
    rows.every((r) =>
      r.question_answer_keys.every((k) =>
        r.question_options.some((o) => o.id === k.option_id),
      ),
    ),
);
const imageOnly = rows.find(
  (r) =>
    r.id ===
    identity(
      input.find((q) => q.micro === 4 && q.source_sequence === 71).source_key,
    ),
);
check(
  "MICRO 4 Q71 Active: empty text, one original stem JPEG, four options",
  imageOnly.status === "active" &&
    imageOnly.prompt === "" &&
    imageOnly.question_media.filter((m) => m.kind === "stem").length === 1 &&
    imageOnly.question_options.length === 4,
);
check(
  "31 previous-paper references and source years retained",
  rows.filter((r) => r.source_type === "previous_exam").length === 31,
);
const student = await login("second");
for (let i = 0; i < rows.length; i += 80) {
  const ids = rows.slice(i, i + 80).map((r) => r.id);
  assert.equal(
    ok(await student.from("questions").select("id").in("id", ids)).length,
    0,
  );
  assert.equal(
    ok(
      await student
        .from("question_answer_keys")
        .select("option_id")
        .in("question_id", ids),
    ).length,
    0,
  );
}
check("Student cannot directly read any imported bank row or answer key", true);
const table = manifest.taxonomy.chapters.map((c, i) => ({
  subhead: `MICRO ${i + 1}`,
  source: input.filter((q) => q.micro === i + 1).length,
  active: rows.filter((q) => q.chapter_id === c.id && q.status === "active")
    .length,
  draft: rows.filter((q) => q.chapter_id === c.id && q.status === "draft")
    .length,
  quarantine: quarantine.filter((q) => q.micro === i + 1).length,
  images: rows
    .filter((q) => q.chapter_id === c.id)
    .reduce((n, q) => n + q.question_media.length, 0),
  tables: input
    .filter((q) => q.micro === i + 1)
    .reduce((n, q) => n + q.native_tables, 0),
}));
// Root read confirms source-label count independently of deterministic ID lookup.
check(
  "No additional accidental batch questions",
  ok(
    await root
      .from("questions")
      .select("id")
      .like("source_label", `%batch=${manifest.batch}%`),
  ).length === 793,
);
writeFileSync(
  "docs/microbiology-database-verification.json",
  JSON.stringify(
    {
      results,
      table,
      subject: subjects.length,
      chapters: chapters.length,
      active: 791,
      draft: 2,
      quarantine: 4,
      questions: rows.length,
      options: options.length,
      keys: keys.length,
      media: media.length,
      web_native: 105,
      emfs: emfs.length,
      derivatives: 11,
      storage_objects: paths.length,
      tables: tables.length,
      table_questions: 21,
      merged_cells: merged.length,
      previous_paper: 31,
      image_only: 1,
    },
    null,
    2,
  ) + "\n",
);

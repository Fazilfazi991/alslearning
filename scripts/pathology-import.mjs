import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { clients, ok, QA_REF } from "./pathology-client.mjs";
import {
  identity,
  batch,
  chapterNames,
  classify,
  questionPayload,
  projectQuestion,
  questionSelect,
} from "./pathology-import-model.mjs";
const input = JSON.parse(
  readFileSync(".local-qa/pathology-import-input.json", "utf8"),
);
if (
  input.length !== 968 ||
  input.filter((q) => classify(q) === "active").length !== 961 ||
  input.filter((q) => classify(q) === "draft").length !== 5
)
  throw Error("Preflight classification changed");
const { admin, fixture } = await clients();
const oldManifest = existsSync("docs/pathology-import-manifest.json")
  ? JSON.parse(readFileSync("docs/pathology-import-manifest.json", "utf8"))
  : null;
const owner = oldManifest?.upload_owner || fixture.users.admin.id;
const subject = ok(
  await admin.from("subjects").select("*").eq("slug", "pathology").single(),
);
const exam = ok(
  await admin.from("entrance_exams").select("*").eq("slug", "jso").single(),
);
const chapters = [];
for (const [index, name] of chapterNames.entries()) {
  const found = ok(
    await admin
      .from("chapters")
      .select("*")
      .eq("subject_id", subject.id)
      .eq("name", name),
  );
  if (found.length > 1) throw Error(`Duplicate taxonomy: ${name}`);
  chapters.push(
    found[0] ||
      ok(
        await admin
          .from("chapters")
          .insert({
            id: identity(`chapter:${name}`),
            subject_id: subject.id,
            program_id: null,
            slug: `patho-${index + 1}`,
            name,
            status: "active",
            display_order: index + 1,
          })
          .select()
          .single(),
      ),
  );
}
const taxonomy = { subject, exam, chapters };
const expected = input
  .filter((q) => classify(q) !== "quarantine")
  .map((q) => ({ q, value: questionPayload(q, taxonomy, owner) }));
const existing = new Map();
for (let i = 0; i < expected.length; i += 80)
  for (const row of ok(
    await admin
      .from("questions")
      .select(questionSelect)
      .in(
        "id",
        expected.slice(i, i + 80).map((x) => x.value.id),
      ),
  ))
    existing.set(row.id, row);
const manifest = {
  batch,
  qa_project: QA_REF,
  upload_owner: owner,
  taxonomy,
  records: [],
  images: [],
  runs: oldManifest?.runs || [],
};
const run = {
  created: 0,
  unchanged: 0,
  failed: 0,
  uploaded: 0,
  reused_images: 0,
};
// Immutable storage paths: verify existing bytes; never overwrite an existing object.
for (const { q, value } of expected)
  for (const [i, media] of value.media.entries()) {
    const bytes = readFileSync(
      `.local-qa/pathology-media/${q.media[i].sha256}`,
    );
    const downloaded = await admin.storage
      .from("question-media")
      .download(media.storage_path);
    if (downloaded.error) {
      if (
        !["400", "404"].includes(String(downloaded.error.statusCode)) &&
        !/not found/i.test(downloaded.error.message)
      )
        throw Error(downloaded.error.message);
      ok(
        await admin.storage
          .from("question-media")
          .upload(media.storage_path, bytes, {
            contentType: media.mime_type,
            upsert: false,
          }),
      );
      run.uploaded++;
    } else {
      if (
        createHash("sha256")
          .update(Buffer.from(await downloaded.data.arrayBuffer()))
          .digest("hex") !== q.media[i].sha256
      )
        throw Error("Stored media bytes differ; refusing overwrite");
      run.reused_images++;
    }
    manifest.images.push({
      ...media,
      sha256: q.media[i].sha256,
      question_id: value.id,
    });
  }
for (let i = 0; i < expected.length; i += 4) {
  await Promise.all(
    expected.slice(i, i + 4).map(async ({ q, value }) => {
      try {
        if (existing.has(value.id)) {
          if (
            !isDeepStrictEqual(projectQuestion(existing.get(value.id)), value)
          )
            throw Error(
              "Existing source identity has changed; refusing overwrite",
            );
          run.unchanged++;
        } else {
          ok(await admin.rpc("core_save_question", { value }));
          run.created++;
        }
        manifest.records.push({
          question_id: value.id,
          source_key: q.source_key,
          source_document: q.source_document,
          source_sha256: q.source_sha256,
          subhead: q.subhead,
          source_sequence: q.source_sequence,
          status: value.status,
          classification: q.content_review || "ACTIVE",
          source_type: value.source_type,
          source_reference: value.source_reference,
          exam_year: value.exam_year,
          media_ids: value.media.map((m) => m.id),
        });
      } catch (error) {
        run.failed++;
        manifest.records.push({
          question_id: value.id,
          source_key: q.source_key,
          subhead: q.subhead,
          source_sequence: q.source_sequence,
          status: "FAILED",
          reason: error.message,
        });
      }
    }),
  );
  if (i % 40 === 0)
    console.log(
      `Processed ${Math.min(i + 4, expected.length)}/${expected.length}; created ${run.created}; unchanged ${run.unchanged}; failures ${run.failed}`,
    );
}
manifest.records.push(
  ...input
    .filter((q) => classify(q) === "quarantine")
    .map((q) => ({
      question_id: null,
      source_key: q.source_key,
      source_document: q.source_document,
      source_sha256: q.source_sha256,
      subhead: q.subhead,
      source_sequence: q.source_sequence,
      status: "quarantine",
      reason: "MISSING CORRECT ANSWER",
    })),
);
manifest.records.sort(
  (a, b) => a.subhead - b.subhead || a.source_sequence - b.source_sequence,
);
manifest.runs.push(run);
writeFileSync(
  "docs/pathology-import-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify(run));
if (run.failed || run.created + run.unchanged !== 966)
  throw Error("Import totals differ: see manifest. Stop before acceptance.");

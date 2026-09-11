import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { clients, ok, QA_REF } from "./pathology-client.mjs";
import { productionImportClients } from "./production-import-client.mjs";
import {
  identity,
  batch,
  chapterNames,
  classify,
  questionPayload,
  projectQuestion,
  questionSelect,
} from "./microbiology-import-model.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const input = read(".local-qa/microbiology-preflight-records.json");
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  hash(readFileSync("docs/microbiology-preflight.json")),
  "88a3d62271a6ca124dcdee850de4dfba0df4f48e5fcc579e25869176096155af",
);
assert.deepEqual(
  ["active", "draft", "quarantine"].map(
    (s) => input.filter((q) => classify(q) === s).length,
  ),
  [791, 2, 4],
);
assert.equal(new Set(input.map((q) => q.source_key)).size, 797);
const production = process.argv.includes("--production");
const { admin, fixture, project } = await (production ? productionImportClients() : clients());
const file = `docs/${production ? "production-" : ""}microbiology-import-manifest.json`,
  prior = existsSync(file) ? read(file) : null;
const owner = prior?.upload_owner || fixture.users.admin.id;
const run = {
  created: 0,
  unchanged: 0,
  failed: 0,
  uploaded: 0,
  reused_assets: 0,
  new_subjects: 0,
  new_chapters: 0,
};
const subjects = ok(
  await admin
    .from("subjects")
    .select("*")
    .or("slug.eq.microbiology,name.ilike.Microbiology"),
);
assert.ok(subjects.length <= 1, "Duplicate Microbiology subjects");
const subject =
  subjects[0] ||
  ok(
    await admin
      .from("subjects")
      .insert({
        id: identity("microbiology:subject"),
        slug: "microbiology",
        name: "Microbiology",
        status: "active",
      })
      .select()
      .single(),
  );
if (!subjects.length) run.new_subjects++;
const exam = ok(
    await admin.from("entrance_exams").select("*").eq("slug", "jso").single(),
  ),
  chapters = [];
for (const [i, name] of chapterNames.entries()) {
  const found = ok(
    await admin
      .from("chapters")
      .select("*")
      .eq("subject_id", subject.id)
      .or(`name.eq.${name},slug.eq.micro-${i + 1}`),
  );
  assert.ok(found.length <= 1, `Duplicate chapter ${name}`);
  if (found.length)
    assert.equal(found[0].name, name, "Conflicting existing chapter");
  chapters.push(
    found[0] ||
      ok(
        await admin
          .from("chapters")
          .insert({
            id: identity(`microbiology:chapter:${name}`),
            subject_id: subject.id,
            program_id: null,
            slug: `micro-${i + 1}`,
            name,
            status: "active",
            display_order: i + 1,
          })
          .select()
          .single(),
      ),
  );
  if (!found.length) run.new_chapters++;
}
const taxonomy = { subject, exam, chapters };
const manifest = {
  batch,
  ...(production ? {production_project: project} : {qa_project: QA_REF}),
  upload_owner: owner,
  taxonomy,
  records: [],
  images: [],
  runs: prior?.runs || [],
};
const expected = input
  .filter((q) => classify(q) !== "quarantine")
  .map((q) => ({ q, value: questionPayload(q, taxonomy, owner) }));
const existing = new Map();
for (let i = 0; i < expected.length; i += 60)
  for (const r of ok(
    await admin
      .from("questions")
      .select(questionSelect)
      .in(
        "id",
        expected.slice(i, i + 60).map((x) => x.value.id),
      ),
  ))
    existing.set(r.id, r);
// Check every existing source identity before uploading or editing content.
for (const { value } of expected)
  if (existing.has(value.id))
    assert.deepEqual(
      projectQuestion(existing.get(value.id)),
      value,
      "Existing source content changed; refusing overwrite",
    );
const progressFile = `.local-qa/${production ? "production-" : ""}microbiology-import-progress.json`;
const checkpoint = () =>
  writeFileSync(
    progressFile,
    JSON.stringify({ ...manifest, runs: [...manifest.runs, run] }, null, 2) +
      "\n",
  );
async function asset(path, bytes, mime, sha, created) {
  assert.equal(hash(bytes), sha, "Local asset checksum mismatch");
  const old = await admin.storage.from("question-media").download(path);
  if (!old.error) {
    assert.equal(
      hash(Buffer.from(await old.data.arrayBuffer())),
      sha,
      "Immutable stored asset differs",
    );
    run.reused_assets++;
    return;
  }
  if (
    !["400", "404"].includes(String(old.error.statusCode)) &&
    !/not found/i.test(old.error.message)
  )
    throw Error(old.error.message);
  ok(
    await admin.storage
      .from("question-media")
      .upload(path, bytes, { contentType: mime, upsert: false }),
  );
  created.push(path);
  run.uploaded++;
}
try {
  for (const [index, { q, value }] of expected.entries()) {
    const created = [];
    try {
      for (const m of value.media) {
        const source = q.media.find(
          (x) => x.kind === m.kind && x.position === m.position,
        );
        if (source.derivative) {
          const o = m.source.original;
          await asset(
            o.storage_path,
            readFileSync(`.local-qa/microbiology-media/${o.sha256}`),
            o.mime_type,
            o.sha256,
            created,
          );
        }
        await asset(
          m.storage_path,
          readFileSync(
            source.derivative?.display.local_path ||
              `.local-qa/microbiology-media/${source.sha256}`,
          ),
          m.mime_type,
          source.derivative?.display.sha256 || source.sha256,
          created,
        );
      }
      if (existing.has(value.id)) run.unchanged++;
      else {
        ok(await admin.rpc("core_save_question", { value }));
        run.created++;
      }
    } catch (error) {
      // Resolve an uncertain RPC outcome before deleting newly uploaded assets.
      const persisted = ok(
        await admin
          .from("questions")
          .select(questionSelect)
          .eq("id", value.id)
          .maybeSingle(),
      );
      if (!persisted && created.length)
        ok(await admin.storage.from("question-media").remove(created));
      run.failed++;
      manifest.failure = {
        source_key: q.source_key,
        micro: q.micro,
        index: q.source_sequence,
        reason: error.message,
        question_persisted: !!persisted,
      };
      checkpoint();
      throw error;
    }
    manifest.records.push({
      question_id: value.id,
      source_key: q.source_key,
      source_document: q.source_document,
      source_sha256: q.source_sha256,
      micro: q.micro,
      source_sequence: q.source_sequence,
      status: value.status,
      classification: q.classification,
      review_reasons: q.review_reasons,
      source_metadata: q.source_metadata,
      source_reference: value.source_reference,
      exam_year: value.exam_year,
      media_ids: value.media.map((m) => m.id),
      native_tables: q.native_tables,
    });
    manifest.images.push(
      ...value.media.map((m) => ({ ...m, question_id: value.id })),
    );
    checkpoint();
    if (index % 40 === 0)
      console.log(
        `Processed ${index + 1}/793; created=${run.created}; unchanged=${run.unchanged}`,
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
        micro: q.micro,
        source_sequence: q.source_sequence,
        status: "quarantine",
        reasons: q.quarantine_reasons,
        manifest: "docs/microbiology-quarantine.json",
      })),
  );
  manifest.records.sort(
    (a, b) => a.micro - b.micro || a.source_sequence - b.source_sequence,
  );
  checkpoint();
  assert.equal(run.created + run.unchanged, 793);
  // Publish only a complete manifest; readers must never see an in-flight prefix.
  renameSync(progressFile, file);
  console.log(JSON.stringify(run));
} catch (error) {
  console.error("STOP: Import failed; no later records attempted.");
  throw error;
}

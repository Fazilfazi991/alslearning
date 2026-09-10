// Run the existing security suite using an existing synthetic test, then restore it.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { clients, ok } from "./pathology-client.mjs";
const { root, admin, fixture } = await clients();
const id = JSON.parse(readFileSync(".local-qa/native-table-qa.json", "utf8"))
  .test.id;
const test = ok(await admin.from("tests").select("*").eq("id", id).single());
if (!test.title.startsWith("QA ONLY"))
  throw Error("Existing synthetic test required");
const questions = ok(
  await admin
    .from("test_questions")
    .select("*")
    .eq("test_id", id)
    .order("display_order"),
);
const batches = ok(
  await admin.from("test_batches").select("*").eq("test_id", id),
);
const content = ok(
  await admin
    .from("learning_content")
    .select("id,display_order")
    .eq("program_id", fixture.program.id),
);
const source = readFileSync("scripts/core-security-qa.mjs", "utf8")
  .replace("id: crypto.randomUUID(),", `id: '${id}', status: 'active',`)
  .replace("max_attempts: 3,", "max_attempts: 100,");
writeFileSync(".local-qa/core-security-existing.mjs", source);
try {
  const run = spawnSync(
    process.execPath,
    ["--env-file=.env.local", ".local-qa/core-security-existing.mjs"],
    { stdio: "inherit" },
  );
  if (run.status) throw Error(`Core security suite failed: ${run.status}`);
  writeFileSync(
    "docs/media-core-security-verification.json",
    readFileSync(".local-qa/additional-results.json"),
  );
} finally {
  // Restore the exact fixture, including archived questions rejected by authoring RPCs.
  ok(await root.from("tests").update(test).eq("id", id));
  ok(await root.from("test_questions").delete().eq("test_id", id));
  if (questions.length) ok(await root.from("test_questions").insert(questions));
  ok(await root.from("test_batches").delete().eq("test_id", id));
  if (batches.length) ok(await root.from("test_batches").insert(batches));
  for (const row of content)
    ok(
      await root
        .from("learning_content")
        .update({ display_order: row.display_order })
        .eq("id", row.id),
    );
}

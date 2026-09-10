import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classify,
  identity,
  questionPayload,
  chapterNames,
} from "./microbiology-import-model.mjs";
const input = JSON.parse(
  readFileSync(".local-qa/microbiology-preflight-records.json", "utf8"),
);
const taxonomy = {
  subject: { id: "subject" },
  exam: { id: "exam" },
  chapters: chapterNames.map((name, i) => ({ id: `chapter-${i}`, name })),
};
test("Exact classification and distinct source occurrence identities", () => {
  assert.deepEqual(
    ["active", "draft", "quarantine"].map(
      (s) => input.filter((q) => classify(q) === s).length,
    ),
    [791, 2, 4],
  );
  assert.equal(new Set(input.map((q) => identity(q.source_key))).size, 797);
  assert.throws(() => classify({ classification: "TECHNICAL BLOCKER" }));
});
test("All original and display relationships retain hashes and source order", () => {
  let count = 0;
  for (const q of input) {
    const value = questionPayload(q, taxonomy, "owner");
    for (const m of value.media) {
      const source = q.media.find(
        (s) => s.kind === m.kind && s.position === m.position,
      );
      assert.equal(m.source.sha256, source.sha256);
      assert.equal(m.source.relationship, source.relationship);
      if (source.derivative) {
        count++;
        assert.equal(m.mime_type, "image/png");
        assert.equal(m.source.original.sha256, source.sha256);
        assert.equal(
          m.source.conversion.display_sha256,
          source.derivative.display.sha256,
        );
        assert.notEqual(m.storage_path, m.source.original.storage_path);
      }
    }
  }
  assert.equal(count, 11);
});
test("Q71 retains empty prompt and source alt text; review records retain original keys", () => {
  const q = input.find((q) => q.micro === 4 && q.source_sequence === 71),
    value = questionPayload(q, taxonomy, "owner");
  assert.equal(value.prompt, "");
  assert.equal(value.media.length, 1);
  assert.deepEqual(
    value.options,
    q.options.map(({ content, content_rich, correct }) => ({
      content,
      content_rich,
      correct,
    })),
  );
  for (const q of input.filter((q) => classify(q) === "draft")) {
    const value = questionPayload(q, taxonomy, "owner");
    assert.equal(value.status, "draft");
    assert.match(value.source_label, /CONTENT REVIEW REQUIRED/);
    assert.deepEqual(
      value.options.map((o) => o.correct),
      q.options.map((o) => o.correct),
    );
  }
});
test("Repeated payload generation is identical and all native tables retained", () => {
  for (const q of input)
    assert.deepEqual(
      questionPayload(q, taxonomy, "owner"),
      questionPayload(q, taxonomy, "owner"),
    );
  assert.equal(
    input.reduce((n, q) => n + q.native_tables, 0),
    24,
  );
});

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  batch,
  classify,
  identity,
  sourceMetadata,
} from "../../scripts/pathology-import-model.mjs";
describe("Pathology import identity and status policy", () => {
  it("keeps source sequence distinct but repeated import stable", () => {
    expect(identity("hash:209")).toBe(identity("hash:209"));
    expect(identity("hash:209")).not.toBe(identity("hash:294"));
    expect(identity("hash:209")).toMatch(/^[a-f0-9-]{14}5/);
  });
  it("never activates conflicts or creates incomplete questions", () => {
    expect(classify({ structural_errors: [], answer_conflict: false })).toBe(
      "active",
    );
    expect(classify({ structural_errors: [], answer_conflict: true })).toBe(
      "draft",
    );
    expect(
      classify({
        structural_errors: ["Missing correct answer"],
        answer_conflict: false,
      }),
    ).toBe("quarantine");
  });
  it("preserves exact paper references and uses the existing canonical enum", () => {
    const q = {
      source_reference_candidates: ["069/2023"],
      source_document: "client.docx",
      source_sequence: 9,
      source_key: "hash:9",
      answer_conflict: true,
    };
    const result = sourceMetadata(q, "PATHO 6");
    expect(result.source_reference).toBe("069/2023");
    expect(result.exam_year).toBe(2023);
    expect(result.source_type).toBe("previous_exam");
    expect(result.source_label).toContain("CONTENT REVIEW REQUIRED");
    expect(result.source_label).toContain(batch);
    expect(() =>
      sourceMetadata(
        { ...q, source_reference_candidates: ["069/2023", "052/2022"] },
        "PATHO 6",
      ),
    ).toThrow("Ambiguous");
  });
});
describe.skipIf(!existsSync(".local-qa/pathology-import-input.json"))(
  "real local import inputs",
  () => {
    it("reconciles exactly and retains original markers/solutions", () => {
      const input = JSON.parse(
        readFileSync(".local-qa/pathology-import-input.json", "utf8"),
      );
      expect(input.filter((q: never) => classify(q) === "active")).toHaveLength(
        961,
      );
      expect(input.filter((q: never) => classify(q) === "draft")).toHaveLength(
        5,
      );
      expect(
        input.filter((q: never) => classify(q) === "quarantine"),
      ).toHaveLength(2);
      const q = input.find(
        (q: { subhead: number; source_sequence: number }) =>
          q.subhead === 1 && q.source_sequence === 190,
      );
      expect(q.options[1].source_designation).toBe("Correct");
      expect(q.explanation.trim()).toBe("Ans: C");
      expect(q.media).toHaveLength(4);
    });
  },
);

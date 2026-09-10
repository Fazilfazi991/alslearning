import { describe, expect, it } from "vitest";
import {
  editText,
  formatText,
  fromPlain,
  marks,
  plainText,
  validRichText,
} from "./rich-text";
import { imageTypes, orderedMedia, type QuestionMedia } from "./question-media";
describe("source fidelity", () => {
  it("preserves ordinary Unicode and paragraphs", () => {
    const text = "μ µ β α ≥ ≤ ± → × °C Fe²⁺ CO₂ 10%\nnext\n\nlast";
    expect(plainText(fromPlain(text))).toBe(text);
  });
  it("preserves a line break inside a paragraph during formatting and edits", () => {
    const doc = { version: 1 as const, blocks: [{ runs: [{ text: "a\nb", marks: [] }] }] };
    const next = editText(formatText(doc, 0, 1, "bold"), "a\nb!");
    expect(next.blocks).toHaveLength(1);
    expect(plainText(next)).toBe("a\nb!");
  });
  for (const mark of marks)
    it(`preserves ${mark} on unchanged save`, () => {
      const doc = formatText(fromPlain("CO2"), 2, 3, mark);
      expect(validRichText(doc)).toBe(true);
      expect(doc.blocks[0].runs[1].marks).toEqual([mark]);
      expect(editText(doc, "CO2")).toBe(doc);
      expect(editText(doc, "CO2!").blocks[0].runs[1].marks).toEqual([mark]);
    });
  it("preserves mixed marks and unaffected ranges after editing", () => {
    const doc = formatText(
      formatText(fromPlain("first\nCO2"), 6, 9, "bold"),
      8,
      9,
      "subscript",
    );
    const edited = editText(doc, "first!\nCO2");
    expect(plainText(edited)).toBe("first!\nCO2");
    expect(edited.blocks[1].runs.at(-1)?.marks).toEqual(["bold", "subscript"]);
  });
  it("does not accept HTML attributes, arbitrary marks, or malformed AST", () => {
    expect(
      validRichText({ ...fromPlain("ok"), html: "<script>bad()</script>" }),
    ).toBe(false);
    expect(
      validRichText({
        version: 1,
        blocks: [{ runs: [{ text: "x", marks: ["onclick"] }] }],
      }),
    ).toBe(false);
    expect(validRichText({ version: 1 })).toBe(false);
    expect(validRichText(fromPlain('<img src=x onerror="bad()">'))).toBe(true); // literal text, never HTML
  });
  it("snapshot copies retain original formatting after source edits", () => {
    const original = formatText(fromPlain("x2"), 1, 2, "superscript"),
      snapshot = structuredClone(original);
    editText(original, "changed");
    expect(plainText(snapshot)).toBe("x2");
    expect(snapshot.blocks[0].runs[1].marks).toEqual(["superscript"]);
  });
  for (const count of [0, 1, 4])
    it(`orders ${count} media without dropping repeated paths`, () => {
      const media: QuestionMedia[] = Array.from(
        { length: count },
        (_, position) => ({
          id: `${position}`,
          kind: "solution" as const,
          storage_path: "same.png",
          mime_type: "image/png",
          original_filename: "same.png",
          position,
        }),
      ).reverse();
      expect(orderedMedia(media, "solution").map((m) => m.position)).toEqual(
        Array.from({ length: count }, (_, i) => i),
      );
      expect(orderedMedia(media, "stem")).toEqual([]);
    });
  it("supports GIF/PNG/JPEG/WebP and excludes executable formats", () => {
    expect(imageTypes).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ]);
    expect(imageTypes).not.toContain("image/svg+xml");
  });
});

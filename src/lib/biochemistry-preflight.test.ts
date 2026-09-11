import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { plainText, validRichText, type RichText } from "./rich-text";

const path = ".local-qa/biochemistry-preflight-records.json";
type Source = {
  bio: number;
  source_sequence: number;
  prompt: string;
  prompt_rich: RichText;
  explanation: string;
  explanation_rich: RichText;
  options: { content: string; content_rich: RichText; correct: boolean }[];
};

describe.skipIf(!existsSync(path))("local Biochemistry canonical AST acceptance", () => {
  const records: Source[] = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : [];

  it("accepts every source stem, option and solution with identical plain text", () => {
    expect(records).toHaveLength(714);
    for (const q of records) {
      for (const [doc, text] of [
        [q.prompt_rich, q.prompt],
        [q.explanation_rich, q.explanation],
        ...q.options.map((o) => [o.content_rich, o.content] as const),
      ] as const) {
        expect(validRichText(doc), `BIO ${q.bio} Q${q.source_sequence}`).toBe(true);
        expect(plainText(doc)).toBe(text);
      }
    }
  });

  it("retains all eight content tables through JSON snapshot serialization", () => {
    const copied: Source[] = JSON.parse(JSON.stringify(records));
    const tables = copied.flatMap((q) => [q.prompt_rich, q.explanation_rich])
      .flatMap((d) => d.blocks).filter((b) => "type" in b && b.type === "table");
    expect(tables).toHaveLength(8);
    expect(copied).toEqual(records);
  });
});

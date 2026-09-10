import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { RichContent } from "../components/learning/rich-text";
import {
  editText,
  fromPlain,
  mediaPositions,
  plainText,
  validRichText,
  type RichText,
  type TableBlock,
} from "./rich-text";

const cell = (text: string, colspan = 1, rowspan = 1, header = false) => ({
  content: fromPlain(text),
  colspan,
  rowspan,
  header,
});
const table = (): TableBlock => ({
  type: "table",
  columns: 2,
  rows: [
    { cells: [cell("Heading", 2, 1, true)] },
    { cells: [cell("CO₂ β 10⁵"), cell("")] },
  ],
});
const doc = (): RichText => ({
  version: 2,
  blocks: [
    { runs: [{ text: "Before", marks: [] }] },
    table(),
    { type: "media", position: 0 },
    { runs: [{ text: "After", marks: [] }] },
  ],
});

describe("native table fidelity", () => {
  it.skipIf(!existsSync(".local-qa/native-table-source-fixtures.json"))(
    "validates and renders every source table without database imports",
    () => {
      const fixtures = JSON.parse(
        readFileSync(".local-qa/native-table-source-fixtures.json", "utf8"),
      );
      let count = 0;
      const rendered: string[] = [];
      for (const q of fixtures)
        for (const key of ["prompt_rich", "explanation_rich"]) {
          expect(validRichText(q[key])).toBe(true);
          const sourceTables = q[key].blocks.filter(
            (b: { type?: string }) => b.type === "table",
          );
          for (const sourceTable of sourceTables) {
            const value: RichText = { version: 2, blocks: [sourceTable] };
            const html = renderToStaticMarkup(
              <RichContent value={value} fallback="" />,
            );
            expect((html.match(/<table /g) || []).length).toBe(1);
            expect((html.match(/<tr>/g) || []).length).toBe(
              sourceTable.rows.length,
            );
            rendered.push(
              `<article data-table="${count}"><h2>${q.source_document} Q${q.source_sequence}</h2>${html}</article>`,
            );
            count++;
          }
        }
      expect(count).toBe(24);
      writeFileSync(
        ".local-qa/native-source-render.html",
        `<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px sans-serif;margin:16px}article{max-width:100%;margin:24px 0}h2{font-size:16px;overflow-wrap:anywhere}.overflow-x-auto{overflow-x:auto}.max-w-full{max-width:100%}.min-w-0{min-width:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;min-width:8rem;padding:8px;vertical-align:top}div{white-space:pre-wrap;overflow-wrap:break-word}</style></head><body>${rendered.join("\n")}</body></html>`,
      );
    },
  );
  it("keeps order, merges, empty cells and readable search text", () => {
    expect(validRichText(doc())).toBe(true);
    expect(plainText(doc())).toBe("Before\nHeading\nCO₂ β 10⁵\t\n\nAfter");
    expect(mediaPositions(doc())).toEqual([0]);
    const original = doc();
    expect(editText(original, plainText(original))).toBe(original);
    expect(() => editText(original, "flattened")).toThrow();
  });
  it("validates 1x1 tables, rowspans and rejects overlapping or incomplete grids", () => {
    expect(
      validRichText({
        version: 2,
        blocks: [
          { type: "table", columns: 1, rows: [{ cells: [cell("one")] }] },
        ],
      }),
    ).toBe(true);
    const merged = {
      version: 2,
      blocks: [
        {
          type: "table",
          columns: 2,
          rows: [
            { cells: [cell("a", 1, 2), cell("b")] },
            { cells: [cell("c")] },
          ],
        },
      ],
    };
    expect(validRichText(merged)).toBe(true);
    merged.blocks[0].rows[1].cells.push(cell("overlap"));
    expect(validRichText(merged)).toBe(false);
    const incomplete = table();
    incomplete.rows[1].cells.pop();
    expect(validRichText({ version: 2, blocks: [incomplete] })).toBe(false);
  });
  it("preserves cell paragraphs and rich marks in semantic escaped HTML", () => {
    const t = table();
    t.rows[1].cells[0].content = {
      version: 1,
      blocks: [
        {
          runs: [
            { text: "2", marks: ["superscript", "bold"] },
            { text: "x", marks: ["subscript", "italic", "underline"] },
          ],
        },
        { runs: [{ text: '<img src=x onerror="bad()">', marks: [] }] },
      ],
    };
    const html = renderToStaticMarkup(
      <RichContent value={{ version: 2, blocks: [t] }} fallback="" />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain('colSpan="2"');
    expect(html).toContain("<sup>");
    expect(html).toContain("<sub>");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("overflow-x-auto");
  });
  it("rejects arbitrary keys, URLs, marks, invalid spans and excessive nesting", () => {
    for (const patch of [
      { onclick: "bad()" },
      { html: "<script/>" },
      { colspan: 0 },
      { rowspan: -1 },
      { header: "yes" },
    ]) {
      const t = table();
      Object.assign(t.rows[0].cells[0], patch);
      expect(validRichText({ version: 2, blocks: [t] })).toBe(false);
    }
    expect(
      validRichText({
        version: 2,
        blocks: [{ type: "media", position: 0, url: "javascript:bad()" }],
      }),
    ).toBe(false);
    let nested: RichText = fromPlain("x");
    for (let i = 0; i < 10; i++)
      nested = {
        version: 2,
        blocks: [
          {
            type: "table",
            columns: 1,
            rows: [{ cells: [{ ...cell(""), content: nested }] }],
          },
        ],
      };
    expect(validRichText(nested)).toBe(false);
  });
  it("immutable snapshots keep the original cell after source edits", () => {
    const original = doc(),
      snapshot = structuredClone(original);
    if ("rows" in original.blocks[1])
      original.blocks[1].rows[0].cells[0].content = fromPlain("changed");
    expect(plainText(snapshot)).toContain("Heading");
    expect(plainText(original)).toContain("changed");
  });
});

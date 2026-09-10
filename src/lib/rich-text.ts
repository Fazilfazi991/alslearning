export const marks = [
  "bold",
  "italic",
  "underline",
  "superscript",
  "subscript",
] as const;
export type Mark = (typeof marks)[number];
export type Run = { text: string; marks: Mark[] };
export type Paragraph = { runs: Run[] };
export type LegacyRichText = { version: 1; blocks: Paragraph[] };
export type TableCell = {
  content: RichText;
  colspan: number;
  rowspan: number;
  header: boolean;
};
export type TableBlock = {
  type: "table";
  columns: number;
  rows: { cells: TableCell[]; before?: number; after?: number }[];
};
export type MediaBlock = { type: "media"; position: number };
export type Block = Paragraph | TableBlock | MediaBlock;
export type RichText = LegacyRichText | { version: 2; blocks: Block[] };
export function mediaPositions(value: unknown): number[] {
  if (!validRichText(value)) return [];
  return value.blocks.flatMap((b) =>
    "runs" in b
      ? []
      : b.type === "media"
        ? [b.position]
        : b.rows.flatMap((r) =>
            r.cells.flatMap((c) => mediaPositions(c.content)),
          ),
  );
}
export function plainText(doc: RichText): string {
  return doc.blocks
    .map((b) =>
      "runs" in b
        ? b.runs.map((r) => r.text).join("")
        : b.type === "media"
          ? ""
          : b.rows
              .map((row) =>
                row.cells.map((cell) => plainText(cell.content)).join("\t"),
              )
              .join("\n"),
    )
    .join("\n");
}
export function fromPlain(text: string): LegacyRichText {
  return {
    version: 1,
    blocks: text.split("\n").map((text) => ({ runs: [{ text, marks: [] }] })),
  };
}
export function validRichText(value: unknown, depth = 0): value is RichText {
  if (depth > 8) return false;
  if (!value || typeof value !== "object") return false;
  const d = value as RichText;
  if (
    Object.keys(d).some((k) => !["version", "blocks"].includes(k)) ||
    ![1, 2].includes(d.version) ||
    !Array.isArray(d.blocks)
  )
    return false;
  return d.blocks.every((b) => {
    if (!b || typeof b !== "object") return false;
    if (!("runs" in b)) {
      if (d.version !== 2) return false;
      if (b.type === "media")
        return (
          Object.keys(b).length === 2 &&
          Number.isInteger(b.position) &&
          b.position >= 0 &&
          b.position <= 2147483647
        );
      if (
        b.type !== "table" ||
        Object.keys(b).length !== 3 ||
        !Number.isInteger(b.columns) ||
        b.columns < 1 ||
        b.columns > 100 ||
        !Array.isArray(b.rows) ||
        b.rows.length < 1 ||
        b.rows.length > 1000
      )
        return false;
      const occupied: boolean[][] = Array.from({ length: b.rows.length }, () =>
        Array(b.columns).fill(false),
      );
      return b.rows.every((row, ri) => {
        if (
          !row ||
          Object.keys(row).some(
            (k) => !["cells", "before", "after"].includes(k),
          ) ||
          !Array.isArray(row.cells)
        )
          return false;
        const before = row.before ?? 0,
          after = row.after ?? 0;
        if (
          ("before" in row && typeof row.before !== "number") ||
          ("after" in row && typeof row.after !== "number") ||
          !Number.isInteger(before) ||
          !Number.isInteger(after) ||
          before < 0 ||
          after < 0 ||
          before + after >= b.columns
        )
          return false;
        for (let c = 0; c < b.columns; c++)
          if (c < before || c >= b.columns - after) {
            if (occupied[ri][c]) return false;
            occupied[ri][c] = true;
          }
        let column = before;
        for (const cell of row.cells) {
          while (occupied[ri][column]) column++;
          if (
            !cell ||
            Object.keys(cell).length !== 4 ||
            typeof cell.header !== "boolean" ||
            !Number.isInteger(cell.colspan) ||
            !Number.isInteger(cell.rowspan) ||
            cell.colspan < 1 ||
            cell.rowspan < 1 ||
            column + cell.colspan > b.columns ||
            ri + cell.rowspan > b.rows.length ||
            !validRichText(cell.content, depth + 1)
          )
            return false;
          for (let r = ri; r < ri + cell.rowspan; r++)
            for (let c = column; c < column + cell.colspan; c++) {
              if (occupied[r][c]) return false;
              occupied[r][c] = true;
            }
          column += cell.colspan;
        }
        return occupied[ri].every(Boolean);
      });
    }
    return (
      Object.keys(b).length === 1 &&
      Array.isArray(b.runs) &&
      b.runs.every(
        (r) =>
          r &&
          Object.keys(r).length === 2 &&
          typeof r.text === "string" &&
          Array.isArray(r.marks) &&
          r.marks.every((m) => marks.includes(m)) &&
          new Set(r.marks).size === r.marks.length &&
          !(r.marks.includes("superscript") && r.marks.includes("subscript")),
      )
    );
  });
}
type Unit = Run & { boundary?: boolean };
function units(doc: LegacyRichText): Unit[] {
  return doc.blocks.flatMap((b, i) => [
    ...(i ? [{ text: "\n", marks: [] as Mark[], boundary: true }] : []),
    ...b.runs.flatMap((r) =>
      r.text.split("").map((text) => ({ text, marks: [...r.marks] })),
    ),
  ]);
}
function assemble(items: Unit[]): LegacyRichText {
  const doc: LegacyRichText = { version: 1, blocks: [{ runs: [] }] };
  for (const item of items) {
    if (item.boundary) {
      doc.blocks.push({ runs: [] });
      continue;
    }
    const runs = doc.blocks.at(-1)!.runs,
      last = runs.at(-1);
    if (last && JSON.stringify(last.marks) === JSON.stringify(item.marks))
      last.text += item.text;
    else runs.push({ text: item.text, marks: item.marks });
  }
  return doc;
}
// Apply the smallest text edit; preserve formatting outside that range.
export function editText<T extends RichText>(doc: T, next: string): T {
  const old = plainText(doc);
  if (old === next) return doc;
  if (doc.version !== 1)
    throw new Error("Edit structured content one paragraph or cell at a time");
  let start = 0,
    end = 0;
  while (
    start < old.length &&
    start < next.length &&
    old[start] === next[start]
  )
    start++;
  while (
    end < old.length - start &&
    end < next.length - start &&
    old[old.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  const items = units(doc),
    inherited = items[Math.max(0, start - 1)]?.marks || [];
  return assemble([
    ...items.slice(0, start),
    ...next
      .slice(start, next.length - end)
      .split("")
      .map((text) => ({
        text,
        marks: [...inherited],
        boundary: text === "\n",
      })),
    ...items.slice(old.length - end),
  ]) as T;
}
export function formatText<T extends RichText>(
  doc: T,
  start: number,
  end: number,
  mark: Mark,
): T {
  if (start === end) return doc;
  if (doc.version !== 1)
    throw new Error(
      "Format structured content one paragraph or cell at a time",
    );
  const items = units(doc),
    remove = items.slice(start, end).every((r) => r.marks.includes(mark));
  return assemble(
    items.map((r, i) => {
      if (i < start || i >= end) return r;
      const next = r.marks.filter(
        (m) =>
          m !== mark &&
          !(mark === "superscript" && m === "subscript") &&
          !(mark === "subscript" && m === "superscript"),
      );
      return { ...r, marks: remove ? next : [...next, mark] };
    }),
  ) as T;
}

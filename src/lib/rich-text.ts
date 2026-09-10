export const marks = [
  "bold",
  "italic",
  "underline",
  "superscript",
  "subscript",
] as const;
export type Mark = (typeof marks)[number];
export type Run = { text: string; marks: Mark[] };
export type RichText = { version: 1; blocks: { runs: Run[] }[] };
export function plainText(doc: RichText): string {
  return doc.blocks.map((b) => b.runs.map((r) => r.text).join("")).join("\n");
}
export function fromPlain(text: string): RichText {
  return {
    version: 1,
    blocks: text.split("\n").map((text) => ({ runs: [{ text, marks: [] }] })),
  };
}
export function validRichText(value: unknown): value is RichText {
  if (!value || typeof value !== "object") return false;
  const d = value as RichText;
  if (
    Object.keys(d).some((k) => !["version", "blocks"].includes(k)) ||
    d.version !== 1 ||
    !Array.isArray(d.blocks)
  )
    return false;
  return d.blocks.every(
    (b) =>
      b &&
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
      ),
  );
}
type Unit = Run & { boundary?: boolean };
function units(doc: RichText): Unit[] {
  return doc.blocks.flatMap((b, i) => [
    ...(i ? [{ text: "\n", marks: [] as Mark[], boundary: true }] : []),
    ...b.runs.flatMap((r) =>
      r.text.split("").map((text) => ({ text, marks: [...r.marks] })),
    ),
  ]);
}
function assemble(items: Unit[]): RichText {
  const doc: RichText = { version: 1, blocks: [{ runs: [] }] };
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
export function editText(doc: RichText, next: string): RichText {
  const old = plainText(doc);
  if (old === next) return doc;
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
      .map((text) => ({ text, marks: [...inherited], boundary: text === "\n" })),
    ...items.slice(old.length - end),
  ]);
}
export function formatText(
  doc: RichText,
  start: number,
  end: number,
  mark: Mark,
): RichText {
  if (start === end) return doc;
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
  );
}

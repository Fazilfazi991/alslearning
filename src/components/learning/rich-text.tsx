import { Fragment, type ReactNode } from "react";
import { validRichText } from "@/lib/rich-text";
import type { QuestionMedia } from "@/lib/question-media";
import { PrivateImage } from "./private-image";
export function RichContent({
  value,
  fallback,
  media = [],
  kind = "stem",
}: {
  value?: unknown;
  fallback: string | null;
  media?: QuestionMedia[];
  kind?: "stem" | "solution";
}) {
  if (!validRichText(value))
    return <span className="whitespace-pre-wrap break-words">{fallback}</span>;
  return (
    <div className="min-w-0 max-w-full whitespace-pre-wrap break-words">
      {value.blocks.map((b, i) => {
        if (!("runs" in b)) {
          if (b.type === "media") {
            const item = media.find(
              (m) => m.kind === kind && m.position === b.position,
            );
            return (
              <PrivateImage
                key={i}
                path={item?.storage_path || null}
                alt={`${kind === "stem" ? "Question" : "Solution"} image ${b.position + 1}`}
              />
            );
          }
          return (
            <div
              key={i}
              className="my-3 max-w-full overflow-x-auto rounded border"
              role="region"
              aria-label="Content table"
              tabIndex={0}
            >
              <table className="w-full border-collapse text-left text-sm font-normal">
                <tbody>
                  {b.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.before ? (
                        <td
                          colSpan={row.before}
                          aria-hidden="true"
                          className="border-0"
                        />
                      ) : null}
                      {row.cells.map((cell, ci) => {
                        const Cell = cell.header ? "th" : "td";
                        return (
                          <Cell
                            key={ci}
                            colSpan={cell.colspan}
                            rowSpan={cell.rowspan}
                            scope={cell.header ? "col" : undefined}
                            className="min-w-32 border px-3 py-2 align-top"
                          >
                            <RichContent
                              value={cell.content}
                              fallback=""
                              media={media}
                              kind={kind}
                            />
                          </Cell>
                        );
                      })}
                      {row.after ? (
                        <td
                          colSpan={row.after}
                          aria-hidden="true"
                          className="border-0"
                        />
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <div key={i} className="min-h-[1em]">
            {b.runs.map((r, j) => {
              let node: ReactNode = r.text;
              for (const mark of r.marks) {
                if (mark === "bold") node = <strong>{node}</strong>;
                if (mark === "italic") node = <em>{node}</em>;
                if (mark === "underline") node = <u>{node}</u>;
                if (mark === "superscript") node = <sup>{node}</sup>;
                if (mark === "subscript") node = <sub>{node}</sub>;
              }
              return <Fragment key={j}>{node}</Fragment>;
            })}
          </div>
        );
      })}
    </div>
  );
}

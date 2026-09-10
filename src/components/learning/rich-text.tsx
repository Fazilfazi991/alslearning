import { Fragment, type ReactNode } from "react";
import { validRichText } from "@/lib/rich-text";
export function RichContent({
  value,
  fallback,
}: {
  value?: unknown;
  fallback: string | null;
}) {
  if (!validRichText(value))
    return <span className="whitespace-pre-wrap break-words">{fallback}</span>;
  return (
    <span className="whitespace-pre-wrap break-words">
      {value.blocks.map((b, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
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
        </Fragment>
      ))}
    </span>
  );
}

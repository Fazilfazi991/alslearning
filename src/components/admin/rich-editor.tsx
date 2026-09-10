"use client";
import { useRef } from "react";
import {
  editText,
  formatText,
  fromPlain,
  marks,
  plainText,
  type RichText,
} from "@/lib/rich-text";
import { RichContent } from "@/components/learning/rich-text";
import type { QuestionMedia } from "@/lib/question-media";
export function RichEditor({
  label,
  text,
  value,
  onChange,
  disabled = false,
  media,
  kind,
}: {
  label: string;
  text: string;
  value?: RichText | null;
  media?: QuestionMedia[];
  kind?: "stem" | "solution";
  disabled?: boolean;
  onChange: (text: string, value: RichText) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const doc = value || fromPlain(text);
  if (doc.version === 2)
    return (
      <div className="min-w-0 space-y-3">
        <p className="text-xs text-muted">
          Edit paragraph and cell text below. Table rows, merges and content
          order are preserved.
        </p>
        {doc.blocks.map((block, bi) => {
          const update = (next: typeof block) => {
            const result: RichText = {
              ...doc,
              blocks: doc.blocks.map((b, i) => (i === bi ? next : b)),
            };
            onChange(plainText(result), result);
          };
          if ("runs" in block)
            return (
              <RichEditor
                key={bi}
                label={`${label} paragraph ${bi + 1}`}
                text={plainText({ version: 1, blocks: [block] })}
                value={{ version: 1, blocks: [block] }}
                disabled={disabled}
                onChange={(_, next) => {
                  if (next.version !== 1) return;
                  const result: RichText = {
                    ...doc,
                    blocks: doc.blocks.flatMap((b, i) =>
                      i === bi ? next.blocks : [b],
                    ),
                  };
                  onChange(plainText(result), result);
                }}
              />
            );
          if (block.type === "media")
            return (
              <RichContent
                key={bi}
                value={{ version: 2, blocks: [block] }}
                fallback=""
                media={media}
                kind={kind}
              />
            );
          return (
            <div
              key={bi}
              className="max-w-full overflow-x-auto"
              role="region"
              aria-label={`${label} editable table`}
              tabIndex={0}
            >
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.before ? (
                        <td colSpan={row.before} aria-hidden="true" />
                      ) : null}
                      {row.cells.map((cell, ci) => (
                        <td
                          key={ci}
                          colSpan={cell.colspan}
                          rowSpan={cell.rowspan}
                          className="min-w-56 border p-2 align-top"
                        >
                          <RichEditor
                            label={`${label} table ${bi + 1} row ${ri + 1} cell ${ci + 1}`}
                            text={plainText(cell.content)}
                            value={cell.content}
                            disabled={disabled}
                            media={media}
                            kind={kind}
                            onChange={(_, content) =>
                              update({
                                ...block,
                                rows: block.rows.map((r, rj) =>
                                  rj === ri
                                    ? {
                                        ...r,
                                        cells: r.cells.map((c, cj) =>
                                          cj === ci ? { ...c, content } : c,
                                        ),
                                      }
                                    : r,
                                ),
                              })
                            }
                          />
                        </td>
                      ))}
                      {row.after ? (
                        <td colSpan={row.after} aria-hidden="true" />
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <div aria-label={`${label} formatted preview`}>
          <RichContent value={doc} fallback={text} media={media} kind={kind} />
        </div>
      </div>
    );
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div
        className="flex flex-wrap gap-1"
        role="toolbar"
        aria-label={`${label} formatting`}
      >
        {marks.map((mark) => (
          <button
            key={mark}
            type="button"
            disabled={disabled}
            className="min-h-11 rounded border px-2 text-xs capitalize"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              const next = formatText(
                doc,
                el.selectionStart,
                el.selectionEnd,
                mark,
              );
              onChange(plainText(next), next);
              el.focus();
            }}
          >
            {mark}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        aria-label={label}
        disabled={disabled}
        value={text}
        className="min-h-20 w-full min-w-0 rounded-lg border p-3 text-sm"
        onChange={(e) =>
          onChange(e.target.value, editText(doc, e.target.value))
        }
      />
      <div
        className="rounded bg-slate-50 p-2 text-sm"
        aria-label={`${label} formatted preview`}
      >
        <RichContent value={doc} fallback={text} media={media} kind={kind} />
      </div>
    </div>
  );
}

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
export function RichEditor({
  label,
  text,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  text: string;
  value?: RichText | null;
  disabled?: boolean;
  onChange: (text: string, value: RichText) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const doc = value || fromPlain(text);
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
        <RichContent value={doc} fallback={text} />
      </div>
    </div>
  );
}

"use client";
import { loadQuestionPreview } from "@/lib/test-repository";
import { useEffect, useState } from "react";
import type { Question } from "@/lib/core-repository";
import { questionLabel } from "@/lib/question-media";
import { mediaPositions } from "@/lib/rich-text";
import { RichContent } from "@/components/learning/rich-text";
import { QuestionGallery } from "@/components/learning/question-gallery";

function sourceIdentity(q: Question) {
  const parts = (q.source_label || "").split("|").map((part) => part.trim());
  return [parts.find((part) => /^Q\d+$/.test(part)), parts[0] || q.source_reference]
    .filter(Boolean).join(" · ");
}

export function QuestionPreview({ question }: { question: Question }) {
 const [q,setQ]=useState(question.options.length ? question : null);
 const [error,setError]=useState("");
 useEffect(()=>{if(question.options.length)return;let live=true;loadQuestionPreview(question.id).then(value=>{if(live)setQ(value);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[question]);
 if(!q)return <p role="status" className="p-3 text-sm">{error || "Loading question preview…"}</p>;
  return (
    <div className="min-w-0 space-y-3 border-t border-line p-3 text-sm">
      <RichContent value={q.prompt_rich} fallback={q.prompt} media={q.media} />
      <QuestionGallery kind="stem" legacy={q.stem_image_path}
        media={q.media?.filter((m) => !mediaPositions(q.prompt_rich).includes(m.position) || m.kind !== "stem")} />
      <ol className="space-y-2">
        {q.options.map((option, i) => (
          <li key={i} className="flex min-w-0 gap-2">
            <span>{String.fromCharCode(65 + i)}.</span>
            <RichContent value={option.content_rich} fallback={option.content} />
          </li>
        ))}
      </ol>
      <p className="font-semibold">Explanation</p>
      <RichContent value={q.explanation_rich} fallback={q.explanation} media={q.media} kind="solution" />
      <QuestionGallery kind="solution" legacy={q.explanation_image_path}
        media={q.media?.filter((m) => !mediaPositions(q.explanation_rich).includes(m.position) || m.kind !== "solution")} />
    </div>
  );
}

export function TestQuestionPicker({ questions, selected, onChange, page:controlledPage, total:controlledTotal, pageSize=10, onPageChange }: {
  questions: Question[];
  selected: string[];
  onChange: (ids: string[]) => void;
  page?: number;
  total?: number;
  pageSize?: number;
  onPageChange?: (page:number)=>void;
}) {
  const [localPage, setLocalPage] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const remote=onPageChange!==undefined;
  const page=controlledPage??localPage;
  const total=controlledTotal??questions.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rows=remote?questions:questions.slice(page * pageSize, (page + 1) * pageSize);
  const changePage=(next:number)=>{setPreview(null);if(onPageChange)onPageChange(next);else setLocalPage(next);};
  return (
    <div className="min-w-0 space-y-3">
      <div className="divide-y divide-line rounded-lg border border-line">
        {rows.map((q) => (
          <div key={q.id} className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 px-3 py-1">
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 text-sm">
                <input className="size-5 shrink-0" type="checkbox" checked={selected.includes(q.id)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, q.id] : selected.filter((id) => id !== q.id))} />
                <span className="min-w-0">
                  <span className="line-clamp-2 break-words">{questionLabel(q)}</span>
                  <span className="block truncate text-xs text-muted">{sourceIdentity(q)} · {q.marks} marks</span>
                </span>
              </label>
              <button type="button" className="min-h-11 shrink-0 px-2 text-sm font-semibold text-brand"
                aria-expanded={preview === q.id} aria-controls={`preview-${q.id}`}
                aria-label={`Preview ${questionLabel(q)}`}
                onClick={() => setPreview(preview === q.id ? null : q.id)}>
                {preview === q.id ? "Close" : "Preview"}
              </button>
            </div>
            {preview === q.id && <div id={`preview-${q.id}`}><QuestionPreview question={q} /></div>}
          </div>
        ))}
        {!questions.length && <p className="p-3 text-sm">No active questions match this search and scope.</p>}
      </div>
      <nav aria-label="Question pages" className="flex items-center justify-between gap-2 text-sm">
        <button type="button" className="min-h-11 px-3 disabled:opacity-40" disabled={!page}
          onClick={() => changePage(page - 1)}>Previous</button>
        <span>Page {page + 1} of {pages}</span>
        <button type="button" className="min-h-11 px-3 disabled:opacity-40" disabled={page + 1 >= pages}
          onClick={() => changePage(page + 1)}>Next</button>
      </nav>
    </div>
  );
}

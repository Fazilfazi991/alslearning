"use client";
import { useEffect, useRef } from "react";
import type { CoreData, Taxonomy } from "@/lib/core-repository";
export const fieldClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm";
export const actionClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  items,
  required = false,
  emptyLabel,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
  required?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        className={fieldClass}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">
          {emptyLabel ?? (required ? "Select…" : "Any / optional")}
        </option>
        {items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function TaxonomyFields({
  value,
  onChange,
  data,
  programRequired = false,
  subjectRequired = true,
  sectionMode = false,
}: {
  value: Taxonomy;
  onChange: (v: Taxonomy) => void;
  data: CoreData;
  programRequired?: boolean;
  subjectRequired?: boolean;
  sectionMode?: boolean;
}) {
  const allowed = (v: Partial<Taxonomy>) =>
    data.role === "admin" ||
    data.assignments.some(
      (a) =>
        (!v.exam_id || !a.exam_id || a.exam_id === v.exam_id) &&
        (!v.program_id || !a.program_id || a.program_id === v.program_id) &&
        (!v.subject_id || !a.subject_id || a.subject_id === v.subject_id),
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Select
        label="Entrance exam"
        value={value.exam_id}
        required
        items={data.exams.filter((e) => allowed({ exam_id: e.id }))}
        onChange={(v) =>
          onChange({
            ...value,
            exam_id: v,
            program_id: "",
            subject_id: "",
            chapter_id: "",
            topic_id: "",
          })
        }
      />
      <Select
        label="Program"
        value={value.program_id}
        required={
          programRequired ||
          (data.role === "teacher" &&
            data.assignments.every((a) => !!a.program_id))
        }
        items={data.programs.filter(
          (p) =>
            (!p.exam_id || p.exam_id === value.exam_id) &&
            allowed({ exam_id: value.exam_id, program_id: p.id }),
        )}
        onChange={(v) =>
          onChange({
            ...value,
            program_id: v,
            subject_id: "",
            chapter_id: "",
            topic_id: "",
          })
        }
      />
      <Select
        label="Subject"
        value={value.subject_id}
        required={
          subjectRequired ||
          (data.role === "teacher" &&
            data.assignments.every((a) => !!a.subject_id))
        }
        items={data.subjects.filter(
          (s) =>
            (!value.program_id ||
              data.mappings.some(
                (m) =>
                  m.program_id === value.program_id && m.subject_id === s.id,
              )) &&
            allowed({ ...value, subject_id: s.id }),
        )}
        onChange={(v) =>
          onChange({ ...value, subject_id: v, chapter_id: "", topic_id: "" })
        }
      />
      <Select
        label={sectionMode ? "Section / sub-head" : "Chapter"}
        disabled={sectionMode && !value.subject_id}
        emptyLabel={sectionMode
          ? (value.subject_id
            ? `All ${data.subjects.find((s) => s.id === value.subject_id)?.name ?? "subject"} sections`
            : "Choose a subject first")
          : undefined}
        value={value.chapter_id}
        items={data.chapters.filter((x) => x.subject_id === value.subject_id)}
        onChange={(v) => onChange({ ...value, chapter_id: v, topic_id: "" })}
      />
      <Select
        label="Topic"
        value={value.topic_id}
        items={data.topics.filter(
          (x) =>
            x.subject_id === value.subject_id &&
            (!value.chapter_id || x.chapter_id === value.chapter_id),
        )}
        onChange={(v) => onChange({ ...value, topic_id: v })}
      />
    </div>
  );
}
export function StatusField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select
      label="Publication status"
      value={value}
      onChange={onChange}
      required
      items={[
        { id: "draft", name: "Draft / inactive" },
        { id: "active", name: "Active / published" },
        { id: "archived", name: "Archived" },
      ]}
    />
  );
}
export function BatchesField({
  value,
  program,
  data,
  onChange,
}: {
  value: string[];
  program: string;
  data: CoreData;
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset className="rounded-lg border border-line p-4">
      <legend className="px-1 text-sm font-semibold">Batch restriction</legend>
      <p className="mb-2 text-xs text-muted">
        Leave empty for all eligible enrollments in the program.
      </p>
      {data.batches
        .filter((x) => x.program_id === program)
        .map((x) => (
          <label
            key={x.id}
            className="flex min-h-11 items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={value.includes(x.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, x.id]
                    : value.filter((id) => id !== x.id),
                )
              }
            />
            {x.name}
          </label>
        ))}
    </fieldset>
  );
}
export function Editor({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="core-editor-title"
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border border-line bg-white p-0 backdrop:bg-black/40"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white p-4">
        <h2 id="core-editor-title" className="text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          className="min-h-11 min-w-11 rounded border px-3"
          onClick={close}
          aria-label="Close editor"
        >
          ×
        </button>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </dialog>
  );
}

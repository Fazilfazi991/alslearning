"use client";
import {
  eligibleTestQuestions,
  hasTestScope,
  testSelectionError,
} from "@/lib/test-question-scope";
import { useAuthorIdentity } from "./author-identity";
import { LoadedTestForm } from "./loaded-test-form";
import { TestScopeFields } from "./test-scope-fields";
import { inferTestScope, retainAllowedSelections } from "@/lib/test-question-scope";
import { QuestionPreview, TestQuestionPicker } from "./test-question-picker";
import { localDateTime } from "@/lib/core-time";
import { useCallback, useEffect, useState } from "react";
import {
  loadCoreData,
  saveCoreQuestion,
  saveCoreTest,
  saveCoreContent,
  moveCoreContent,
  uploadCoreFile,
  newQuestion,
  newTest,
  newContent,
  type Question,
  type Test,
  type Content,
  type CoreData,
  canManage,
} from "@/lib/core-repository";
import {
  Field,
  Select,
  Editor,
  TaxonomyFields,
  StatusField,
  BatchesField,
  fieldClass as input,
  actionClass as button,
} from "./core-fields";
import { RichEditor } from "./rich-editor";
import {
  imageTypes,
  orderedMedia,
  type QuestionMedia,
} from "@/lib/question-media";
import { PrivateImage } from "@/components/learning/private-image";
import { mediaAlt, questionLabel, conversionLabel } from "@/lib/question-media";
import { loadAdminTestResults, loadQuestionPreview, loadTestQuestionPage, type TestQuestionPage } from "@/lib/test-repository";

const adminDate = (value?: string) => value
  ? `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`
  : "Not saved";

export function AdminTestResults({ value }: { value: Record<string, unknown> }) {
  const attempts = Array.isArray(value.attempts)
    ? value.attempts.filter((attempt): attempt is Record<string, unknown> => !!attempt && typeof attempt === "object")
    : [];
  return (
    <div className="space-y-3 rounded-lg bg-surface p-4 text-sm">
      <p><b>{String(value.attempt_count ?? 0)}</b> attempts · Average score {String(value.average_score ?? "—")}</p>
      {attempts.length === 0 ? <p className="text-muted">No Student attempts yet.</p> : (
        <ul className="grid gap-3" aria-label="Student attempt results">
          {attempts.map((attempt, index) => (
            <li key={`${String(attempt.student)}-${String(attempt.started_at)}-${index}`} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-bold">{String(attempt.student ?? "Student")} · Attempt {String(attempt.attempt_number ?? "—")}</p>
                <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold capitalize">{String(attempt.status ?? "unknown").replaceAll("_", " ")}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <p><span className="block text-xs text-muted">Started</span>{adminDate(typeof attempt.started_at === "string" ? attempt.started_at : undefined)}</p>
                <p><span className="block text-xs text-muted">Submitted</span>{adminDate(typeof attempt.submitted_at === "string" ? attempt.submitted_at : undefined)}</p>
                <p><span className="block text-xs text-muted">Score</span>{String(attempt.score ?? "—")}</p>
                <p><span className="block text-xs text-muted">Correct</span>{String(attempt.correct ?? 0)}</p>
                <p><span className="block text-xs text-muted">Incorrect</span>{String(attempt.incorrect ?? 0)}</p>
                <p><span className="block text-xs text-muted">Unanswered</span>{String(attempt.unanswered ?? 0)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CoreManager({
  mode,
}: {
  mode: "questions" | "tests" | "content";
}) {
  const actor = useAuthorIdentity();
  const [data, setData] = useState<CoreData | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Question | Test | Content | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [subject, setSubject] = useState(""),
    [chapter, setChapter] = useState(""),
    [testType, setTestType] = useState(""),
    [program, setProgram] = useState(""),
    [sourceType, setSourceType] = useState(""),
    [reviewOnly, setReviewOnly] = useState(false),
    [page, setPage] = useState(0);
  const refresh = useCallback(async () => {
    setError("");
    setData(await loadCoreData(mode, actor));
  }, [mode, actor]);
  useEffect(() => {
    let live = true;
    void loadCoreData(mode, actor)
      .then((v) => {
        if (live) setData(v);
      })
      .catch(() => {
        if (live) setError("Could not load records. Please retry.");
      });
    return () => {
      live = false;
    };
  }, [mode, actor]);
  async function run(fn: () => Promise<void>, close = false) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      await refresh();
      if (close) setEditing(null);
      setSuccess("Saved successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="card space-y-4 p-6" role={error ? "alert" : "status"} aria-label={error ? undefined : "Loading academic records"}>
        {error ? error : <><div className="skeleton h-6 w-40 rounded"/><div className="skeleton h-14 rounded"/><div className="skeleton h-14 rounded"/></>}
        {error && (
          <button
            className={button}
            onClick={() => void refresh().catch(() => setError("Could not load records. Please retry."))}
          >
            Retry
          </button>
        )}
      </section>
    );
  const formData = {
    ...data,
    assignments: data.assignments.filter(
      (a) =>
        a[
          mode === "questions"
            ? "can_manage_questions"
            : mode === "tests"
              ? "can_manage_tests"
              : "can_manage_content"
        ],
    ),
  };
  const title = {
    questions: "Question Bank",
    tests: "Test Authoring",
    content: "Videos & Materials",
  }[mode];
  const rows = (
    mode === "questions"
      ? data.questions
      : mode === "tests"
        ? data.tests
        : data.content
  ).filter((x) => {
    const isQuestion = "prompt" in x;
    const searchable = isQuestion
      ? [
          questionLabel(x),
          x.source_label,
          x.source_reference,
          x.exam_year,
          data.subjects.find((s) => s.id === x.subject_id)?.name,
          data.chapters.find((c) => c.id === x.chapter_id)?.name,
        ].join(" ")
      : x.title;
    return (
      canManage(data, mode, x) &&
      (!status || x.status === status) &&
      (mode !== "tests" || !testType || ("type" in x && x.type === testType)) &&
      (mode !== "tests" || !program || x.program_id === program) &&
      (mode !== "tests" || !subject || ("selection_rules" in x && (x.subject_id === subject || x.selection_rules.scopes?.some((scope) => scope.subject_id === subject)))) &&
      (!isQuestion ||
        ((!subject || x.subject_id === subject) &&
          (!chapter || x.chapter_id === chapter) &&
          (!sourceType || x.source_type === sourceType) &&
          (!reviewOnly ||
            x.source_label?.includes("CONTENT REVIEW REQUIRED")))) &&
      searchable.toLowerCase().includes(search.toLowerCase())
    );
  });
  return (
    <div className="min-w-0">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            Manage published learning content and drafts.
          </p>
        </div>
        <button
          className={button}
          disabled={!canManage(data, mode)}
          onClick={() =>
            setEditing(
              mode === "questions"
                ? newQuestion()
                : mode === "tests"
                  ? newTest()
                  : newContent(),
            )
          }
        >
          Add{" "}
          {mode === "questions"
            ? "question"
            : mode === "tests"
              ? "test"
              : "content"}
        </button>
      </header>
      {success && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-green-50 p-3 text-green-900"
        >
          {success}
        </p>
      )}
      {error && !editing && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Field label="Search">
          <input
            className={input}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </Field>
        <Select
          label="Filter by status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
          items={["draft", "active", "archived"].map((x) => ({
            id: x,
            name: x,
          }))}
        />
      </div>
      {mode === "questions" && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Select
            label="Filter by subject"
            value={subject}
            items={data.subjects}
            onChange={(v) => {
              setSubject(v);
              setChapter("");
              setPage(0);
            }}
          />
          <Select
            label="Filter by chapter"
            value={chapter}
            items={data.chapters.filter(
              (c) => !subject || c.subject_id === subject,
            )}
            onChange={(v) => {
              setChapter(v);
              setPage(0);
            }}
          />
          <Select
            label="Filter by source"
            value={sourceType}
            items={[
              { id: "standard", name: "Regular" },
              { id: "previous_exam", name: "Previous paper" },
              { id: "recalled", name: "Recalled" },
            ]}
            onChange={(v) => {
              setSourceType(v);
              setPage(0);
            }}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reviewOnly}
              onChange={(e) => {
                setReviewOnly(e.target.checked);
                setPage(0);
              }}
            />
            Content review required only
          </label>
        </div>
      )}
      {mode === "tests" && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Select label="Filter by type" value={testType} items={[{id:"practice",name:"Practice"},{id:"mock",name:"Mock"}]} onChange={(v)=>{setTestType(v);setPage(0);}} />
          <Select label="Filter by program" value={program} items={data.programs} onChange={(v)=>{setProgram(v);setPage(0);}} />
          <Select label="Filter by subject" value={subject} items={data.subjects} onChange={(v)=>{setSubject(v);setPage(0);}} />
        </div>
      )}
      <div className="space-y-3">
        {rows.slice(page * 20, page * 20 + 20).map((x) => (
          <article className="card min-w-0 p-4" key={x.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold uppercase text-brand">
                  {x.status}
                </span>
                <h2 className="mt-1 break-words font-bold">
                  {"prompt" in x ? questionLabel(x) : x.title}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {data.subjects.find((s) => s.id === x.subject_id)?.name}
                  {"type" in x
                    ? ` · ${x.type.replaceAll("_", " ")}`
                    : ` · ${x.kind}`}
                </p>
                {"prompt" in x && (
                  <>
                    <p className="mt-1 break-words text-sm text-muted">
                      {data.chapters.find((c) => c.id === x.chapter_id)?.name}
                    </p>
                    {x.source_label?.includes("CONTENT REVIEW REQUIRED") && (
                      <p className="mt-1 font-semibold text-amber-800">
                        Content review required
                      </p>
                    )}
                    {x.source_reference && (
                      <p className="text-sm text-muted">
                        Previous paper: {x.source_reference}
                      </p>
                    )}
                  </>
                )}
                {"total_marks" in x && (
                  <div className="mt-2 grid gap-1 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
                    <p>{x.question_count} questions · {x.duration_minutes} min</p>
                    <p>{x.total_marks ?? "Per attempt"} marks</p>
                    <p>{x.max_attempts === null ? "Unlimited" : x.max_attempts} attempts</p>
                    <p>{data.programs.find((p) => p.id === x.program_id)?.name || "No program"}</p>
                    <p className="sm:col-span-2">{x.available_from ? adminDate(x.available_from) : "Available immediately"} → {x.available_until ? adminDate(x.available_until) : "No end date"}</p>
                    <p className="sm:col-span-2">Updated {adminDate(x.updated_at)}</p>
                  </div>
                )}
              </div>
              <button
                className="min-h-11 rounded-lg border px-4 font-semibold"
                onClick={() => {
                  setError("");
                  setEditing(x);
                }}
              >
                View / edit
              </button>
              {"kind" in x && data.role === "admin" && (
                <div className="flex gap-2">
                  <button
                    aria-label={`Move ${x.title} up`}
                    disabled={busy}
                    className="min-h-11 min-w-11 rounded border"
                    onClick={() => void run(() => moveCoreContent(x.id, -1))}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${x.title} down`}
                    disabled={busy}
                    className="min-h-11 min-w-11 rounded border"
                    onClick={() => void run(() => moveCoreContent(x.id, 1))}
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
        {!rows.length && (
          <p className="card p-6">
            No matching records. Add content or change the filters.
          </p>
        )}
      </div>
      <nav
        aria-label="Record pages"
        className="mt-4 flex items-center justify-between gap-3"
      >
        <button
          className="min-h-11 rounded border px-3"
          disabled={!page}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span className="text-sm">{rows.length} records</span>
        <button
          className="min-h-11 rounded border px-3"
          disabled={(page + 1) * 20 >= rows.length}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </nav>
      {editing && (
        <Editor
          title={`${rows.some(row=>row.id===editing.id)?"Edit":"Add"} ${mode === "questions" ? "question" : mode === "tests" ? "test" : "content"}`}
          close={() => {
            if (!busy) setEditing(null);
          }}
        >
          {error && (
            <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-red-800">
              {error}
            </p>
          )}
          {mode === "questions" ? (
            <QuestionForm
              value={editing as Question}
              data={formData}
              busy={busy}
              save={(v) => run(() => saveCoreQuestion(v), true)}
            />
          ) : mode === "tests" ? (
            <LoadedTestForm
              value={editing as Test}
              data={formData}
              busy={busy}
              save={(v) => run(() => saveCoreTest(v), true)}
            />
          ) : (
            <ContentForm
              value={editing as Content}
              data={formData}
              busy={busy}
              save={(v) => run(() => saveCoreContent(v), true)}
            />
          )}
        </Editor>
      )}
    </div>
  );
}
function Section({
  title,
  children,
  open = false,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="rounded-lg border border-line p-4">
      <summary className="cursor-pointer font-bold">{title}</summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        required
        min={min}
        step={step}
        disabled={disabled}
        className={input}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}
function MediaField({
  label,
  kind,
  id,
  media,
  onChange,
  onBusy,
}: {
  label: string;
  kind: "stem" | "solution";
  id: string;
  media: QuestionMedia[];
  onChange: (items: QuestionMedia[]) => void;
  onBusy: (v: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const items = orderedMedia(media, kind);
  const change = (next: QuestionMedia[]) =>
    onChange([
      ...media.filter((m) => m.kind !== kind),
      ...next.map((m, position) => ({ ...m, position })),
    ]);
  return (
    <div className="space-y-2">
      <Field label={label}>
        <input
          type="file"
          multiple
          accept={imageTypes.join(",")}
          disabled={busy}
          className={`${input} max-w-full`}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            setBusy(true);
            onBusy(true);
            setError("");
            const additions: QuestionMedia[] = [];
            try {
              for (const file of files) {
                if (!imageTypes.includes(file.type))
                  throw Error("Use PNG, JPEG, WebP, or GIF images.");
                const path = await uploadCoreFile(file, "question-media", id);
                additions.push({
                  id: crypto.randomUUID(),
                  kind,
                  storage_path: path,
                  mime_type: file.type,
                  original_filename: file.name,
                  position: items.length + additions.length,
                });
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : "Upload failed");
            } finally {
              change([...items, ...additions]);
              setBusy(false);
              onBusy(false);
            }
          }}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((m, i) => (
          <div key={m.id} className="min-w-0 rounded border p-2">
            <details>
              <summary className="min-h-11 cursor-pointer break-all text-sm">
                {i + 1}. {m.original_filename || "Image"} — preview
              </summary>
              <PrivateImage
                path={m.storage_path}
                alt={mediaAlt(m, `${label} ${i + 1}`)}
              />
              {conversionLabel(m) && (
                <p className="text-xs text-muted">{conversionLabel(m)}</p>
              )}
            </details>
            <div className="flex flex-wrap gap-2">
              {[-1, 1].map((d) => (
                <button
                  type="button"
                  className="min-h-11 rounded border px-2"
                  key={d}
                  disabled={busy || i + d < 0 || i + d >= items.length}
                  onClick={() => {
                    const next = [...items];
                    [next[i], next[i + d]] = [next[i + d], next[i]];
                    change(next);
                  }}
                >
                  {d < 0 ? "Move up" : "Move down"}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                className="min-h-11 px-2"
                onClick={() => change(items.filter((x) => x.id !== m.id))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function QuestionForm({
  value,
  data,
  busy,
  save,
}: {
  value: Question;
  data: CoreData;
  busy: boolean;
  save: (q: Question) => Promise<void>;
}) {
  const [q, setQ] = useState(value),
    [uploads, setUploads] = useState(0);
  const onBusy = (busy: boolean) => setUploads((n) => n + (busy ? 1 : -1));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save(q);
      }}
    >
      <Section title="Question and answers" open>
        <TaxonomyFields
          value={q}
          data={data}
          canonicalProgramLabel={Boolean(q.id) && q.program_id == null}
          onChange={(v) => setQ({ ...q, ...v })}
        />
        <Select
          label="Question type"
          value={q.type}
          required
          onChange={(v) =>
            setQ({
              ...q,
              type: v,
              options:
                v === "true_false"
                  ? [
                      { content: "True", correct: true },
                      { content: "False", correct: false },
                    ]
                  : q.options.map((o, i) => ({
                      ...o,
                      correct: v === "multiple_mcq" ? o.correct : i === 0,
                    })),
            })
          }
          items={[
            ["single_mcq", "Single-answer MCQ"],
            ["multiple_mcq", "Multiple-answer MCQ"],
            ["true_false", "True / False"],
            ["image_mcq", "Image-based question"],
            ["case_based", "Case-based question"],
          ].map(([id, name]) => ({ id, name }))}
        />
        <p className="text-xs text-muted">
          Matching is disabled until a dedicated pair editor and scorer are
          available. Case studies use a shared text stem with one correct
          option.
        </p>
        <Field label="Question / case text">
          <RichEditor
            label="Question / case text"
            text={q.prompt}
            value={q.prompt_rich}
            media={q.media}
            kind="stem"
            onChange={(prompt, prompt_rich) =>
              setQ({ ...q, prompt, prompt_rich })
            }
          />
        </Field>
        <MediaField
          label="Question images"
          kind="stem"
          id={q.id}
          media={q.media || []}
          onBusy={onBusy}
          onChange={(media) => setQ((current) => ({ ...current, media }))}
        />
        <fieldset className="space-y-3">
          <legend className="mb-2 font-semibold">
            Options — select the correct answer
            {q.type === "multiple_mcq" ? "s" : ""}
          </legend>
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                aria-label={`Correct option ${i + 1}`}
                type={q.type === "multiple_mcq" ? "checkbox" : "radio"}
                name="correct-option"
                checked={o.correct}
                onChange={(e) =>
                  setQ({
                    ...q,
                    options: q.options.map((x, n) => ({
                      ...x,
                      correct:
                        n === i
                          ? e.target.checked
                          : q.type === "multiple_mcq"
                            ? x.correct
                            : false,
                    })),
                  })
                }
              />
              <Field label={`Option ${i + 1}`}>
                <RichEditor
                  label={`Option ${i + 1}`}
                  text={o.content}
                  value={o.content_rich}
                  disabled={q.type === "true_false"}
                  onChange={(content, content_rich) =>
                    setQ({
                      ...q,
                      options: q.options.map((x, n) =>
                        n === i ? { ...x, content, content_rich } : x,
                      ),
                    })
                  }
                />
              </Field>
            </div>
          ))}
        </fieldset>
      </Section>
      <Section title="Explanation and marking" open>
        <Field label="Explanation">
          <RichEditor
            label="Explanation"
            text={q.explanation || ""}
            value={q.explanation_rich}
            media={q.media}
            kind="solution"
            onChange={(explanation, explanation_rich) =>
              setQ({ ...q, explanation, explanation_rich })
            }
          />
        </Field>
        <MediaField
          label="Solution images"
          kind="solution"
          id={q.id}
          media={q.media || []}
          onBusy={onBusy}
          onChange={(media) => setQ((current) => ({ ...current, media }))}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Difficulty"
            value={q.difficulty}
            required
            onChange={(v) => setQ({ ...q, difficulty: v })}
            items={["easy", "medium", "hard"].map((id) => ({ id, name: id }))}
          />
          <NumberField
            label="Marks"
            value={q.marks}
            min={0.25}
            step={0.25}
            onChange={(v) => setQ({ ...q, marks: v })}
          />
          <NumberField
            label="Negative marks"
            value={q.negative_marks}
            step={0.25}
            onChange={(v) => setQ({ ...q, negative_marks: v })}
          />
        </div>
      </Section>
      <Section title="Source / previous-paper metadata">
        <Select
          label="Source type"
          value={q.source_type}
          required
          onChange={(v) => setQ({ ...q, source_type: v })}
          items={[
            { id: "standard", name: "Regular" },
            { id: "previous_exam", name: "Previous paper" },
            { id: "recalled", name: "Recalled" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["source_reference", "Exam reference"],
              ["exam_year", "Year"],
              ["exam_session", "Session / reference number"],
              ["source_label", "Source label"],
            ] as const
          ).map(([key, label]) => (
            <Field label={label} key={key}>
              <input
                className={input}
                type={key === "exam_year" ? "number" : "text"}
                value={q[key] || ""}
                onChange={(e) => setQ({ ...q, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Section>
      <StatusField
        value={q.status}
        onChange={(v) => setQ({ ...q, status: v })}
      />
      <button disabled={busy || uploads > 0} className={`${button} w-full`}>
        {uploads ? "Uploading images…" : busy ? "Saving…" : "Save question"}
      </button>
    </form>
  );
}
export function TestForm({
  value,
  data,
  busy,
  save,
  remoteQuestions = false,
}: {
  value: Test;
  data: CoreData;
  busy: boolean;
  save: (q: Test) => Promise<void>;
  remoteQuestions?: boolean;
}) {
  const [t, setT] = useState(() => inferTestScope(data, value)),
    [search, setSearch] = useState("");
  const [visibleSubject, setVisibleSubject] = useState(""), [visibleSection, setVisibleSection] = useState("");
  const [questionPage,setQuestionPage]=useState(0);
  const [bank,setBank]=useState<{key:string;status:"ready"|"error";value:TestQuestionPage;error?:string}>({key:"",status:"ready",value:{rows:[],total:0,scope_total:0,by_subject:{}}});
  const [previewOpen,setPreviewOpen]=useState(false);
  const [previewQuestion,setPreviewQuestion]=useState<Question|null>(null);
  const [previewLoading,setPreviewLoading]=useState(false);
  const [previewError,setPreviewError]=useState("");
  const [results,setResults]=useState<Record<string,unknown>|null>(null);
  const [resultsError,setResultsError]=useState("");
  const [resultsLoading,setResultsLoading]=useState(false);
  const scoped = hasTestScope(data, t);
  const examId=t.exam_id,programId=t.program_id,subjectId=t.subject_id,chapterId=t.chapter_id,topicId=t.topic_id,selectionRules=t.selection_rules;
  const bankKey=JSON.stringify([examId,programId,subjectId,chapterId,topicId,selectionRules,questionPage,search,visibleSubject,visibleSection]);
  useEffect(()=>{
    if(!remoteQuestions||!scoped){return;}
    let live=true;
    const scope={exam_id:examId,program_id:programId,subject_id:subjectId,chapter_id:chapterId,topic_id:topicId,selection_rules:selectionRules};
    void loadTestQuestionPage(scope,questionPage,search,visibleSubject,visibleSection).then(value=>{if(live)setBank({key:bankKey,status:"ready",value});}).catch(error=>{if(live)setBank(current=>({...current,key:bankKey,status:"error",error:error.message}));});
    return()=>{live=false;};
  },[remoteQuestions,scoped,examId,programId,subjectId,chapterId,topicId,selectionRules,questionPage,search,visibleSubject,visibleSection,bankKey]);
  const bankStatus=bank.key===bankKey?bank.status:"loading";
  const eligible = remoteQuestions ? bank.value.rows : eligibleTestQuestions(data, t);
  const available = remoteQuestions ? bank.value.scope_total : eligible.length;
  const selectionError = remoteQuestions ? (()=>{
    if(!scoped)return "Choose a subject and a valid section within the program first.";
    if(bankStatus==="loading")return "Loading current question availability…";
    if(bankStatus==="error")return "Question availability could not be loaded. Retry before publishing.";
    if(!available)return "No active questions are available for this scope.";
    if(t.selection_mode==="generated"){
      if(t.selection_rules.scopes){for(const scope of t.selection_rules.scopes){const count=bank.value.by_subject[scope.subject_id]||0;if(!Number.isInteger(scope.count)||!scope.count||scope.count<1||scope.count>count)return `Choose 1–${count} questions for ${data.subjects.find(x=>x.id===scope.subject_id)?.name}.`; }return null;}
      return Number.isInteger(t.question_count)&&t.question_count>0&&t.question_count<=available?null:`Choose between 1 and ${available} available active questions.`;
    }
    return t.question_ids.length>0&&new Set(t.question_ids).size===t.question_ids.length?null:"Select at least one active question.";
  })() : testSelectionError(data, t);
  const blockingError=t.status==="active"?selectionError:!t.title.trim()?"Enter a title to save this Draft.":null;
  const subject = data.subjects.find((s) => s.id === t.subject_id);
  const section = data.chapters.find((s) => s.id === t.chapter_id);
  const total = eligible
    .filter((q) => t.question_ids.includes(q.id))
    .reduce((s, q) => s + Number(q.marks), 0);
  async function togglePreview(){
    if(previewOpen){setPreviewOpen(false);return;}
    setPreviewOpen(true);setPreviewQuestion(null);setPreviewError("");
    if(!scoped)return;
    setPreviewLoading(true);
    try{
      let questionId=t.selection_mode==="manual"?t.question_ids[0]:undefined;
      if(!questionId){const sample=await loadTestQuestionPage(t,0,"",visibleSubject,visibleSection);questionId=sample.rows[0]?.id;}
      if(questionId)setPreviewQuestion(await loadQuestionPreview(questionId));
      else setPreviewError("No representative active question is available for this configuration.");
    }catch(error){setPreviewError(error instanceof Error?error.message:"Preview could not be loaded.");}
    finally{setPreviewLoading(false);}
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!blockingError) void save(t);
      }}
    >
      <Section title="Test details" open>
        <Field label="Test title">
          <input
            required
            className={input}
            value={t.title}
            onChange={(e) => setT({ ...t, title: e.target.value })}
          />
        </Field>
        <Select
          label="Test type"
          value={t.type}
          required
          items={[...new Set(["practice","mock",t.type])].map((id) => ({ id, name: id==="practice"?"Practice test":id==="mock"?"Mock exam":id.replaceAll("_", " ") }))}
          onChange={(v) => setT({ ...t, type: v })}
        />
        <Field label="Internal description (Admin only)"><textarea className={`${input} min-h-20`} value={t.internal_description||""} onChange={e=>setT({...t,internal_description:e.target.value})}/></Field>
        <Field label="Student instructions"><textarea className={`${input} min-h-24`} value={t.instructions||""} onChange={e=>setT({...t,instructions:e.target.value})}/></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Duration (minutes)"
            min={1}
            value={t.duration_minutes}
            onChange={(v) => setT({ ...t, duration_minutes: v })}
          />
          <div><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={t.max_attempts===null} onChange={e=>setT({...t,max_attempts:e.target.checked?null:1})}/>Unlimited attempts</label>{t.max_attempts!==null&&<NumberField label="Attempts allowed" min={1} value={t.max_attempts} onChange={(v) => setT({ ...t, max_attempts: v })}/>}</div>
          <div><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={t.default_negative_marks>0} onChange={e=>setT({...t,default_negative_marks:e.target.checked?0.25:0})}/>Negative marking</label>{t.default_negative_marks>0&&<NumberField label="Marks deducted per wrong answer" min={0.01} step={0.25} value={t.default_negative_marks} onChange={(v) => setT({ ...t, default_negative_marks: v })}/>}</div>
        </div>
        <Select label="Pass criterion" value={t.target_score!==null?"marks":t.pass_percentage!==null?"percentage":"none"} items={[{id:"none",name:"No pass criterion"},{id:"marks",name:"Pass mark"},{id:"percentage",name:"Pass percentage"}]} onChange={v=>setT({...t,target_score:v==="marks"?0:null,pass_percentage:v==="percentage"?0:null})}/>
        {t.target_score !== null && (
          <NumberField
            label="Pass mark"
            min={0}
            step={0.5}
            value={t.target_score}
            onChange={(v) => setT({ ...t, target_score: v })}
          />
        )}
        {t.pass_percentage !== null && (
          <NumberField
            label="Pass percentage"
            min={0}
            value={t.pass_percentage}
            onChange={(v) =>
              setT({ ...t, pass_percentage: Math.min(100, v) })
            }
          />
        )}
      </Section>
      <Section title="Academic scope" open>
        <TestScopeFields value={t} data={data} availableBySubject={remoteQuestions?bank.value.by_subject:undefined} onChange={next => {
          setVisibleSubject(""); setVisibleSection("");
          setQuestionPage(0);
          setT(remoteQuestions?{...next,question_ids:[]}:retainAllowedSelections(data, next));
        }}/>
      </Section>
      <Section title="Question selection" open>
        {!scoped ? (
          <p>Choose a subject above before selecting questions.</p>
        ) : <>
        <div className="grid gap-1 text-sm sm:grid-cols-2" aria-live="polite">
          <p>Subject: {t.selection_rules.scopes ? "Multiple subjects" : subject?.name}</p>
          <p>Section: {t.selection_rules.scopes ? "Configured per subject" : section?.name ?? `All ${subject?.name} sections`}</p>
          <p>Available Active Questions: {available}</p>
          <p>{t.selection_mode === "manual" ? `Selected: ${t.question_ids.length}` : `Requested: ${t.question_count}`}</p>
        </div>
        <Select
          label="Selection mode"
          value={t.selection_mode}
          required
          items={[
            { id: "manual", name: "Manual selection" },
            { id: "generated", name: "Random Active Bank" },
          ]}
          onChange={(v) => {
            const scopes = t.selection_rules.scopes?.map(scope => ({...scope, count: scope.count ?? 1}));
            setT({...t, selection_mode: v, selection_rules: {...t.selection_rules, ...(scopes ? {scopes} : {})}, question_count: scopes ? scopes.reduce((n, scope) => n + scope.count, 0) : t.question_count});
          }}
        />
        {t.selection_mode === "generated" ? (
          <>
            <Select
              label="Difficulty rule"
              value={t.selection_rules?.difficulty || ""}
              items={["easy", "medium", "hard"].map((id) => ({ id, name: id }))}
              onChange={(v) => {
                setQuestionPage(0);
                setT({ ...t, selection_rules: { ...t.selection_rules, difficulty: v } });
              }}
            />
            {t.selection_rules.scopes ? <p className="text-sm font-semibold">Total requested: {t.selection_rules.scopes.reduce((n, scope) => n + (scope.count || 0), 0)}</p> : <NumberField
              label="Number of questions"
              min={1}
              disabled={!available}
              value={t.question_count}
              onChange={(v) => setT({ ...t, question_count: v })}
            />}
            <p className="text-sm text-muted">
              A fresh eligible sample is selected by the server for each
              attempt. Marks are summed from that sample.
            </p>
          </>
        ) : (
          <>
            {t.selection_rules.scopes && <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Visible subject" value={visibleSubject} items={data.subjects.filter(s => t.selection_rules.scopes?.some(scope => scope.subject_id === s.id))} onChange={v => {setVisibleSubject(v);setVisibleSection("");setQuestionPage(0);}}/>
              <Select label="Visible section" value={visibleSection} items={data.chapters.filter(c => !visibleSubject || c.subject_id === visibleSubject)} onChange={v=>{setVisibleSection(v);setQuestionPage(0);}}/>
            </div>}
            <Field label="Search active questions">
              <input
                className={input}
                value={search}
                onChange={(e) => {setSearch(e.target.value);setQuestionPage(0);}}
              />
            </Field>
            <TestQuestionPicker
              key={[t.subject_id, t.chapter_id, t.topic_id, visibleSubject, visibleSection, search].join(":")}
              questions={eligible.filter((q) => (!visibleSubject || q.subject_id === visibleSubject) && (!visibleSection || q.chapter_id === visibleSection) && (remoteQuestions||[questionLabel(q), q.source_label, q.source_reference].join(" ").toLowerCase().includes(search.toLowerCase())))}
              selected={t.question_ids}
              onChange={(question_ids) => setT({ ...t, question_ids })}
              {...(remoteQuestions?{page:questionPage,total:bank.value.total,pageSize:20,onPageChange:setQuestionPage}:{})}
            />
            {t.question_ids.some(
              (id) => !eligible.some((q) => q.id === id),
            ) && (
              <button
                type="button"
                className="min-h-11 text-sm text-brand"
                onClick={() =>
                  setT({
                    ...t,
                    question_ids: t.question_ids.filter((id) =>
                      eligible.some((q) => q.id === id),
                    ),
                  })
                }
              >
                Remove unavailable question selections
              </button>
            )}
            <p className="text-sm font-semibold">
              {t.question_ids.length} selected · {remoteQuestions?"Total marks calculated when saved":`Total marks: ${total} (calculated)`}
            </p>
          </>
        )}
        </>}
      </Section>
      <Section title="Eligibility and review" open>
        <BatchesField
          value={t.batch_ids}
          program={t.program_id}
          data={data}
          onChange={(v) => setT({ ...t, batch_ids: v })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(["available_from", "available_until"] as const).map((key) => (
            <Field
              key={key}
              label={
                key === "available_from" ? "Available from" : "Available until"
              }
            >
              <input
                className={input}
                type="datetime-local"
                value={localDateTime(t[key])}
                onChange={(e) =>
                  setT({
                    ...t,
                    [key]: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  })
                }
              />
            </Field>
          ))}
        </div>
        {(
          [
            ["randomize_questions", "Shuffle questions"],
            ["randomize_options", "Shuffle options"],
            ["show_results", "Show result score"],
            ["show_answers", "Show selected and correct answers"],
            ["show_explanations", "Show explanations and solution images"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={t[key]}
              onChange={(e) => setT({ ...t, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        {t.randomize_options && (
          <p role="status" className="text-xs text-warning">
            Confirm every question is safe to shuffle. Options such as “all of
            the above” or answers that depend on option order can change meaning.
          </p>
        )}
        <p className="text-xs text-muted">
          Completed attempts keep their original questions and review rules when
          this test is edited.
        </p>
      </Section>
      <StatusField
        value={t.status}
        onChange={(v) => setT({ ...t, status: v })}
      />
      <Section title="Review & publish">
        <button type="button" disabled={previewLoading} className="min-h-11 rounded border px-4 font-semibold" onClick={()=>void togglePreview()}>{previewLoading?"Loading preview…":previewOpen?"Close preview":"Preview test"}</button>
        {previewOpen&&<div className="rounded-lg bg-surface p-4 text-sm"><p className="font-bold">{t.title||"Untitled test"}</p><p>{t.type==="mock"?"Mock exam":"Practice test"} · {t.selection_mode==="manual"?t.question_ids.length:t.question_count} questions · {t.duration_minutes} minutes</p><p className="mt-2 whitespace-pre-wrap text-muted">{t.instructions||"No additional instructions."}</p><p className="mt-2 text-xs text-muted">Preview does not create a Student attempt. Random questions are selected only when an attempt starts.</p>{previewLoading&&<p role="status" className="mt-3">Loading representative question…</p>}{previewError&&<p role="alert" className="mt-3 text-red-800">{previewError}</p>}{previewQuestion&&<div className="mt-3 rounded-lg border border-line bg-white"><p className="p-3 font-bold">Representative question</p><QuestionPreview question={previewQuestion}/></div>}</div>}
        {value.created_at&&<button type="button" disabled={resultsLoading} className="min-h-11 rounded border px-4 font-semibold" onClick={()=>{setResultsError("");setResultsLoading(true);void loadAdminTestResults(value.id).then(v=>{if(!v)throw Error("Results are outside your assigned scope.");setResults(v as Record<string,unknown>);}).catch(()=>setResultsError("Could not load authorized results. Please retry.")).finally(()=>setResultsLoading(false));}}>{resultsLoading?"Loading results…":"View results"}</button>}
        {resultsError&&<p role="alert" className="text-sm text-red-800">{resultsError}</p>}
        {results&&<AdminTestResults value={results}/>}
      </Section>
      {selectionError && t.status !== "active" && (
        <p role="status" className="text-sm text-muted">{selectionError}</p>
      )}
      {blockingError && (
        <p role="status" className="text-sm text-muted">{blockingError}</p>
      )}
      <button disabled={busy || !!blockingError} className={`${button} w-full`}>
        {busy ? "Saving…" : "Save test"}
      </button>
    </form>
  );
}
function ContentForm({
  value,
  data,
  busy,
  save,
}: {
  value: Content;
  data: CoreData;
  busy: boolean;
  save: (q: Content) => Promise<void>;
}) {
  const [c, setC] = useState(value),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save(c);
      }}
    >
      <Field label="Title">
        <input
          required
          className={input}
          value={c.title}
          onChange={(e) => setC({ ...c, title: e.target.value })}
        />
      </Field>
      <TaxonomyFields
        value={c}
        programRequired
        data={data}
        onChange={(v) => setC({ ...c, ...v, batch_ids: [] })}
      />
      <Select
        label="Material type"
        value={c.kind}
        required
        items={[
          "video",
          "pdf",
          "image",
          "document",
          "note",
          "external_link",
        ].map((id) => ({ id, name: id.replaceAll("_", " ") }))}
        onChange={(v) => setC({ ...c, kind: v })}
      />
      <Field label="Description / note text">
        <textarea
          className={`${input} min-h-24`}
          value={c.description || ""}
          onChange={(e) => setC({ ...c, description: e.target.value })}
        />
      </Field>
      <Field label="HTTPS source URL (optional with an uploaded file)">
        <input
          type="url"
          className={input}
          value={c.external_url || ""}
          onChange={(e) => setC({ ...c, external_url: e.target.value })}
        />
      </Field>
      <Field label={c.storage_path ? "Replace file (optional)" : "Upload file"}>
        <input
          type="file"
          className={`${input} max-w-full`}
          accept="video/mp4,video/webm,application/pdf,image/png,image/jpeg,image/webp,.doc,.docx,.txt"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setUploading(true);
              setError("");
              void uploadCoreFile(file, "learning-content", c.id)
                .then((path) =>
                  setC((current) => ({
                    ...current,
                    storage_bucket: "learning-content",
                    storage_path: path,
                    mime_type: file.type,
                    byte_size: file.size,
                    external_url: "",
                    kind: file.type.startsWith("video/")
                      ? "video"
                      : file.type === "application/pdf"
                        ? "pdf"
                        : file.type.startsWith("image/")
                          ? "image"
                          : "document",
                  })),
                )
                .catch((e) => setError(e.message))
                .finally(() => setUploading(false));
            }
          }}
        />
      </Field>
      {c.storage_path && (
        <p className="break-all text-xs text-muted">
          Stored file: {c.storage_path.split("/").pop()}. Metadata can be saved
          without uploading again.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <BatchesField
        value={c.batch_ids}
        program={c.program_id}
        data={data}
        onChange={(v) => setC({ ...c, batch_ids: v })}
      />
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={c.allow_download}
          onChange={(e) => setC({ ...c, allow_download: e.target.checked })}
        />
        Allow download
      </label>
      <StatusField
        value={c.status}
        onChange={(v) => setC({ ...c, status: v })}
      />
      <button disabled={busy || uploading} className={`${button} w-full`}>
        {uploading ? "Uploading…" : busy ? "Saving…" : "Save content"}
      </button>
    </form>
  );
}

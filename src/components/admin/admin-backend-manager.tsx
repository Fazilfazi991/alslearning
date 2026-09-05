"use client";
import { useEffect, useMemo, useState } from "react";
import {
  loadAdminData,
  deleteContent,
  removeBatchFaculty,
  removeFacultyAssignment,
  saveBatchFaculty,
  saveCheckpoint,
  saveContent,
  saveEnrollment,
  saveFacultyAssignment,
  saveTest,
  setFacultyActive,
  replaceMaterial,
  uploadMaterial,
  type AdminData,
} from "@/lib/admin-backend";
export type BackendManagerMode = "enrollments" | "faculty" | "content" | "tests" | "checkpoints";
type Row = Record<string, unknown>;
const box = "rounded-xl border border-[#e6cbd5] bg-white p-5",
  input =
    "min-h-11 w-full rounded border border-[#d8b8c4] bg-white px-3 text-sm",
  button =
    "min-h-10 rounded bg-brand px-4 text-sm font-bold text-white disabled:opacity-50";
const id = () => crypto.randomUUID(),
  slug = (x: string) =>
    `${x
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Date.now()}`;
function Select({
  label,
  value,
  onChange,
  items,
  blank = "Select",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: Row[];
  blank?: string;
}) {
  return (
    <label className="text-xs font-bold uppercase text-muted">
      {label}
      <select
        className={`${input} mt-2`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{blank}</option>
        {items.map((x) => (
          <option key={String(x.id)} value={String(x.id)}>
            {String(x.name ?? x.full_name ?? x.email)}
          </option>
        ))}
      </select>
    </label>
  );
}
export function AdminBackendManager({ mode }: { mode: BackendManagerMode }) {
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    try {
      setError("");
      setData(await loadAdminData());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load data");
    }
  };
  useEffect(() => {
    let active=true;
    void loadAdminData().then(value=>{if(active)setData(value)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Unable to load data")});
    return()=>{active=false};
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className={box}>{error || "Loading Supabase data…"}</section>
    );
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">
          {
            {
              enrollments: "Enrollment Management",
              faculty: "Faculty Management",
              content: "Videos & Materials",
              tests: "Test Authoring",
              checkpoints: "Video Checkpoints",
            }[mode]
          }
        </h1>
        <p className="mt-2 text-sm text-muted">
          Changes are persisted to Supabase and enforced by row-level security.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {mode === "enrollments" && (
        <Enrollments data={data} busy={busy} run={run} />
      )}{" "}
      {mode === "faculty" && <Faculty data={data} busy={busy} run={run} />}{" "}
      {mode === "content" && <Content data={data} busy={busy} run={run} />}{" "}
      {mode === "tests" && <Tests data={data} busy={busy} run={run} />}{" "}
      {mode === "checkpoints" && (
        <Checkpoints data={data} busy={busy} run={run} />
      )}
    </div>
  );
}
type Props = {
  data: AdminData;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
};
function Enrollments({ data, busy, run }: Props) {
  const students = data.profiles.filter((x) => x.role === "student"),
    [editing, setEditing] = useState(""),
    [student, setStudent] = useState(""),
    [program, setProgram] = useState(""),
    [batch, setBatch] = useState(""),
    [status, setStatus] = useState("active"),
    [enrolledOn, setEnrolledOn] = useState(new Date().toISOString().slice(0,10)),
    [start, setStart] = useState(""),
    [expiry, setExpiry] = useState(""),
    [noExpiry, setNoExpiry] = useState(true),
    [validation, setValidation] = useState("");
  const names = new Map(
    data.profiles.map((x) => [x.id, x.full_name || x.email]),
  );
  const programs = new Map(data.programs.map((x) => [x.id, x.name]));
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form
        className={`${box} grid gap-4`}
        onSubmit={(e) => {
          e.preventDefault();
          if(!noExpiry && !expiry){setValidation("Choose an access expiry or enable no-expiry.");return}
          if(!noExpiry && start && new Date(expiry)<=new Date(start)){setValidation("Access expiry must be after access start.");return}
          setValidation("");
          void run(() =>
            saveEnrollment({
              ...(editing?{id:editing}:{}),
              student_id: student,
              program_id: program,
              batch_id: batch || null,
              status,
              enrolled_on: enrolledOn,
              access_starts_at: start ? new Date(start).toISOString() : new Date(enrolledOn).toISOString(),
              access_expires_at: noExpiry ? null : new Date(expiry).toISOString(),
            }),
          );
        }}
      >
        <Select
          label="Student"
          value={student}
          onChange={setStudent}
          items={students}
        />
        <label className="text-xs font-bold uppercase text-muted">Enrollment date<input type="date" required className={`${input} mt-2`} value={enrolledOn} onChange={e=>setEnrolledOn(e.target.value)}/></label>
        <Select
          label="Program"
          value={program}
          onChange={(v) => {
            setProgram(v);
            setBatch("");
          }}
          items={data.programs}
        />
        <Select
          label="Batch"
          value={batch}
          onChange={setBatch}
          items={data.batches.filter((x) => x.program_id === program)}
          blank="No batch"
        />
        <label className="text-xs font-bold uppercase text-muted">
          Access starts
          <input
            type="datetime-local"
            className={`${input} mt-2`}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noExpiry} onChange={e=>setNoExpiry(e.target.checked)}/>No expiry</label>
        <label className="text-xs font-bold uppercase text-muted">
          Access expires (blank = no expiry)
          <input
            type="datetime-local"
            className={`${input} mt-2`}
            value={expiry} disabled={noExpiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </label>
        {validation&&<p role="alert" className="text-sm text-red-700">{validation}</p>}
        <label className="text-xs font-bold uppercase text-muted">
          Status
          <select
            className={`${input} mt-2`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["active", "suspended", "completed", "cancelled"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button disabled={busy || !student || !program} className={button}>
          {editing?"Update enrollment":"Save enrollment"}
        </button>
        {editing&&<button type="button" className="min-h-10 rounded border px-4 text-sm font-bold" onClick={()=>{setEditing("");setStudent("");setProgram("");setBatch("");setStatus("active");setEnrolledOn(new Date().toISOString().slice(0,10));setStart("");setExpiry("");setNoExpiry(true)}}>Cancel edit</button>}
      </form>
      <Rows
        empty="No enrollments yet."
        rows={data.enrollments.map((x) => ({
          id: x.id,
          primary: names.get(x.student_id) || "Student",
          secondary: programs.get(x.program_id) || "Program",
          meta: `${x.status} · ${x.access_expires_at ? new Date(x.access_expires_at).toLocaleDateString() : "No expiry"}`,
          action: <div className="flex flex-wrap gap-2"><button className="min-h-10 rounded border px-3 text-sm font-bold" onClick={()=>{setEditing(x.id);setStudent(x.student_id);setProgram(x.program_id);setBatch(x.batch_id||"");setStatus(x.status);setEnrolledOn(x.enrolled_on);setStart(x.access_starts_at?new Date(x.access_starts_at).toISOString().slice(0,16):"");setExpiry(x.access_expires_at?new Date(x.access_expires_at).toISOString().slice(0,16):"");setNoExpiry(!x.access_expires_at)}}>Edit</button><button className={button} onClick={()=>void run(()=>saveEnrollment({...x,status:x.status==="active"?"suspended":"active"}))}>{x.status==="active"?"Suspend":"Reactivate"}</button></div>,
        }))}
      />
    </div>
  );
}
function Faculty({ data, busy, run }: Props) {
  const faculty = data.profiles.filter((x) => x.role === "teacher"),
    [search,setSearch]=useState(""),
    [teacher, setTeacher] = useState(""),
    [program, setProgram] = useState(""),
    [subject, setSubject] = useState(""),
    [batch, setBatch] = useState("");
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form
        className={`${box} grid gap-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (program || subject)
              await saveFacultyAssignment({
                faculty_id: teacher,
                program_id: program || null,
                subject_id: subject || null,
                can_manage_content: true,
                can_manage_questions: true,
                can_manage_tests: true,
              });
            if (batch) await saveBatchFaculty(batch, teacher);
          });
        }}
      >
        <Select
          label="Faculty profile"
          value={teacher}
          onChange={setTeacher}
          items={faculty}
        />
        <Select
          label="Program"
          value={program}
          onChange={setProgram}
          items={data.programs}
          blank="Optional"
        />
        <Select
          label="Subject"
          value={subject}
          onChange={setSubject}
          items={data.subjects}
          blank="Optional"
        />
        <Select
          label="Batch"
          value={batch}
          onChange={setBatch}
          items={data.batches}
          blank="Optional"
        />
        <button
          disabled={busy || !teacher || (!program && !subject && !batch)}
          className={button}
        >
          Add assignment
        </button>
        <p className="text-xs text-muted">
          Faculty accounts must already exist in Supabase Auth; this safely
          connects their profile without exposing administrative credentials.
        </p>
      </form>
      <div className="space-y-4">
        <input className={input} placeholder="Search faculty" value={search} onChange={e=>setSearch(e.target.value)}/>
        {faculty.filter(person=>`${person.full_name||""} ${person.email||""}`.toLowerCase().includes(search.toLowerCase())).map((person) => (
          <section className={box} key={person.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b>{person.full_name || person.email || "Unnamed faculty"}</b>
                <p className="text-sm text-muted">
                  {person.is_active ? "Active" : "Archived"}
                </p>
              </div>
              <button
                className={button}
                onClick={() =>
                  void run(() => setFacultyActive(person.id, !person.is_active))
                }
              >
                {person.is_active ? "Archive" : "Activate"}
              </button>
            </div>
            {data.assignments
              .filter((x) => x.faculty_id === person.id)
              .map((x) => (
                <div
                  key={x.id}
                  className="mt-3 flex items-center justify-between border-t pt-3 text-sm"
                >
                  <span>
                    {data.programs.find((p) => p.id === x.program_id)?.name ||
                      data.subjects.find((s) => s.id === x.subject_id)?.name ||
                      "Assignment"}
                  </span>
                  <button
                    onClick={() =>
                      void run(() => removeFacultyAssignment(x.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            {data.batchFaculty
              .filter((x) => x.faculty_id === person.id)
              .map((x) => (
                <div
                  key={x.batch_id}
                  className="mt-3 flex items-center justify-between border-t pt-3 text-sm"
                >
                  <span>
                    {data.batches.find((b) => b.id === x.batch_id)?.name ||
                      "Batch"}
                  </span>
                  <button
                    onClick={() =>
                      void run(() => removeBatchFaculty(x.batch_id, person.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
function Content({ data, busy, run }: Props) {
  const [editing,setEditing]=useState(""),[title, setTitle] = useState(""),
    [kind, setKind] = useState("video"),
    [url, setUrl] = useState(""),
    [program, setProgram] = useState(""),
    [subject, setSubject] = useState(""),
    [chapter, setChapter] = useState(""),
    [topic, setTopic] = useState(""),
    [faculty, setFaculty] = useState(""),
    [status, setStatus] = useState("draft"),
    [download, setDownload] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [search, setSearch] = useState(""),[kindFilter,setKindFilter]=useState(""),[statusFilter,setStatusFilter]=useState("");
  const visible = useMemo(
    () =>
      data.content.filter((x) => x.title.toLowerCase().includes(search.toLowerCase())&&(!kindFilter||x.kind===kindFilter)&&(!statusFilter||x.status===statusFilter)),
    [data.content, search,kindFilter,statusFilter],
  );
  return (
    <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
      <form
        className={`${box} grid gap-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const contentId = editing||id(),existing=data.content.find(x=>x.id===editing);
            let stored = {
              bucket: null as string | null,
              path: null as string | null,
              mime_type: null as string | null,
              byte_size: null as number | null,
            };
            if(file&&existing?.storage_path){await replaceMaterial(file,existing);}
            else if (file) {
              const uploaded = await uploadMaterial(
                file,
                `content/${contentId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
              );
              stored = {
                bucket: uploaded.bucket,
                path: uploaded.path,
                mime_type: uploaded.mime_type,
                byte_size: uploaded.byte_size,
              };
            }
            await saveContent({
              id: contentId,
              slug: slug(title),
              title,
              kind: file
                ? file.type === "application/pdf"
                  ? "pdf"
                  : file.type.startsWith("image/")
                    ? "image"
                    : "document"
                : kind==="video"?"video":"document",
              external_url: kind==="video" ? url : null,
              ...(!editing||!existing?.storage_path?{storage_bucket:stored.bucket,storage_path:stored.path,mime_type:stored.mime_type,byte_size:stored.byte_size}:{}),
              program_id: program || null,
              subject_id: subject || null,
              chapter_id: chapter || null,
              topic_id: topic || null,
              faculty_id: faculty || null,
              visibility: "enrolled",
              allow_download: download,
              status,
              display_order: data.content.length,
            });
            setEditing("");setTitle("");setUrl("");setFile(null);
          });
        }}
      >
        <label className="text-xs font-bold uppercase text-muted">
          Title
          <input
            className={`${input} mt-2`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required={!editing}
          />
        </label>
        <label className="text-xs font-bold uppercase text-muted">
          Source
          <select
            className={`${input} mt-2`}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="video">YouTube / external video</option>
            <option value="file">Private uploaded material</option>
          </select>
        </label>
        {kind === "video" ? (
          <label className="text-xs font-bold uppercase text-muted">
            Video URL
            <input
              type="url"
              className={`${input} mt-2`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
        ) : (
          <input
            type="file"
            accept=".pdf,.doc,.docx,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        )}
        <Select
          label="Program"
          value={program}
          onChange={setProgram}
          items={data.programs}
        />
        <Select
          label="Subject"
          value={subject}
          onChange={setSubject}
          items={data.subjects}
        />
        <Select
          label="Chapter"
          value={chapter}
          onChange={setChapter}
          items={data.chapters}
          blank="Optional"
        />
        <Select
          label="Topic"
          value={topic}
          onChange={setTopic}
          items={data.topics}
          blank="Optional"
        />
        <Select
          label="Faculty"
          value={faculty}
          onChange={setFaculty}
          items={data.profiles.filter((x) => x.role === "teacher")}
          blank="Optional"
        />
        <label className="text-sm">
          <input
            type="checkbox"
            checked={download}
            onChange={(e) => setDownload(e.target.checked)}
          />{" "}
          Allow download
        </label>
        <select
          className={input}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="draft">Draft</option>
          <option value="active">Published</option>
          <option value="archived">Archived</option>
        </select>
        <button
          className={button}
          disabled={busy || !title || !program || !subject}
        >
          {editing?"Update content":"Save content"}
        </button>
        {editing&&<button type="button" className="min-h-10 rounded border px-4 font-bold" onClick={()=>{setEditing("");setTitle("");setUrl("");setFile(null)}}>Cancel edit</button>}
      </form>
      <div>
        <input
          className={`${input} mb-4`}
          placeholder="Search content"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mb-4 grid gap-2 sm:grid-cols-2"><select className={input} value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="">All content types</option><option value="video">Videos</option><option value="pdf">PDFs</option><option value="document">Documents</option><option value="image">Images</option></select><select className={input} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="active">Published</option><option value="archived">Archived</option></select></div>
        <Rows
          empty="No videos or materials yet."
          rows={visible.map((x) => ({
            id: x.id,
            primary: x.title,
            secondary: x.kind,
            meta: x.status,
            action: (<div className="flex flex-wrap gap-2"><button className="min-h-10 rounded border px-3 text-sm font-bold" onClick={()=>{setEditing(x.id);setTitle(x.title);setKind(x.kind==="video"?"video":"file");setUrl(x.external_url||"");setProgram(x.program_id||"");setSubject(x.subject_id||"");setChapter(x.chapter_id||"");setTopic(x.topic_id||"");setFaculty(x.faculty_id||"");setStatus(x.status);setDownload(x.allow_download);setFile(null)}}>Edit</button><button
                className={button}
                onClick={() =>
                  void run(() =>
                    saveContent({
                      ...x,
                      status: x.status === "active" ? "archived" : "active",
                    }),
                  )
                }
              >
                {x.status === "active" ? "Archive" : "Publish"}
              </button><button className="min-h-10 rounded border px-3" disabled={x.display_order===0} onClick={()=>void run(()=>saveContent({id:x.id,display_order:Math.max(0,x.display_order-1)}))}>↑</button><button className="min-h-10 rounded border px-3" onClick={()=>void run(()=>saveContent({id:x.id,display_order:x.display_order+1}))}>↓</button>{x.status==="draft"&&<button className="min-h-10 rounded border border-red-200 px-3 text-red-700" onClick={()=>void run(()=>deleteContent(x))}>Delete</button>}</div>),
          }))}
        />
      </div>
    </div>
  );
}
function Tests({ data, busy, run }: Props) {
  const [title, setTitle] = useState(""),
    [program, setProgram] = useState(""),
    [subject, setSubject] = useState(""),
    [batch, setBatch] = useState(""),
    [duration, setDuration] = useState(60),
    [negative, setNegative] = useState(0),
    [attempts, setAttempts] = useState(1),
    [availableFrom,setAvailableFrom]=useState(""),
    [availableUntil,setAvailableUntil]=useState(""),
    [randomQuestions,setRandomQuestions]=useState(true),
    [randomOptions,setRandomOptions]=useState(false),
    [showResults,setShowResults]=useState(true),
    [showAnswers,setShowAnswers]=useState(true),
    [showExplanations,setShowExplanations]=useState(true),
    [validation,setValidation]=useState(""),
    [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
      <form
        className={`${box} grid gap-4`}
        onSubmit={(e) => {
          e.preventDefault();
          if(availableFrom&&availableUntil&&new Date(availableUntil)<=new Date(availableFrom)){setValidation("Availability end must be after its start.");return}
          if(duration<1||attempts<1||negative<0){setValidation("Duration and attempts must be at least 1; negative marks cannot be below 0.");return}
          setValidation("");
          void run(() =>
            saveTest(
              {
                slug: slug(title),
                title,
                type: "mock",
                program_id: program,
                subject_id: subject || null,
                question_count: selected.length,
                duration_minutes: duration,
                total_marks: null,
                default_negative_marks: negative,
                max_attempts: attempts,
                available_from:availableFrom?new Date(availableFrom).toISOString():null,
                available_until:availableUntil?new Date(availableUntil).toISOString():null,
                randomize_questions: randomQuestions,
                randomize_options: randomOptions,
                show_results:showResults,
                show_answers: showAnswers,
                show_explanations: showExplanations,
                selection_mode: "manual",
                status: "draft",
              },
              selected,
              batch ? [batch] : [],
            ),
          );
        }}
      >
        <label className="text-xs font-bold uppercase text-muted">
          Title
          <input
            className={`${input} mt-2`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <Select
          label="Program"
          value={program}
          onChange={setProgram}
          items={data.programs}
        />
        <Select
          label="Subject"
          value={subject}
          onChange={setSubject}
          items={data.subjects}
          blank="All subjects"
        />
        <Select
          label="Batch"
          value={batch}
          onChange={setBatch}
          items={data.batches}
          blank="All enrolled batches"
        />
        <label>
          Duration (minutes)
          <input
            type="number"
            min="1"
            className={input}
            value={duration}
            onChange={(e) => setDuration(+e.target.value)}
          />
        </label>
        <label>
          Negative marks
          <input
            type="number"
            min="0"
            step="0.25"
            className={input}
            value={negative}
            onChange={(e) => setNegative(+e.target.value)}
          />
        </label>
        <label>
          Maximum attempts
          <input
            type="number"
            min="1"
            className={input}
            value={attempts}
            onChange={(e) => setAttempts(+e.target.value)}
          />
        </label>
        <label>Available from<input type="datetime-local" className={input} value={availableFrom} onChange={e=>setAvailableFrom(e.target.value)}/></label>
        <label>Available until<input type="datetime-local" className={input} value={availableUntil} onChange={e=>setAvailableUntil(e.target.value)}/></label>
        <div className="grid gap-2 sm:grid-cols-2">{[["Randomize questions",randomQuestions,setRandomQuestions],["Randomize options",randomOptions,setRandomOptions],["Show result",showResults,setShowResults],["Show answers",showAnswers,setShowAnswers],["Show explanations",showExplanations,setShowExplanations]].map(([label,value,setter])=><label className="flex items-center gap-2 text-sm" key={String(label)}><input type="checkbox" checked={value as boolean} onChange={e=>(setter as (value:boolean)=>void)(e.target.checked)}/>{String(label)}</label>)}</div>
        <fieldset className="max-h-64 overflow-y-auto rounded border p-3">
          <legend className="font-bold">
            Manual questions ({selected.length})
          </legend>
          {data.questions
            .filter((q) => !subject || q.subject_id === subject)
            .map((q) => (
              <label key={q.id} className="mt-2 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(q.id)}
                  onChange={() =>
                    setSelected((v) =>
                      v.includes(q.id)
                        ? v.filter((x) => x !== q.id)
                        : [...v, q.id],
                    )
                  }
                />
                {q.prompt}
              </label>
            ))}
        </fieldset>
        {validation&&<p role="alert" className="text-sm text-red-700">{validation}</p>}
        <button
          className={button}
          disabled={busy || !title || !program || !selected.length}
        >
          Create draft test
        </button>
      </form>
      <Rows
        empty="No tests authored yet."
        rows={data.tests.map((x) => ({
          id: x.id,
          primary: x.title,
          secondary: `${x.question_count} questions · ${x.duration_minutes} minutes`,
          meta: x.status,
        }))}
      />
    </div>
  );
}
function Checkpoints({ data, busy, run }: Props) {
  const [video, setVideo] = useState(""),
    [question, setQuestion] = useState(""),
    [seconds, setSeconds] = useState(0),
    [mandatory, setMandatory] = useState(true),
    [pause, setPause] = useState(true),
    [retry, setRetry] = useState("once");
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <form
        className={`${box} grid gap-4`}
        onSubmit={(e) => {
          e.preventDefault();
          void run(() =>
            saveCheckpoint({
              video_id: video,
              question_id: question,
              trigger_seconds: seconds,
              pause_video: pause,
              mandatory,
              show_feedback: true,
              retry_policy: retry,
              store_response: true,
            }),
          );
        }}
      >
        <Select
          label="Video"
          value={video}
          onChange={setVideo}
          items={data.content.filter((x) => x.kind === "video")}
        />
        <Select
          label="Question"
          value={question}
          onChange={setQuestion}
          items={data.questions}
        />
        <label>
          Timestamp (seconds)
          <input
            type="number"
            min="0"
            className={input}
            value={seconds}
            onChange={(e) => setSeconds(+e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={pause}
            onChange={(e) => setPause(e.target.checked)}
          />{" "}
          Pause playback
        </label>
        <label>
          <input
            type="checkbox"
            checked={mandatory}
            onChange={(e) => setMandatory(e.target.checked)}
          />{" "}
          Mandatory answer
        </label>
        <label>
          Retry rule
          <select
            className={input}
            value={retry}
            onChange={(e) => setRetry(e.target.value)}
          >
            <option value="none">No retry</option>
            <option value="once">Retry once</option>
            <option value="until_correct">Until correct</option>
          </select>
        </label>
        <button className={button} disabled={busy || !video || !question}>
          Add checkpoint
        </button>
      </form>
      <Rows
        empty="No checkpoint questions yet."
        rows={data.checkpoints.map((x) => ({
          id: x.id,
          primary: x.learning_content?.title || "Video",
          secondary: x.questions?.prompt || "Question",
          meta: `${x.trigger_seconds}s · ${x.retry_policy}`,
        }))}
      />
    </div>
  );
}
function Rows({
  rows,
  empty,
}: {
  rows: Array<{
    id: string;
    primary: string;
    secondary: string;
    meta: string;
    action?: React.ReactNode;
  }>;
  empty: string;
}) {
  return (
    <div className="space-y-3">
      {!rows.length && <section className={box}>{empty}</section>}
      {rows.map((x) => (
        <section
          className={`${box} flex flex-wrap items-center justify-between gap-3`}
          key={x.id}
        >
          <div>
            <b>{x.primary}</b>
            <p className="text-sm text-muted">{x.secondary}</p>
            <p className="mt-1 text-xs uppercase text-muted">{x.meta}</p>
          </div>
          {x.action}
        </section>
      ))}
    </div>
  );
}

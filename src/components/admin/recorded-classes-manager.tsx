"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseYouTubeInput, topicsForSubject, validateRecording, type Recording, type RecordingStatus, type RecordingSubject, type RecordingTopic } from "@/lib/recorded-classes";
import { YouTubePlayer } from "@/components/recorded-classes/youtube-player";
import { NativeVideoUploader, RecordedClassInteractionEditor } from "@/components/admin/recorded-class-native-tools";
import { NativeRecordedClassPlayer } from "@/components/recorded-classes/native-player";

const fieldClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm";
type Form = { id?: string; subject_id: string; chapter_id: string; topic_label: string; subtopic: string; title: string; videoInput: string; description: string; teacher_id: string; sort_order: number; status: RecordingStatus; provider: "youtube"|"native"; storage_key:string; mime_type:string; file_size:number|null; duration_seconds:number|null; width:number|null; height:number|null };
const empty: Form = { subject_id: "", chapter_id: "", topic_label: "", subtopic: "", title: "", videoInput: "", description: "", teacher_id: "", sort_order: 0, status: "draft", provider:"youtube", storage_key:"", mime_type:"", file_size:null, duration_seconds:null, width:null, height:null };
const pageSize = 30;
export function RecordedClassesManager() {
  const [subjects, setSubjects] = useState<RecordingSubject[]>([]);
  const [topics, setTopics] = useState<RecordingTopic[]>([]);
  const [teachers, setTeachers] = useState<RecordingSubject[]>([]);
  const [rows, setRows] = useState<Recording[]>([]);
  const [subject, setSubject] = useState(""); const [topic, setTopic] = useState("");
  const [status, setStatus] = useState(""); const [search, setSearch] = useState("");
  const [page, setPage] = useState(0); const [count, setCount] = useState(0);
  const [form, setForm] = useState<Form | null>(null); const [preview, setPreview] = useState<Recording | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false; const db = createClient();
    Promise.all([db.from("subjects").select("id,name").order("name"), db.from("chapters").select("id,name,subject_id,display_order").order("display_order"), db.from("profiles").select("id,full_name").eq("role", "teacher").eq("is_active", true).order("full_name")]).then(([s,t,p]) => {
      if (cancelled) return;
      if (s.error || t.error || p.error) { setError("Could not load authoring options. Reload to try again."); return; }
      setSubjects(s.data ?? []); setTopics(t.data ?? []); setTeachers((p.data ?? []).map(p => ({id:p.id,name:p.full_name || "Teacher"})));
    }).catch(() => { if (!cancelled) setError("Could not load authoring options. Check your connection."); });
    return () => { cancelled = true; };
  }, []);
  const refresh = useCallback(() => { setRevision(x => x+1); }, []);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let query = createClient().from("recorded_classes").select("*", {count:"exact"}).order("updated_at", {ascending:false}).order("id").range(page*pageSize, (page+1)*pageSize-1);
        if (subject) query = query.eq("subject_id", subject);
        if (topic) query = query.eq("chapter_id", topic);
        if (status) query = query.eq("status", status);
        if (search.trim()) query = query.ilike("title", `%${search.trim().replace(/[%_\\]/g, "\\$&")}%`);
        const result = await query;
        if (result.error) throw new Error();
        if (!cancelled) { setRows(result.data as Recording[]); setCount(result.count ?? 0); }
      } catch { if (!cancelled) setError("Could not load recordings. Check your connection and retry."); }
      finally { if (!cancelled) setLoading(false); }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [subject, topic, status, search, page, revision]);
  function change<K extends keyof Form>(key: K, value: Form[K]) { setForm(f => f ? {...f,[key]:value} : null); }
  async function edit(row: Recording) {
    setBusy(true); setError(""); setNotice("");
    try {
      const source = await createClient().rpc("recorded_class_source", {target:row.id});
      if (source.error) throw new Error();
      setForm({...empty,...row,topic_label:row.topic_label || "",subtopic:row.subtopic || "",description:row.description || "",teacher_id:row.teacher_id || "",videoInput:source.data || row.provider_video_id || "",storage_key:row.storage_key||"",mime_type:row.mime_type||""}); setPreview(null);
    } catch { setError("Could not open the recording. Please retry."); } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!form) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const id = form.provider === "youtube" ? validateRecording(form) : null;
      if (form.provider === "native" && form.status !== "draft" && !form.storage_key) throw new Error("Upload an MP4 before publishing this recording.");
      if (!topicsForSubject(topics, form.subject_id).some(t => t.id === form.chapter_id)) throw new Error("Choose a Topic belonging to this Subject.");
      const {videoInput, ...value} = form;
      const result = await createClient().rpc("save_recorded_class", {value:{...value,provider:form.provider,provider_video_id:id,storage_provider:form.provider==="native"?"r2":null,storage_key:form.storage_key||null,mime_type:form.mime_type||null,original_source_url:videoInput.trim() || null}});
      if (result.error) throw new Error("Recording could not be saved. Check the fields, your connection and Admin access.");
      setForm(null); setNotice("Recording saved."); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Recording could not be saved."); } finally { setBusy(false); }
  }
  async function archive(row: Recording) {
    setBusy(true); setError("");
    try {
      const result = await createClient().from("recorded_classes").update({status:"archived"}).eq("id",row.id).select("id").single();
      if (result.error) throw new Error();
      setNotice("Recording archived."); refresh();
    } catch { setError("Could not archive this recording. Please retry."); } finally { setBusy(false); }
  }
  let parsed: string | null = null, parseError = "";
  if (form?.videoInput) { try { parsed = parseYouTubeInput(form.videoInput); } catch(e) { parseError = (e as Error).message; } }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Recorded Classes</h1><p className="mt-1 text-sm text-muted">Manage on-demand lessons by subject and topic.</p></div><button disabled={busy} onClick={() => {setForm({...empty});setPreview(null);setError("");setNotice("");}} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-bold text-white">Add recording</button></div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button onClick={() => {setError("");refresh();}} className="underline">Retry loading</button></div>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {form ? <form onSubmit={save} className="rounded-xl border border-line bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{form.id ? "Edit recording" : "New recording"}</h2><button type="button" disabled={busy} onClick={() => setForm(null)} className="min-h-11 px-3 text-sm underline">Cancel</button></div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-semibold">Playback source<select className={fieldClass} value={form.provider} onChange={e=>setForm({...form,provider:e.target.value as "youtube"|"native",status:"draft"})}><option value="youtube">YouTube</option><option value="native">Private R2 upload</option></select></label>
        <label className="min-w-0 text-sm font-semibold">Subject *<select required className={fieldClass} value={form.subject_id} onChange={e => setForm({...form,subject_id:e.target.value,chapter_id:"",topic_label:""})}><option value="">Select Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="min-w-0 text-sm font-semibold">Topic *<select required disabled={!form.subject_id} className={fieldClass} value={form.chapter_id} onChange={e => setForm({...form,chapter_id:e.target.value,topic_label:""})}><option value="">Select Topic</option>{topicsForSubject(topics,form.subject_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="min-w-0 text-sm font-semibold">Topic display label (optional)<input maxLength={200} className={fieldClass} value={form.topic_label} onChange={e => change("topic_label",e.target.value)}/><span className="mt-1 block text-xs font-normal text-muted">Use a client-facing name when it differs from the canonical Topic.</span></label>
        <label className="min-w-0 text-sm font-semibold">Sub-topic (optional)<input maxLength={200} className={fieldClass} value={form.subtopic} onChange={e => change("subtopic",e.target.value)}/></label>
        <label className="min-w-0 text-sm font-semibold sm:col-span-2">Video title *<input required maxLength={250} className={fieldClass} value={form.title} onChange={e => change("title",e.target.value)}/></label>
        {form.provider === "youtube" ? <label className="min-w-0 text-sm font-semibold sm:col-span-2">YouTube URL / Video ID<input aria-label="YouTube URL / Video ID" maxLength={2048} autoComplete="off" spellCheck={false} className={fieldClass} value={form.videoInput} onChange={e => change("videoInput",e.target.value)} aria-describedby="video-validation"/><span id="video-validation" className={`mt-1 block text-xs font-normal ${parseError ? "text-red-700" : "text-muted"}`}>{parseError || (parsed ? `YouTube video ID: ${parsed}` : "Video link pending — save as Draft until the link is available.")}</span></label> : form.id ? <div className="sm:col-span-2"><NativeVideoUploader recordingId={form.id} onUploaded={value=>setForm(current=>current?{...current,...value}:current)}/>{form.storage_key&&<p className="mt-2 break-all text-xs text-muted">Private object attached: {form.storage_key}</p>}</div> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">Save this recording as Draft first, then reopen it to upload the MP4 directly to R2.</p>}
        <label className="min-w-0 text-sm font-semibold sm:col-span-2">Description<textarea rows={3} maxLength={10000} className={fieldClass} value={form.description} onChange={e => change("description",e.target.value)}/></label>
        <label className="text-sm font-semibold">Teacher (optional)<select className={fieldClass} value={form.teacher_id} onChange={e => change("teacher_id",e.target.value)}><option value="">No Teacher assigned</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="text-sm font-semibold">Sort order<input type="number" min={0} step={1} required className={fieldClass} value={form.sort_order} onChange={e => change("sort_order",Number(e.target.value))}/></label>
        <label className="text-sm font-semibold">Status<select className={fieldClass} value={form.status} onChange={e => change("status",e.target.value as RecordingStatus)}><option value="draft">Draft</option><option value="published" disabled={form.provider==="youtube"?!parsed:!form.storage_key}>Published</option><option value="archived" disabled={form.provider==="youtube"?!parsed:!form.storage_key}>Archived</option></select></label>
      </div>
      {form.provider==="youtube"&&parsed && <details className="mt-4"><summary className="cursor-pointer py-3 text-sm font-semibold text-brand">Preview video before publishing</summary><div className="max-w-2xl"><YouTubePlayer key={parsed} videoId={parsed} title={form.title || "Recording preview"}/></div></details>}
      {form.provider==="native"&&form.id&&form.storage_key&&<RecordedClassInteractionEditor recordingId={form.id} title={form.title||"Recording preview"}/>}
      <p className="mt-4 text-xs text-muted">Confirm the video plays in Preview before publishing. Draft recordings are hidden from Students.</p>
      <button disabled={busy || (form.provider==="youtube"&&!!parseError)} className="mt-4 min-h-11 rounded-lg bg-brand px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save recording"}</button>
    </form> : <>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-white p-4 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-semibold">Subject<select className={fieldClass} value={subject} onChange={e => {setSubject(e.target.value);setTopic("");setPage(0);}}><option value="">All Subjects</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold">Topic<select className={fieldClass} value={topic} onChange={e => {setTopic(e.target.value);setPage(0);}}><option value="">All Topics</option>{(subject ? topicsForSubject(topics,subject) : topics).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="text-xs font-semibold">Status<select className={fieldClass} value={status} onChange={e => {setStatus(e.target.value);setPage(0);}}><option value="">All statuses</option>{["draft","published","archived"].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        <label className="min-w-0 text-xs font-semibold">Search<input type="search" placeholder="Search video title" className={fieldClass} value={search} onChange={e => {setSearch(e.target.value);setPage(0);}}/></label>
      </div>
      {loading ? <p role="status" className="p-4 text-sm">Loading recordings…</p> : !rows.length ? <p className="rounded-xl border bg-white p-5 text-sm text-muted">{subject || topic || status || search ? "No recordings match these filters." : "No recordings yet. Add the first recorded class."}</p> : <div className="divide-y divide-line rounded-xl border border-line bg-white">{rows.map(row => <article key={row.id} className="grid min-w-0 gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0"><h2 className="break-words font-semibold">{row.title}</h2><p className="mt-1 break-words text-xs text-muted">{subjects.find(s => s.id === row.subject_id)?.name} · {row.topic_label || topics.find(t => t.id === row.chapter_id)?.name}{row.subtopic ? ` · ${row.subtopic}` : ""}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className={`rounded px-2 py-1 ${row.status === "published" ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>{row.status}</span>{(row.provider==="youtube"?!row.provider_video_id:!row.storage_key) && <span className="py-1 text-amber-800">Video pending</span>}<span className="py-1 text-muted">{row.provider==="native"?"Private R2":"YouTube"} · Order {row.sort_order}</span><span className="py-1 text-muted">Updated {new Date(row.updated_at).toLocaleDateString()}</span></div></div>
        <div className="flex flex-wrap items-center gap-2"><button disabled={busy} onClick={() => edit(row)} className="min-h-11 rounded-lg border px-3 text-sm">Edit</button><button disabled={(row.provider==="youtube"?!row.provider_video_id:!row.storage_key) || busy} onClick={() => setPreview(preview?.id === row.id ? null : row)} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40">Preview</button><button disabled={(row.provider==="youtube"?!row.provider_video_id:!row.storage_key) || row.status === "archived" || busy} onClick={() => archive(row)} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40">Archive</button></div>
        {preview?.id === row.id && <div className="max-w-3xl xl:col-span-2">{row.provider==="native"?<NativeRecordedClassPlayer recordingId={row.id} title={row.title}/>:row.provider_video_id&&<YouTubePlayer key={row.id} videoId={row.provider_video_id} title={row.title}/>}</div>}
      </article>)}</div>}
      <div className="flex items-center justify-between gap-3 text-sm"><button disabled={page === 0 || loading} onClick={() => setPage(x => x-1)} className="min-h-11 px-3 disabled:opacity-40">Previous</button><span>{count} recordings · Page {page+1}</span><button disabled={(page+1)*pageSize >= count || loading} onClick={() => setPage(x => x+1)} className="min-h-11 px-3 disabled:opacity-40">Next</button></div>
    </>}
  </div>;
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecordingPlayback } from "@/components/live/recording-playback";
import { academicLocalToUtc, formatAcademicDate, utcToAcademicLocalInput } from "@/lib/live-class/date";

type Named = { id: string; name: string };
type Teacher = Named & { email: string | null };
type Recording = { id: string; status: string; total_bytes: number; duration_seconds: number | null; client_validated_at: string | null; verified_at: string | null; published_at: string | null; error_message: string | null };
type Session = {
  id: string; title: string; status: string; provider: string; starts_at: string | null; ends_at: string | null; recording_enabled: boolean; max_receivers: number | null;
  attendeeCount?: number; attendanceSeconds?: number;
  programs: { name: string } | { name: string }[] | null; subjects: { name: string } | { name: string }[] | null;
  batches: { name: string } | { name: string }[] | null; profiles: { full_name: string } | { full_name: string }[] | null;
  class_recordings: Recording[];
};
type Configuration = { classroomEnabled: boolean; recordingEnabled: boolean; realtimeConfigured: boolean; r2Configured: boolean; turnConfigured: boolean; missingRealtime: string[]; missingR2: string[]; missingTurn: string[] };
const first = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] : value;

export function LiveClassesManager({ programs, subjects, batches, teachers, sessions: initialSessions, usageBytes, configuration, timeZone }:
  { programs: Named[]; subjects: Named[]; batches: (Named & { program_id: string })[]; teachers: Teacher[]; sessions: Session[]; usageBytes: number; configuration: Configuration; timeZone: string }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState("");
  const [reviewing, setReviewing] = useState("");
  const [message, setMessage] = useState("");
  const [programId, setProgramId] = useState(programs[0]?.id || "");
  const [teachingHours, setTeachingHours] = useState(40);
  const [estimatedReceivers, setEstimatedReceivers] = useState(50);
  const [mediaMbps, setMediaMbps] = useState(1);
  const [headroomPercent, setHeadroomPercent] = useState(20);
  const [realtimeAllowanceGb, setRealtimeAllowanceGb] = useState(1000);
  const [realtimePerGb, setRealtimePerGb] = useState(0.05);
  const [recordingMbps, setRecordingMbps] = useState(1);
  const [retentionHours, setRetentionHours] = useState(240);
  const [storageAllowanceGb, setStorageAllowanceGb] = useState(10);
  const [storagePerGbMonth, setStoragePerGbMonth] = useState(0.015);
  const estimate = useMemo(() => {
    const mediaGb = 0.45 * mediaMbps * estimatedReceivers * teachingHours * (1 + headroomPercent / 100);
    const recordedGb = 0.45 * recordingMbps * retentionHours;
    return { mediaGb, recordedGb, total: Math.max(0, mediaGb - realtimeAllowanceGb) * realtimePerGb + Math.max(0, recordedGb - storageAllowanceGb) * storagePerGbMonth };
  }, [estimatedReceivers, headroomPercent, mediaMbps, realtimeAllowanceGb, realtimePerGb, recordingMbps, retentionHours, storageAllowanceGb, storagePerGbMonth, teachingHours]);

  async function schedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("schedule"); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/live-classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: form.get("title"), programId: form.get("programId"), subjectId: form.get("subjectId"), batchId: form.get("batchId"), teacherId: form.get("teacherId"),
        startsAt: academicLocalToUtc(String(form.get("startsAt")), timeZone), endsAt: academicLocalToUtc(String(form.get("endsAt")), timeZone),
        recordingEnabled: form.get("recordingEnabled") === "on", maxReceivers: Number(form.get("maxReceivers")) || null,
      }) });
      const value = await response.json() as { id?: string; error?: string };
      if (!response.ok) throw new Error(value.error || "Class could not be scheduled");
      setMessage("Class scheduled. Refreshing the operational list…"); window.location.reload();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Class could not be scheduled"); }
    finally { setBusy(""); }
  }

  async function control(classId: string, action: "cancel") {
    setBusy(classId); setMessage("");
    try {
      const response = await fetch(`/api/live-classes/${classId}/control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, mode: "classroom" }) });
      const value = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(value.error || "Class update failed");
      setSessions(current => current.map(item => item.id === classId ? { ...item, status: value.status || "cancelled" } : item));
      setMessage("Class cancelled. No participant can enter it.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Class update failed"); }
    finally { setBusy(""); }
  }

  async function reschedule(event: React.FormEvent<HTMLFormElement>, session: Session) {
    event.preventDefault(); setBusy(session.id); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const title = String(form.get("title") || "");
      const startsAt = academicLocalToUtc(String(form.get("startsAt")), timeZone);
      const endsAt = academicLocalToUtc(String(form.get("endsAt")), timeZone);
      const response = await fetch(`/api/live-classes/${session.id}/control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reschedule", mode: "classroom", title, startsAt, endsAt }) });
      const value = await response.json() as { error?: string };
      if (!response.ok) throw new Error(value.error || "Class could not be updated");
      setSessions(current => current.map(item => item.id === session.id ? { ...item, title, starts_at: startsAt, ends_at: endsAt } : item));
      setEditing(""); setMessage("Class schedule updated in the academic timezone.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Class could not be updated"); }
    finally { setBusy(""); }
  }

  async function publication(classId: string, recordingId: string, action: "review" | "publish" | "unpublish") {
    setBusy(recordingId); setMessage("");
    try {
      const session = sessions.find(value => value.id === classId);
      const mode = session?.provider === "cloudflare-poc" ? "poc" : "classroom";
      const response = await fetch(`/api/live-classes/${classId}/recordings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, recordingId, mode }) });
      const value = await response.json() as { status?: string; error?: string };
      if (!response.ok) throw new Error(value.error || "Recording publication failed");
      const now = new Date().toISOString();
      setSessions(current => current.map(item => item.id !== classId ? item : { ...item, class_recordings: item.class_recordings.map(recording => recording.id === recordingId ? {
        ...recording,
        status: value.status || recording.status,
        verified_at: action === "review" ? now : recording.verified_at,
        published_at: action === "publish" ? now : action === "unpublish" ? null : recording.published_at,
      } : recording) }));
      if (action === "review") { setReviewing(""); setMessage("Recording approved after Admin playback review. It remains unpublished."); }
      if (action === "publish") setMessage("Validated recording published to eligible students.");
      if (action === "unpublish") setMessage("Recording removed from student playback.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Recording publication failed"); }
    finally { setBusy(""); }
  }

  const providerReady = configuration.classroomEnabled && configuration.realtimeConfigured;
  return <div>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Academic operations</p><h1 className="mt-2 text-3xl font-bold">Native live classes</h1><p className="mt-2 max-w-3xl text-sm text-muted">Schedule only against authenticated Teacher accounts and current ALS academic scope. Provider secrets remain server-side.</p></div><span className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold ${providerReady ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-950"}`}><ShieldCheck size={18}/>{providerReady ? "Classroom ready" : "Configuration required"}</span></header>
    {!providerReady && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950" role="status">Normal live entry is unavailable. {!configuration.classroomEnabled ? "ALS_LIVE_CLASS_ENABLED is disabled. " : ""}{configuration.missingRealtime.length ? `Missing ${configuration.missingRealtime.join(", ")}.` : ""} No provider-ready state is simulated.</p>}
    {message && <p className="mt-5 rounded-xl border border-line bg-white p-4 text-sm" role="status">{message}</p>}

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <form onSubmit={schedule} className="card grid gap-4 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarPlus className="text-brand" size={20}/>Schedule a class</h2><p className="mt-1 text-sm text-muted">Times are entered in {timeZone} and stored in UTC.</p></div>
        <Field label="Class title"><input required name="title" maxLength={180} className="control"/></Field>
        <Field label="Program"><select required name="programId" value={programId} onChange={event => setProgramId(event.target.value)} className="control"><option value="">Select program</option>{programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Subject"><select required name="subjectId" className="control"><option value="">Select subject</option>{subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Batch"><select required name="batchId" className="control"><option value="">Select batch</option>{batches.filter(item => !programId || item.program_id === programId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Authenticated Teacher"><select required name="teacherId" className="control"><option value="">Select Teacher</option>{teachers.map(item => <option key={item.id} value={item.id}>{item.name}{item.email ? ` · ${item.email}` : ""}</option>)}</select></Field>
        <Field label={`Starts (${timeZone})`}><input required name="startsAt" type="datetime-local" className="control"/></Field>
        <Field label={`Ends (${timeZone})`}><input required name="endsAt" type="datetime-local" className="control"/></Field>
        <Field label="Expected receivers"><input name="maxReceivers" type="number" min="1" max="500" defaultValue="30" className="control"/></Field>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-line px-3 text-sm font-semibold"><input name="recordingEnabled" type="checkbox"/>Allow Teacher recording</label>
        <Button className="sm:col-span-2" disabled={busy === "schedule" || !programs.length || !teachers.length}>{busy === "schedule" ? "Scheduling…" : "Schedule class"}</Button>
      </form>

      <section className="card p-5"><h2 className="font-bold">Usage and cost estimate</h2><p className="mt-1 text-sm text-muted">Planning model only. Assumptions dated 24 Sep 2026; account-wide allowances and invoices remain authoritative.</p><div className="mt-4 grid grid-cols-2 gap-3"><EstimateField label="Total teaching hours" value={teachingHours} set={setTeachingHours}/><EstimateField label="Avg receivers" value={estimatedReceivers} set={setEstimatedReceivers}/><EstimateField label="Received Mbps" value={mediaMbps} set={setMediaMbps} step="0.1"/><EstimateField label="Headroom %" value={headroomPercent} set={setHeadroomPercent}/><EstimateField label="SFU allowance GB" value={realtimeAllowanceGb} set={setRealtimeAllowanceGb}/><EstimateField label="Realtime $/GB" value={realtimePerGb} set={setRealtimePerGb} step="0.001"/><EstimateField label="Recording Mbps" value={recordingMbps} set={setRecordingMbps} step="0.1"/><EstimateField label="Library hours" value={retentionHours} set={setRetentionHours}/><EstimateField label="R2 allowance GB" value={storageAllowanceGb} set={setStorageAllowanceGb}/><EstimateField label="R2 $/GB-month" value={storagePerGbMonth} set={setStoragePerGbMonth} step="0.001"/></div><dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>Estimated delivered media</dt><dd className="font-bold tabular-nums">{estimate.mediaGb.toFixed(2)} GB</dd></div><div className="flex justify-between gap-3"><dt>Estimated recording storage</dt><dd className="font-bold tabular-nums">{estimate.recordedGb.toFixed(2)} GB</dd></div><div className="flex justify-between gap-3 border-t pt-2"><dt>Estimated SFU + storage</dt><dd className="font-bold tabular-nums">${estimate.total.toFixed(2)}</dd></div><div className="flex justify-between gap-3"><dt>Measured RTP payload counters</dt><dd className="font-bold tabular-nums">{(usageBytes / 1_000_000_000).toFixed(3)} GB</dd></div></dl><p className="mt-4 text-xs text-muted">The default reference produces 1,080 GB live, 108 GB storage, and $5.47 after entered allowances. Excludes protocol overhead, hosting, requests, taxes, and other account usage. Browser counters are diagnostics, not billing records.</p></section>
    </div>

    <section className="mt-7"><div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Scheduled and recent classes</h2><p className="mt-1 text-sm text-muted">Lifecycle, attendance access, transport diagnostics, and reviewed recordings.</p></div><span className="text-sm font-bold text-muted">{sessions.length} classes</span></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{sessions.map(session => <article key={session.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-brand">{first(session.subjects)?.name || "Live learning"}</p><h3 className="mt-2 text-lg font-bold">{session.title}</h3></div><span className="rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase">{session.status}</span></div><p className="mt-3 text-sm text-muted">{first(session.programs)?.name || "Program"} · {first(session.batches)?.name || "Cohort"}</p><p className="mt-1 text-sm text-muted">{first(session.profiles)?.full_name || "Teacher"} · {formatAcademicDate(session.starts_at, timeZone)}</p><div className="mt-4 flex flex-wrap gap-2"><Link href={`/admin/live-classes/${session.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white"><Radio size={16}/>Open classroom</Link>{["draft", "scheduled"].includes(session.status) && <><Button variant="secondary" disabled={busy === session.id} onClick={() => setEditing(current => current === session.id ? "" : session.id)}>Edit schedule</Button><Button variant="secondary" disabled={busy === session.id} onClick={() => void control(session.id, "cancel")}>Cancel</Button></>}</div>
          {editing === session.id && <form className="mt-4 grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2" onSubmit={event => void reschedule(event, session)}><Field label="Title"><input name="title" required maxLength={180} defaultValue={session.title} className="control"/></Field><span/><Field label={`Starts (${timeZone})`}><input name="startsAt" type="datetime-local" required defaultValue={utcToAcademicLocalInput(session.starts_at, timeZone)} className="control"/></Field><Field label={`Ends (${timeZone})`}><input name="endsAt" type="datetime-local" required defaultValue={utcToAcademicLocalInput(session.ends_at, timeZone)} className="control"/></Field><Button className="sm:col-span-2" disabled={busy === session.id}>Save schedule</Button></form>}
          <p className="mt-3 text-xs font-semibold text-muted">Attendance: {session.attendeeCount || 0} unique participant(s) · {Math.round((session.attendanceSeconds || 0) / 60)} interval minutes</p>
          {!!session.class_recordings.length && <div className="mt-4 space-y-2 border-t border-line pt-4"><h4 className="text-sm font-bold">Recording review</h4>{session.class_recordings.map(recording => { const reviewKey = `${session.id}:${recording.id}`; return <div key={recording.id} className="rounded-lg bg-surface p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="capitalize">{recording.status}</b><p className="text-xs text-muted">{(recording.total_bytes / 1048576).toFixed(1)} MiB{recording.verified_at ? " · Admin verified" : recording.client_validated_at ? " · Teacher playback evidence received" : " · validation pending"}</p></div><div className="flex flex-wrap gap-2">{recording.status === "validating" && recording.client_validated_at && <Button variant="secondary" disabled={busy === recording.id} onClick={() => setReviewing(current => current === reviewKey ? "" : reviewKey)}>{reviewing === reviewKey ? "Close review" : "Review media"}</Button>}{recording.status === "ready" && recording.verified_at && <Button variant="secondary" disabled={busy === recording.id} onClick={() => void publication(session.id, recording.id, "publish")}>Publish</Button>}{recording.status === "published" && <Button variant="ghost" disabled={busy === recording.id} onClick={() => void publication(session.id, recording.id, "unpublish")} className="text-red-700">Unpublish</Button>}</div></div>{reviewing === reviewKey && <div className="mt-4 border-t border-line pt-4"><RecordingPlayback classId={session.id} recordingId={recording.id} title={session.title} review/><p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">Approval records an Admin trust decision. Confirm every segment decodes, seeks, contains Teacher audio and the intended teaching visual, and excludes private classroom panels.</p><Button className="mt-3" disabled={busy === recording.id} onClick={() => void publication(session.id, recording.id, "review")}>Approve after playback review</Button></div>}</div>; })}</div>}
        </article>)}{!sessions.length && <div className="card p-7 text-sm text-muted">No native classes have been scheduled.</div>}</div>
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-sm font-bold">{label}{children}</label>; }
function EstimateField({ label, value, set, step = "1" }: { label: string; value: number; set: (value: number) => void; step?: string }) { return <label className="text-xs font-bold text-muted">{label}<input type="number" min="0" step={step} value={value} onChange={event => set(Number(event.target.value) || 0)} className="mt-1 min-h-10 w-full rounded-lg border border-line px-2 text-sm text-ink"/></label>; }

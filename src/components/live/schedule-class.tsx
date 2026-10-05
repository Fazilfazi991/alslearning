"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { academicLocalToUtc } from "@/lib/live-class/date";

type Scope = { programId: string; programName: string; subjectId: string; subjectName: string };
const control = "control";
export function ScheduleClass({ scopes, batches, teacherId, timeZone }: {
  scopes: Scope[]; batches: { id: string; name: string; program_id: string }[]; teacherId: string; timeZone: string;
}) {
  const router = useRouter();
  const [scopeIndex, setScopeIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const scope = scopes[scopeIndex];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !scope) return;
    pending.current = true; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/live-classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: form.get("title"), programId: scope.programId, subjectId: scope.subjectId, batchId: form.get("batchId"), teacherId,
        startsAt: academicLocalToUtc(String(form.get("startsAt")), timeZone), endsAt: academicLocalToUtc(String(form.get("endsAt")), timeZone),
        recordingEnabled: form.get("recordingEnabled") === "on",
      }) });
      const result = await response.json();
      if (!response.ok || !result.id) throw new Error(result.error || "Class could not be scheduled");
      router.push(`/teacher/live-classes/${result.id}`); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Class could not be scheduled"); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!scope) return <p role="status">An administrator must assign a program and subject before you can schedule a class.</p>;
  return <form onSubmit={submit} className="card max-w-2xl space-y-5 p-5 sm:p-6">
    <p className="text-sm text-muted">Times use {timeZone}. All fields are required except lesson recording. Students with current access to the selected batch can see and join the class.</p>
    <label className="block font-semibold">Class title<input name="title" required maxLength={180} className={control} /></label>
    <label className="block font-semibold">Program and subject<select aria-label="Program and subject" value={scopeIndex} onChange={event => setScopeIndex(Number(event.target.value))} className={control}>{scopes.map((item, index) => <option key={`${item.programId}:${item.subjectId}`} value={index}>{item.programName} · {item.subjectName}</option>)}</select></label>
    <label className="block font-semibold">Batch<select aria-label="Batch" key={scope.programId} name="batchId" required className={control}><option value="">Select batch</option>{batches.filter(item => item.program_id === scope.programId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="grid gap-5 sm:grid-cols-2"><label className="block min-w-0 font-semibold">Starts at<input type="datetime-local" name="startsAt" required className={control} /></label>
    <label className="block min-w-0 font-semibold">Ends at<input type="datetime-local" name="endsAt" required className={control} /></label></div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="recordingEnabled" className="mt-1 h-4 w-4"/><span><span className="block font-semibold">Enable lesson recording</span><span className="mt-1 block text-muted">Record your shared screen and microphone. An administrator must review and publish the replay before Students can watch it.</span></span></label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={busy} className="min-h-11 rounded-xl bg-brand px-5 font-bold text-white disabled:opacity-50">{busy ? "Scheduling…" : "Schedule class"}</button>
  </form>;
}

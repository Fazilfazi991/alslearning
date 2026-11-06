"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Check, Mail, Phone, UserRoundPlus } from "lucide-react";
import { academicLocalToUtc } from "@/lib/live-class/date";
import { StudentAdmissionForm, type StudentOptions } from "./student-manager";
import { EnquiryAction, EnquiryStatusBadge, enquiryDate, enquiryRequest, enquiryStatuses, statusLabels, type Enquiry, type EnquiryStaff, type EnquiryStatus } from "./enquiries-shared";

type Activity = { id: string; kind: string; note: string; created_at: string; actor_id: string | null; metadata?: Record<string, unknown> };
type FollowUp = { id: string; due_at: string; completed_at: string | null; outcome: string | null; created_at: string };
type Detail = { enquiry: Enquiry; activities: Activity[]; follow_ups: FollowUp[]; staff: EnquiryStaff[] };
const activityLabels: Record<string, string> = { note: "Admin note", contact: "Contact recorded", follow_up: "Follow-up", submitted: "Enquiry received", created: "Enquiry received", status: "Status changed", assignment: "Staff assignment", converted: "Student admitted", updated: "Enquiry updated" };

function ActivityChanges({ activity, staff }: { activity: Activity; staff: EnquiryStaff[] }) {
  const oldStatus = activity.metadata?.old_status as EnquiryStatus | undefined;
  const newStatus = activity.metadata?.status as EnquiryStatus | undefined;
  const studentId = typeof activity.metadata?.student_id === "string" ? activity.metadata.student_id : null;
  const assignee = typeof activity.metadata?.assigned_to === "string" ? activity.metadata.assigned_to : null;
  return <>
    {oldStatus && newStatus && oldStatus !== newStatus && <p className="mt-2 text-xs font-semibold text-deep-blue">{statusLabels[oldStatus] ?? oldStatus} → {statusLabels[newStatus] ?? newStatus}</p>}
    {studentId && <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-brand" href={`/admin/students/${studentId}`}>View admitted student</Link>}
    {activity.metadata && "assigned_to" in activity.metadata && <p className="mt-1 text-xs text-muted">Assigned administrator: {assignee ? staff.find(person => person.id === assignee)?.full_name ?? "ALS administrator" : "Unassigned"}</p>}
  </>;
}

export function EnquiryDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [status, setStatus] = useState<EnquiryStatus>("new"), [assigned, setAssigned] = useState("");
  const [note, setNote] = useState(""), [contact, setContact] = useState(""), [due, setDue] = useState(""), [followNote, setFollowNote] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [converting, setConverting] = useState(false), [options, setOptions] = useState<StudentOptions | null>(null);
  const [admitting, setAdmitting] = useState(false);
  const saving = useRef(false), dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    const result: Detail = await enquiryRequest(`/api/admin/enquiries/${id}`);
    setData(result); setStatus(result.enquiry.status); setAssigned(result.enquiry.assigned_to ?? ""); return result;
  }, [id]);
  useEffect(() => {
    let active = true;
    void enquiryRequest(`/api/admin/enquiries/${id}`).then((result: Detail) => {
      if (active) { setData(result); setStatus(result.enquiry.status); setAssigned(result.enquiry.assigned_to ?? ""); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Enquiry could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => { if (converting) dialog.current?.showModal(); else dialog.current?.close(); }, [converting]);
  async function mutate(path: string, method: string, payload: unknown, confirmation: string, clear?: () => void) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await enquiryRequest(path, method, payload); clear?.();
      setMessage(confirmation); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Changes could not be saved."); }
    finally { saving.current = false; setBusy(false); }
  }
  async function beginConversion() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const available = await enquiryRequest("/api/admin/students");
      setOptions({ programs: available.programs, batches: available.batches }); setConverting(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Admission options could not be loaded."); }
    finally { saving.current = false; setBusy(false); }
  }
  const enquiry = data?.enquiry;
  const pending = data?.follow_ups.filter(item => !item.completed_at) ?? [];
  const isConverted = enquiry?.status === "converted" || !!enquiry?.student_id;
  function activity(payload: unknown, confirmation: string, clear?: () => void) { return mutate(`/api/admin/enquiries/${id}/activities`, "POST", payload, confirmation, clear); }
  return <>
    <Link href="/admin/enquiries" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand"><ArrowLeft size={17} aria-hidden="true" />All enquiries</Link>
    {loading && <p role="status" className="rounded-xl border border-line bg-white p-8 text-muted">Loading enquiry…</p>}
    {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}{!data && <button className="ml-3 min-h-11 font-bold underline" onClick={() => { setLoading(true); setError(""); void load().catch(reason => setError((reason as Error).message)).finally(() => setLoading(false)); }}>Retry</button>}</div>}
    {message && <p role="status" className="mb-5 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-800"><Check size={18} aria-hidden="true" />{message}</p>}
    {data && enquiry && <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><p className="eyebrow">Admissions · enquiry</p><h1 className="mt-2 break-words text-[28px] font-bold tracking-tight">{enquiry.full_name}</h1><p className="mt-2 text-sm text-muted">Received {enquiryDate(enquiry.created_at, true)} (Dubai)</p></div>
        <div className="flex flex-wrap items-center gap-3"><EnquiryStatusBadge status={enquiry.status} />{enquiry.student_id ? <EnquiryAction href={`/admin/students/${enquiry.student_id}`} primary>Open student profile</EnquiryAction> : <EnquiryAction disabled={busy} onClick={() => void beginConversion()} primary><UserRoundPlus size={17} aria-hidden="true" />Convert to student</EnquiryAction>}</div>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" aria-labelledby="enquiry-contact-title">
            <h2 id="enquiry-contact-title" className="text-lg font-bold">Student interest</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs font-semibold text-muted">Phone / WhatsApp</dt><dd className="mt-2"><a className="inline-flex min-h-11 items-center gap-2 break-all text-sm font-bold text-deep-blue" href={`tel:${enquiry.phone}`}><Phone size={16} aria-hidden="true" />{enquiry.phone}</a></dd></div><div><dt className="text-xs font-semibold text-muted">Email</dt><dd className="mt-2">{enquiry.email ? <a className="inline-flex min-h-11 items-center gap-2 break-all text-sm font-bold text-deep-blue" href={`mailto:${enquiry.email}`}><Mail size={16} aria-hidden="true" />{enquiry.email}</a> : <span className="text-sm text-muted">Not provided · complete at admission</span>}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted">Interested course</dt><dd className="mt-2 font-bold">{enquiry.programs?.name ?? "Program unavailable"}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted">Enquiry message</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{enquiry.message || "No message supplied."}</dd></div></dl>
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" aria-labelledby="contact-history-title">
            <h2 id="contact-history-title" className="text-lg font-bold">Contact history & notes</h2><p className="mt-2 text-sm text-muted">Record what was discussed so the next conversation starts in the right place.</p>
            <form className="mt-5 space-y-3" onSubmit={event => { event.preventDefault(); void activity({ kind: "contact", note: contact }, "Contact recorded. The enquiry is marked contacted when it is new.", () => setContact("")); }}>
              <label className="block text-sm font-semibold">Contact outcome<textarea required rows={3} maxLength={4000} className="control" value={contact} disabled={busy} onChange={event => setContact(event.target.value)} placeholder="Call, WhatsApp or email outcome" /></label><EnquiryAction type="submit" disabled={busy || !contact.trim()}>Record contact</EnquiryAction>
            </form>
            <form className="mt-6 space-y-3 border-t border-line pt-5" onSubmit={event => { event.preventDefault(); void activity({ kind: "note", note }, "Admin note added.", () => setNote("")); }}><label className="block text-sm font-semibold">Admin note<textarea required rows={3} maxLength={4000} className="control" value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="Internal context for the admissions team" /></label><EnquiryAction type="submit" disabled={busy || !note.trim()}>Add note</EnquiryAction></form>
            <ol className="mt-7 divide-y divide-line" aria-label="Enquiry activity history">{data.activities.length ? data.activities.map(item => <li key={item.id} className="py-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-bold">{activityLabels[item.kind] ?? item.kind.replaceAll("_", " ")}</h3><time dateTime={item.created_at} className="text-xs text-muted">{enquiryDate(item.created_at, true)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.note}</p><ActivityChanges activity={item} staff={data.staff} /><p className="mt-1 text-xs text-muted">{item.actor_id ? data.staff.find(person => person.id === item.actor_id)?.full_name ?? "ALS administrator" : "Homepage enquiry"}</p></li>) : <li className="py-4 text-sm text-muted">No activity has been recorded yet.</li>}</ol>
          </section>
        </div>
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" aria-labelledby="enquiry-manage-title">
            <h2 id="enquiry-manage-title" className="text-lg font-bold">Manage enquiry</h2>
            <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void mutate(`/api/admin/enquiries/${id}`, "PATCH", { ...(!isConverted ? { status } : {}), assigned_to: assigned || null }, "Enquiry updated."); }}>
              <label className="block text-sm font-semibold">Lead status<select className="control" value={status} disabled={busy || isConverted} onChange={event => setStatus(event.target.value as EnquiryStatus)}>{enquiryStatuses.filter(value => value !== "converted" || isConverted).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
              <label className="block text-sm font-semibold">Assigned administrator<select className="control" value={assigned} disabled={busy} onChange={event => setAssigned(event.target.value)}><option value="">Unassigned</option>{data.staff.map(person => <option key={person.id} value={person.id}>{person.full_name || person.email}</option>)}</select></label>
              {isConverted && <p className="text-xs leading-5 text-muted">Admission is complete. Conversion history is preserved in the activity log and the linked student profile.</p>}
              <EnquiryAction type="submit" disabled={busy} primary>{busy ? "Saving…" : "Save changes"}</EnquiryAction>
            </form>
          </section>
          <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" aria-labelledby="enquiry-follow-title">
            <div className="flex items-center gap-2"><CalendarClock size={19} className="text-brand" aria-hidden="true" /><h2 id="enquiry-follow-title" className="text-lg font-bold">Follow-ups</h2><span className="ml-auto text-sm tabular-nums text-muted">{pending.length} pending</span></div>
            {!isConverted && <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void activity({ kind: "follow_up", note: followNote, due_at: academicLocalToUtc(due, "Asia/Dubai") }, "Follow-up scheduled.", () => { setDue(""); setFollowNote(""); }); }}><label className="block text-sm font-semibold">Follow-up date & time (Dubai)<input type="datetime-local" className="control" required disabled={busy} value={due} onChange={event => setDue(event.target.value)} /></label><label className="block text-sm font-semibold">Next step<textarea className="control" rows={2} required maxLength={4000} disabled={busy} value={followNote} onChange={event => setFollowNote(event.target.value)} /></label><EnquiryAction type="submit" disabled={busy || !due || !followNote.trim()}>Schedule follow-up</EnquiryAction></form>}
            <div className="mt-5 divide-y divide-line">{data.follow_ups.length ? data.follow_ups.map(item => <article key={item.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><time className="text-sm font-bold" dateTime={item.due_at}>{enquiryDate(item.due_at, true)}</time><span className={`text-xs font-bold ${item.completed_at ? "text-green-800" : "text-amber-900"}`}>{item.completed_at ? "Completed" : "Pending"}</span></div>{item.completed_at ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{item.outcome}</p> : <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void activity({ kind: "follow_up", follow_up_id: item.id, note: outcomes[item.id] || "", outcome: outcomes[item.id] || "" }, "Follow-up outcome recorded.", () => setOutcomes(current => ({ ...current, [item.id]: "" }))); }}><label className="block text-sm font-semibold">Follow-up outcome<textarea rows={2} required className="control" maxLength={4000} value={outcomes[item.id] || ""} disabled={busy} onChange={event => setOutcomes(current => ({ ...current, [item.id]: event.target.value }))} /></label><EnquiryAction type="submit" disabled={busy || !outcomes[item.id]?.trim()}>Complete follow-up</EnquiryAction></form>}</article>) : <p className="py-4 text-sm text-muted">No follow-ups scheduled.</p>}</div>
          </section>
        </div>
      </div>
    </>}
    <dialog ref={dialog} onCancel={event => { if (admitting) event.preventDefault(); else setConverting(false); }} aria-labelledby="student-admission-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-line bg-white p-5 sm:p-7 backdrop:bg-black/40">
      {converting && options && enquiry && <StudentAdmissionForm options={options} onBusyChange={setAdmitting} enquiry={{ enquiry_id: enquiry.id, full_name: enquiry.full_name, phone: enquiry.phone, email: enquiry.email, program_id: enquiry.program_id }} onCancel={() => setConverting(false)} onCreated={() => { setConverting(false); setMessage("Student admitted. The enquiry is converted and linked to the permanent student record."); void load().catch(reason => setError((reason as Error).message)); }} />}
    </dialog>
  </>;
}

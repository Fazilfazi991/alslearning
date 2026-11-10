"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { registrationReadiness } from "@/lib/registration-readiness";
import { actionStyle, date, Panel, primaryStyle, request, setupStatus, Status } from "./admin-shared";
import { ExistingStudentApproval } from "./existing-student-approval";

type Application = { id: string; full_name: string; email: string; phone: string; qualification: string; institution: string; program_id: string; preferred_batch_id: string | null; notes: string | null; status: "pending" | "ready_for_approval" | "needs_information" | "approved" | "rejected"; created_at: string; consent_at?: string | null; student_id: string | null; invitation_status?: string | null; programs: { name: string; status: string } | null };
type Batch = { id: string; name: string; program_id: string; status: string; batch_code: string | null; max_students: number | null; active_students: number; registration_default: boolean };
type Event = { id: string; kind: string; details: unknown; created_at: string };
type Detail = { application: Application; batches: Batch[]; programs: { id: string; name: string; status: string }[]; events: Event[]; identity_conflict: boolean };
type Editable = Pick<Application, "full_name" | "email" | "phone" | "qualification" | "institution" | "program_id" | "preferred_batch_id" | "notes">;

export function RegistrationDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null), [batch, setBatch] = useState(""), [editing, setEditing] = useState(false), [draft, setDraft] = useState<Editable | null>(null);
  const [reason, setReason] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const next: Detail = await request(`/api/admin/registrations/${encodeURIComponent(id)}`);
    setData(next);
    const app = next.application;
    setDraft({ full_name: app.full_name, email: app.email, phone: app.phone, qualification: app.qualification, institution: app.institution, program_id: app.program_id, preferred_batch_id: app.preferred_batch_id, notes: app.notes });
    const defaults = next.batches.filter(item => item.registration_default && item.program_id === app.program_id && item.status === "active" && item.batch_code && (item.max_students === null || item.active_students < item.max_students));
    setBatch(defaults.length === 1 ? defaults[0].id : "");
  }, [id]);
  useEffect(() => { let active = true; const timer = setTimeout(() => { void load().catch(e => { if (active) setError(e instanceof Error ? e.message : "Application could not be loaded."); }).finally(() => { if (active) setLoading(false); }); }, 0); return () => { active = false; clearTimeout(timer); }; }, [load]);
  async function perform(path: string, method: string, body: unknown, message: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request(path, method, body);
      setNotice(result.invitation === "deferred"
        ? "The application is approved, but email invitations are not enabled. No setup link was sent. Send one after email is configured."
        : result.invitation === "failed"
          ? "The setup link could not be sent. Check the setup status and retry when email is available."
          : message);
      setEditing(false); setReason("");
      try { await load(); } catch { setError("The action was saved, but the application could not be refreshed. Reload before making another change."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Action could not be completed."); }
    finally { setBusy(false); }
  }
  const app = data?.application;
  const missing = app ? [["full name", app.full_name], ["email", app.email], ["phone", app.phone], ["qualification", app.qualification], ["institution", app.institution], ["program", app.program_id], ["consent", app.consent_at]].filter(([, value]) => !value).map(([label]) => String(label)) : [];
  const readiness = app && data ? registrationReadiness({ status: app.status, programId: app.program_id, programActive: app.programs?.status === "active", selectedBatchId: batch || null, missingFields: missing, identityConflict: data.identity_conflict, batches: data.batches.map(item => ({ id: item.id, programId: item.program_id, status: item.status, batchCode: item.batch_code, maxStudents: item.max_students, activeStudents: item.active_students, approvedDefault: item.registration_default })) }) : null;
  const existingReadiness = app && data ? registrationReadiness({ status: app.status, programId: app.program_id, programActive: app.programs?.status === "active", selectedBatchId: batch || null, missingFields: missing, identityConflict: false, batches: data.batches.map(item => ({ id: item.id, programId: item.program_id, status: item.status, batchCode: item.batch_code, maxStudents: item.max_students, activeStudents: item.active_students, approvedDefault: item.registration_default })) }) : null;
  const terminal = app?.status === "approved" || app?.status === "rejected";
  return <>
    <Link href="/admin/registrations" className="inline-flex min-h-11 items-center text-sm font-bold text-brand hover:underline">← All registrations</Link>
    {loading ? <p role="status" className="py-12 text-muted">Loading application…</p> : !app || !data ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error || "Application unavailable."}</p> : <>
      <header className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Student application</p><h1 className="mt-2 break-words text-[28px] font-bold tracking-tight">{app.full_name}</h1><p className="mt-2 text-sm text-muted">Received {date(app.created_at)}</p></div><Status value={app.status} /></header>
      {error && <p role="alert" className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mb-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">{notice}</p>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="grid gap-5">
        <Panel title="Application details">
          {!editing ? <><dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">{[["Full name", app.full_name], ["Email", app.email], ["Phone / WhatsApp", app.phone], ["Qualification", app.qualification], ["Institution", app.institution], ["Program", app.programs?.name], ["Preferred batch", data.batches.find(item => item.id === app.preferred_batch_id)?.name], ["Consent", app.consent_at ? date(app.consent_at) : "Not recorded"], ["Additional information", app.notes]].map(([label, value]) => <div key={label || ""}><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{value || "—"}</dd></div>)}</dl>{!terminal && <button className={`${actionStyle} mt-6`} onClick={() => setEditing(true)}>Edit details</button>}</> : draft && <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void perform(`/api/admin/registrations/${encodeURIComponent(id)}`, "PATCH", { action: "edit", changes: draft }, "Application details saved."); }}>
            {([ ["full_name", "Full name"], ["email", "Email"], ["phone", "Phone / WhatsApp"], ["qualification", "Qualification"], ["institution", "Institution"] ] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input className="control" required value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
            <label className="text-sm font-semibold">Program<select className="control" value={draft.program_id} onChange={e => setDraft({ ...draft, program_id: e.target.value, preferred_batch_id: null })}>{data.programs.map(program => <option key={program.id} value={program.id}>{program.name}{program.status !== "active" ? " (inactive)" : ""}</option>)}</select></label>
            <label className="text-sm font-semibold sm:col-span-2">Additional information<textarea className="control" rows={4} maxLength={2000} value={draft.notes || ""} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label>
            <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" className={primaryStyle} disabled={busy}>Save changes</button><button type="button" className={actionStyle} disabled={busy} onClick={() => setEditing(false)}>Cancel</button></div>
          </form>}
        </Panel>
        <Panel title="Review history">{data.events.length ? <ol className="mt-5 space-y-4">{data.events.map(event => <li key={event.id} className="border-l-2 border-brand/20 pl-4"><p className="text-sm font-semibold">{event.kind.replaceAll("_", " ")}</p><time className="text-xs text-muted" dateTime={event.created_at}>{date(event.created_at)}</time>{typeof event.details === "object" && event.details !== null && "reason" in event.details && typeof event.details.reason === "string" && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{event.details.reason}</p>}</li>)}</ol> : <p className="mt-4 text-sm text-muted">No review activity yet.</p>}</Panel>
      </div><div className="grid gap-5"><Panel title="Admission review">
        {terminal ? <><p className="mt-4 text-sm leading-6 text-muted">{app.status === "approved" ? "This application has been approved." : "This application has been rejected."}</p>{app.status === "approved" && <p className="mt-3 text-sm font-semibold">{setupStatus(app.invitation_status)}</p>}{app.status === "approved" && app.student_id && <Link href={`/admin/students/${app.student_id}`} className={`${actionStyle} mt-4`}>Open student</Link>}{app.status === "approved" && app.invitation_status !== "not_required" && <><p className="mt-3 text-xs leading-5 text-muted">Setup links are sent only when email is configured. They are not sent automatically later; return here to send one. Links already sent can be resent after one hour.</p><button className={`${actionStyle} mt-3`} disabled={busy} onClick={() => void perform(`/api/admin/registrations/${encodeURIComponent(id)}/invite`, "POST", {}, "Setup link sent.")}>Send setup link</button></>}</> : <>
          <p className="mt-3 text-sm leading-6 text-muted">Approval creates a student record only after the admission checks pass. Capacity and identity are checked again when you approve. New students need a setup link before they can sign in; if email is unavailable, send the link after it is configured.</p>
          <label className="mt-5 block text-sm font-semibold">Assign batch<select className="control" value={batch} onChange={e => setBatch(e.target.value)}><option value="">Choose a batch</option>{data.batches.map(item => <option key={item.id} value={item.id} disabled={item.status !== "active" || !item.batch_code || (item.max_students !== null && item.active_students >= item.max_students)}>{item.name} · {item.active_students}/{item.max_students ?? "unlimited"}{item.status !== "active" ? " · inactive" : item.max_students !== null && item.active_students >= item.max_students ? " · full" : !item.batch_code ? " · missing code" : ""}</option>)}</select></label>
          {readiness?.reasons.length ? <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Before approval</p><ul className="mt-2 list-disc space-y-1 pl-5">{readiness.reasons.map(reasonText => <li key={reasonText}>{reasonText}</li>)}</ul></div> : <p className="mt-4 text-sm font-semibold text-green-800">Ready for final admission checks.</p>}
          <button className={`${primaryStyle} mt-5 w-full`} disabled={busy || editing || !readiness?.ready} onClick={() => void perform(`/api/admin/registrations/${encodeURIComponent(id)}/approve`, "POST", { batch_id: batch }, "Application approved and setup link sent.")}>Approve application</button>
          {app.status === "pending" && <ExistingStudentApproval id={id} batchId={batch} eligible={existingReadiness?.ready === true} disabled={busy || editing} onApproved={load} />}
          <label className="mt-6 block text-sm font-semibold">Review note<textarea className="control" rows={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain what is needed or why the application is rejected" /></label>
          <div className="mt-3 grid gap-2"><button className={actionStyle} disabled={busy || !reason.trim()} onClick={() => void perform(`/api/admin/registrations/${encodeURIComponent(id)}`, "PATCH", { action: "needs_information", changes: { reason: reason.trim() } }, "Application marked as needing information.")}>Request information</button><button className={actionStyle} disabled={busy || !reason.trim()} onClick={() => void perform(`/api/admin/registrations/${encodeURIComponent(id)}`, "PATCH", { action: "rejected", changes: { reason: reason.trim() } }, "Application rejected.")}>Reject application</button></div>
        </>}
      </Panel></div></div>
    </>}
  </>;
}

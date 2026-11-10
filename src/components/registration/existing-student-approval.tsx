"use client";
import { useEffect, useState } from "react";
import { actionStyle, primaryStyle, request } from "./admin-shared";

/** The readiness check is advisory. Approval always revalidates in SQL. */
export function ExistingStudentApproval({ id, batchId, eligible, disabled, onApproved }: { id: string; batchId: string; eligible: boolean; disabled: boolean; onApproved: () => Promise<void> }) {
  const [ready, setReady] = useState(false), [checking, setChecking] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void request(`/api/admin/registrations/${encodeURIComponent(id)}/link-existing`, "GET", undefined, controller.signal).then(result => setReady(result.ready === true)).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Account verification is unavailable."); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [id]);
  async function approve() {
    if (busy || disabled || !ready || !eligible || !batchId) return;
    setBusy(true); setError("");
    try {
      const result = await request(`/api/admin/registrations/${encodeURIComponent(id)}/link-existing`, "POST", { batch_id: batchId });
      if (result.success !== true || result.linked_existing !== true) throw new Error("Approval could not be verified. Refresh before retrying.");
      setReady(false);
      try { await onApproved(); } catch { setError("The approval was saved, but the application could not be refreshed. Reload before making another change."); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Approval could not be completed."); }
    finally { setBusy(false); }
  }
  if (checking) return <p className="mt-4 text-xs text-muted" role="status">Checking existing-account verification…</p>;
  if (!ready && !error) return null;
  return <div className="mt-5 rounded-lg border border-brand/20 bg-brand/5 p-4">
    {ready && <><p className="text-sm font-bold">Existing student account verified</p><p className="mt-2 text-sm leading-6 text-muted">The applicant signed in to the matching ALS student account. Approval links this application to that account and preserves its student code and history; no invitation is sent.</p><button type="button" className={`${primaryStyle} mt-4 w-full`} disabled={busy || disabled || !eligible || !batchId} onClick={() => void approve()}>{busy ? "Approving…" : "Approve & link existing student"}</button></>}
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error} <button type="button" className={`${actionStyle} mt-2`} onClick={() => window.location.reload()}>Refresh</button></p>}
  </div>;
}

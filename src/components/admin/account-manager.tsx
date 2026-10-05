"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { passwordHelp, type ManagedRole } from "@/lib/account-validation";

type Account = { id: string; full_name: string; email: string; role: ManagedRole; is_active: boolean };
type Draft = { id?: string; full_name: string; email: string; password: string; is_active: boolean };
const field = "control";
const button = "min-h-11 rounded-lg border border-line px-4 text-sm font-bold disabled:opacity-50 focus-visible:outline-brand";
async function loadAccounts(role: ManagedRole): Promise<Account[]> {
  const response = await fetch(`/api/admin/accounts?role=${role}`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Accounts could not be loaded.");
  return body.accounts;
}

export function AccountManager({ role, onChanged }: { role: ManagedRole; onChanged?: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all"), [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null), submitting = useRef(false);
  const [deactivating, setDeactivating] = useState<Account | null>(null);
  const deactivateDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (deactivating) deactivateDialog.current?.showModal(); else deactivateDialog.current?.close(); }, [deactivating]);
  const title = role === "teacher" ? "Teacher" : "Student";
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await loadAccounts(role)); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Accounts could not be loaded."); }
    finally { setLoading(false); }
  }, [role]);
  useEffect(() => {
    let active = true;
    void loadAccounts(role).then(value => { if (active) setAccounts(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Accounts could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role]);
  useEffect(() => { if (draft) dialog.current?.showModal(); else dialog.current?.close(); }, [draft]);
  function edit(account?: Account) {
    setError(""); setMessage("");
    setDraft({ id: account?.id, full_name: account?.full_name || "", email: account?.email || "", password: "", is_active: account?.is_active ?? true });
  }
  async function commit() {
    if (!draft || submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const payload = draft.id
        ? { id: draft.id, full_name: draft.full_name, is_active: draft.is_active, ...(draft.password ? { password: draft.password } : {}) }
        : { role, full_name: draft.full_name, email: draft.email, password: draft.password };
      const response = await fetch("/api/admin/accounts", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The account could not be saved.");
      setMessage(draft.id ? "Account changes saved." : `${title} login created. Share the email and password privately, then assign access below.`);
      setDraft(null); await refresh(); onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The account could not be saved."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const visible = accounts.filter(account => `${account.full_name} ${account.email}`.toLowerCase().includes(query.trim().toLowerCase()) && (status === "all" || account.is_active === (status === "active")));
  async function deactivate() {
    if (!deactivating || submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deactivating.id, is_active: false }) });
      const body = await response.json();
      if (!response.ok || body.success !== true) throw new Error(body.error || "Student deactivation could not be confirmed.");
      setAccounts(current => current.map(account => account.id === deactivating.id ? { ...account, is_active: false } : account));
      setMessage("Student deactivated. Login and program access are disabled; profile, Auth linkage, enrollments, attendance, results and class history are preserved.");
      setDeactivating(null); onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Student could not be deactivated."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="mb-6 rounded-xl border border-line bg-white p-5" aria-label={`${title} login accounts`}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{title} login accounts</h2><p className="mt-1 text-sm text-muted">Create a login before assigning {role === "teacher" ? "subjects and classes" : "program access"}.</p></div><button className={`${button} bg-brand text-white`} onClick={() => edit()}>Add {role}</button></header>
    {message && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {!draft && !deactivating && error && <p role="alert" className="mt-4 text-sm text-red-800">{error} <button className="underline" onClick={() => void refresh()}>Retry</button></p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]"><label className="text-sm font-semibold">Search accounts<input type="search" className={field} value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or email" /></label><label className="text-sm font-semibold">Account status<select className={field} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
    <div className="mt-4 divide-y divide-line" aria-busy={loading}>{loading ? <p role="status" className="py-4 text-sm text-muted">Loading accounts…</p> : visible.length ? visible.map(account => <article key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><h3 className="break-words font-bold">{account.full_name || "Name not provided"}</h3><p className="break-all text-sm text-muted">{account.email}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${account.is_active ? "bg-green-50 text-green-800" : "bg-surface text-muted"}`}>{account.is_active ? "Active" : "Inactive"}</span><button className={button} onClick={() => edit(account)} aria-label={`Edit account ${account.email}`}>Edit / reset password</button>{role === "student" && account.is_active && <button className={`${button} text-red-700`} disabled={busy} aria-label={`Deactivate Student ${account.email}`} onClick={() => { setError(""); setMessage(""); setDeactivating(account); }}>Deactivate</button>}</article>) : <p className="py-4 text-sm text-muted">No accounts match these filters.</p>}</div>
    <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else setDraft(null); }} className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl border border-line bg-white p-5 backdrop:bg-black/40" aria-labelledby={`account-${role}-title`}>
      {draft && <form onSubmit={event => { event.preventDefault(); void commit(); }} className="space-y-4" aria-busy={busy}>
        <h2 id={`account-${role}-title`} className="text-xl font-bold">{draft.id ? `Edit ${role} account` : `Add ${role}`}</h2>
        <label className="block text-sm font-semibold">Full name<input className={field} required maxLength={120} autoFocus value={draft.full_name} disabled={busy} onChange={event => setDraft({ ...draft, full_name: event.target.value })} /></label>
        <label className="block text-sm font-semibold">Email address<input className={field} type="email" autoCapitalize="none" required maxLength={254} value={draft.email} disabled={busy || !!draft.id} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label>
        <label className="block text-sm font-semibold">{draft.id ? "New password (leave blank to keep current)" : "Initial password"}<input className={field} type="password" autoComplete="new-password" required={!draft.id} minLength={10} maxLength={128} disabled={busy} value={draft.password} onChange={event => setDraft({ ...draft, password: event.target.value })} aria-describedby={`account-${role}-password-help`} /></label>
        <p id={`account-${role}-password-help`} className="text-xs text-muted">{passwordHelp} Share passwords privately.</p>
        {draft.id && <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.is_active} disabled={busy} onChange={event => setDraft({ ...draft, is_active: event.target.checked })} />Active account</label>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" className={button} disabled={busy} onClick={() => setDraft(null)}>Cancel</button><button type="submit" className={`${button} bg-brand text-white`} disabled={busy}>{busy ? "Saving…" : draft.id ? "Save account" : "Create login"}</button></div>
      </form>}
    </dialog>
    <dialog ref={deactivateDialog} aria-labelledby="student-deactivate-title" onCancel={event => { if (busy) event.preventDefault(); else setDeactivating(null); }} className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-xl border border-line bg-white p-6 backdrop:bg-black/40">
      {deactivating && <><h2 id="student-deactivate-title" className="text-xl font-bold">Deactivate Student?</h2><p className="mt-3 break-words text-sm font-semibold">{deactivating.full_name} · {deactivating.email}</p><p className="mt-2 text-sm leading-relaxed text-muted">This disables login and program access. The profile, Auth account, program/batch assignments, attendance, exam results and live-class history stay linked. You can reactivate the Student using Edit account.</p>{error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}<div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={busy} onClick={() => setDeactivating(null)}>Cancel</button><button type="button" className={`${button} bg-red-700 text-white`} disabled={busy} onClick={() => void deactivate()}>{busy ? "Deactivating…" : "Deactivate Student"}</button></div></>}
    </dialog>
  </section>;
}

"use client";
import { useRef, useState } from "react";
import { passwordHelp } from "@/lib/account-validation";

export function ChangePassword() {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const field = "mt-2 min-h-11 w-full rounded-lg border border-line px-3 text-base";
  return <section className="card mt-6 max-w-xl p-6"><h2 className="text-lg font-bold">Change password</h2><p className="mt-2 text-sm text-muted">You’ll sign in again after saving your new password.</p>
    <form className="mt-4 space-y-4" onSubmit={async event => {
      event.preventDefault(); if (submitting.current) return;
      const data = new FormData(event.currentTarget), password = data.get("password");
      if (password !== data.get("confirmation")) { setError("The new passwords do not match."); return; }
      submitting.current = true; setBusy(true); setError("");
      try {
        const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: data.get("current_password"), password }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        window.location.replace("/login?password=changed");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Your password could not be changed."); }
      finally { submitting.current = false; setBusy(false); }
    }} aria-busy={busy}>
      <label className="block text-sm font-semibold">Current password<input type="password" name="current_password" required autoComplete="current-password" disabled={busy} className={field} /></label>
      <label className="block text-sm font-semibold">New password<input type="password" name="password" required minLength={10} maxLength={128} autoComplete="new-password" disabled={busy} className={field} aria-describedby="new-password-help" /></label>
      <p className="text-xs text-muted" id="new-password-help">{passwordHelp}</p>
      <label className="block text-sm font-semibold">Confirm new password<input type="password" name="confirmation" required autoComplete="new-password" disabled={busy} className={field} /></label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-brand px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Change password"}</button>
    </form></section>;
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./public-registration.module.css";

export const ownershipProofStorageKey = "als-registration-proof-request";

/** The opaque request ID stays in this tab, never in a URL or another tab. */
export function OwnershipProof({ requestId }: { requestId?: string | null }) {
  const [id, setId] = useState(requestId ?? null);
  const [pending, setPending] = useState(false), [message, setMessage] = useState(""), [complete, setComplete] = useState(false);
  useEffect(() => {
    if (requestId) return;
    const timer = setTimeout(() => {
      try { setId(window.sessionStorage.getItem(ownershipProofStorageKey)); } catch { /* Storage is optional. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, [requestId]);
  if (!id && !complete) return null;
  async function verify() {
    if (pending || !id) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/registrations/ownership-proof", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id }) });
      const body = await response.json();
      if (!response.ok || body.success !== true) { setMessage(body.error || "Account verification could not be completed."); return; }
      setId(null);
      setComplete(true);
      setMessage("Your existing student account was verified. Admissions will still review your application before granting any new course access. Keep this tab available if you need to verify again.");
    } catch { setMessage("Couldn’t connect. Please try again in this tab."); }
    finally { setPending(false); }
  }
  return <div className={styles.notice}>
    <strong>Already have an ALS student account?</strong>
    <p>Sign in to your existing account in a new tab, then return here to verify that it belongs to you. Admissions must still review and approve your application.</p>
    {!complete && <><Link href="/login" target="_blank" rel="noopener noreferrer" className={styles.secondary}>Open student sign-in</Link>{" "}
    <button type="button" onClick={() => void verify()} disabled={pending} className={styles.secondary}>{pending ? "Verifying…" : "Verify existing account"}</button></>}
    {message && <p role="status">{message}</p>}
  </div>;
}

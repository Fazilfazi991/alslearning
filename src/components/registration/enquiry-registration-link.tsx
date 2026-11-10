"use client";

import { useState } from "react";
import { enquiryRequest, EnquiryAction } from "@/components/admin/enquiries-shared";

export function EnquiryRegistrationLink({ enquiryId }: { enquiryId: string }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function generate() {
    if (busy) return;
    setBusy(true); setError(""); setCopied(false); setLink("");
    try {
      const result = await enquiryRequest(`/api/admin/enquiries/${enquiryId}/registration-link`, "POST", {});
      if (typeof result.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(result.token)) throw new Error("A link could not be created.");
      setLink(`${window.location.origin}/register#link=${result.token}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "A link could not be created."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-line bg-white p-5 sm:p-6" aria-labelledby="registration-link-title">
    <h2 id="registration-link-title" className="text-lg font-bold">Student self-registration</h2>
    <p className="mt-2 text-sm leading-6 text-muted">Create a private, single-use link for this prospect. It expires after seven days and includes their enquiry details when opened.</p>
    <div className="mt-4"><EnquiryAction disabled={busy} onClick={() => void generate()}>{busy ? "Creating…" : "Create registration link"}</EnquiryAction></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {link && <div className="mt-4 space-y-3"><label className="block text-sm font-semibold">Registration link<input className="control" readOnly value={link} onFocus={event => event.currentTarget.select()} /></label><EnquiryAction onClick={() => { void navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => setError("Copy the link from the field above.")); }}>{copied ? "Copied" : "Copy link"}</EnquiryAction><p className="text-xs leading-5 text-muted">Share this link privately with the prospect. Anyone with it can view the prefilled details.</p></div>}
  </section>;
}

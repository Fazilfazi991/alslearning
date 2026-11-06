"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import styles from "./home.module.css";

type Program = { id: string; name: string };

export function EnquiryForm({ programs, unavailable = false }: { programs: Program[]; unavailable?: boolean }) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const feedback = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const phone = String(fields.get("phone") || "").replace(/[\s()-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setErrors({ phone: "Include your country code, for example +91 98765 43210." });
      form.querySelector<HTMLInputElement>("#enquiry-phone")?.focus();
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    setErrors({});
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(fields.get("fullName") || "").trim(), phone,
          email: String(fields.get("email") || "").trim(),
          programId: fields.get("programId"), message: String(fields.get("message") || "").trim(),
          consent: fields.get("consent") === "on", website: fields.get("website"),
          idempotencyKey: requestId.current,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setErrors(data.errors || {});
        throw new Error(data.error || "We couldn’t send your enquiry. Please try again.");
      }
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please check your connection and try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }

  if (success) return <div id="enquire" className={styles.success} role="status" ref={feedback} tabIndex={-1}>
    <CheckCircle2 size={42} aria-hidden="true" />
    <h2>Thank you for your interest.</h2>
    <p>Your enquiry is with the ALS admissions team. We’ll contact you using the details you shared to discuss your program and next steps.</p>
    <a href="#courses" className={styles.textLink}>Explore the programs <ArrowRight size={16} /></a>
  </div>;

  return <section className={styles.enquiry} id="enquire" aria-labelledby="enquiry-title">
    <h2 id="enquiry-title">Let’s find your next step.</h2>
    <p className={styles.formIntro}>Tell us what you’d like to study. Our admissions team will help you get started.</p>
    <form onSubmit={submit} aria-busy={pending}>
      <div className={styles.formGrid}>
        <label className={styles.fullField} htmlFor="enquiry-name">Full name <span aria-hidden="true">*</span><input id="enquiry-name" name="fullName" autoComplete="name" required minLength={2} maxLength={120} placeholder="Your full name" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "name-error" : undefined} />{errors.fullName && <small id="name-error" className={styles.fieldError}>{errors.fullName}</small>}</label>
        <label className={styles.fullField} htmlFor="enquiry-phone">Phone / WhatsApp <span aria-hidden="true">*</span><input id="enquiry-phone" name="phone" type="tel" autoComplete="tel" required maxLength={25} placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-hint phone-error" : "phone-hint"} /><small id="phone-hint">Include your country code.</small>{errors.phone && <small id="phone-error" className={styles.fieldError}>{errors.phone}</small>}</label>
        <label className={styles.fullField} htmlFor="enquiry-email">Email <span className={styles.optional}>(optional)</span><input id="enquiry-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{errors.email && <small id="email-error" className={styles.fieldError}>{errors.email}</small>}</label>
        <label className={styles.fullField} htmlFor="enquiry-program">Interested course <span aria-hidden="true">*</span><select id="enquiry-program" name="programId" required defaultValue="" disabled={unavailable || programs.length === 0} aria-invalid={Boolean(errors.programId)} aria-describedby={errors.programId ? "program-error" : undefined}><option value="" disabled>Select a program</option>{programs.map(program => <option value={program.id} key={program.id}>{program.name}</option>)}</select>{errors.programId && <small id="program-error" className={styles.fieldError}>{errors.programId}</small>}</label>
        <label className={styles.fullField} htmlFor="enquiry-message">Anything we can help with? <span className={styles.optional}>(optional)</span><textarea id="enquiry-message" name="message" rows={2} maxLength={2000} placeholder="Your goals or questions" /></label>
      </div>
      <div className={styles.honeypot} aria-hidden="true"><label htmlFor="enquiry-website">Website<input id="enquiry-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className={styles.consent}><input name="consent" type="checkbox" required /><span>I agree to ALS contacting me about my enquiry by phone, WhatsApp or email.</span></label>
      {(unavailable || programs.length === 0) && <p className={styles.formNotice}>Program enquiries are temporarily unavailable. Please check back shortly.</p>}
      {error && <div className={styles.formError} role="alert" tabIndex={-1} ref={feedback}>{error}</div>}
      <button type="submit" className={styles.submit} disabled={pending || unavailable || programs.length === 0}>{pending ? "Sending your enquiry…" : "Enquire Now"}{!pending && <ArrowRight size={18} aria-hidden="true" />}</button>
      <p className={styles.privacy}><LockKeyhole size={13} aria-hidden="true" />Your details are shared with ALS admissions staff.</p>
    </form>
  </section>;
}

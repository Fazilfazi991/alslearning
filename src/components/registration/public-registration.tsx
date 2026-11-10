"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { validateRegistration } from "@/lib/registration-validation";
import type { EnquiryProgram } from "@/types/enquiries";
import styles from "./public-registration.module.css";

type Answers = { fullName: string; email: string; phone: string; qualification: string; institution: string; programId: string; preferredBatch: string; guardian: string; address: string; additional: string; consent: boolean };
const labels = ["Personal", "Education", "Program", "Review"];
const names = ["Your details", "Your education", "Choose your program", "Review your application"];
const stepFields = [["fullName", "email", "phone"], ["qualification", "institution"], ["programId", "notes"], ["consent"]];

export function PublicRegistration({ programs, unavailable, initialProgram }: { programs: EnquiryProgram[]; unavailable: boolean; initialProgram: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ fullName: "", email: "", phone: "", qualification: "", institution: "", programId: initialProgram, preferredBatch: "", guardian: "", address: "", additional: "", consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [website, setWebsite] = useState("");
  const update = (key: keyof Answers, value: string | boolean) => { setAnswers(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: "" })); };
  const notes = [answers.preferredBatch && `Preferred batch: ${answers.preferredBatch.trim()}`, answers.guardian && `Guardian details: ${answers.guardian.trim()}`, answers.address && `Address: ${answers.address.trim()}`, answers.additional.trim()].filter(Boolean).join("\n");
  const payload = () => ({ fullName: answers.fullName, email: answers.email, phone: answers.phone, qualification: answers.qualification, institution: answers.institution, programId: answers.programId, preferredBatchId: null, notes, consent: answers.consent, requestId: requestId.current || "00000000-0000-4000-8000-000000000000", website });
  const move = (next: number) => { setStep(next); setFormError(""); window.requestAnimationFrame(() => heading.current?.focus()); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const result = validateRegistration(payload());
    const relevant = Object.fromEntries(Object.entries(result.errors).filter(([key]) => stepFields[step].includes(key)));
    if (Object.keys(relevant).length) { setErrors(relevant); setFormError("Please check the highlighted fields."); return; }
    if (step < 3) { setErrors({}); move(step + 1); return; }
    if (!result.value) { setErrors(result.errors); const first = stepFields.findIndex(group => group.some(field => result.errors[field])); if (first >= 0) move(first); setFormError("Please check your application."); return; }
    requestId.current ||= crypto.randomUUID();
    inFlight.current = true; setPending(true); setFormError("");
    try {
      const response = await fetch("/api/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await response.json();
      if (!response.ok || data.success !== true) {
        setErrors(data.errors || {}); setFormError(data.error || "Your application could not be saved. Please try again.");
        const first = stepFields.findIndex(group => group.some(field => data.errors?.[field]));
        if (first >= 0) { setStep(first); window.requestAnimationFrame(() => heading.current?.focus()); }
      } else { setSuccess(true); window.requestAnimationFrame(() => heading.current?.focus()); }
    } catch { setFormError("We couldn’t connect. Your answers are still here; please try again."); }
    finally { inFlight.current = false; setPending(false); }
  };
  const field = (key: keyof Answers, label: string, props: { type?: string; autoComplete?: string; placeholder?: string; maxLength?: number } = {}) => <label className={styles.field} htmlFor={`registration-${key}`}><span>{label}</span><input id={`registration-${key}`} value={String(answers[key])} onChange={event => update(key, event.target.value)} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} {...props} />{errors[key] && <small id={`error-${key}`}>{errors[key]}</small>}</label>;
  if (success) return <section className={styles.panel} aria-live="polite"><CheckCircle2 className={styles.successIcon} aria-hidden="true" size={38} /><h2 ref={heading} tabIndex={-1}>Your application has been received.</h2><p>Thank you for your interest in ALS. Our admissions team will review your details and contact you about the next steps.</p><Link href="/" className={styles.secondary}>Return to the homepage <ArrowRight size={17} aria-hidden="true" /></Link></section>;
  const program = programs.find(item => item.id === answers.programId)?.name || "Not selected";
  return <section className={styles.panel} aria-labelledby="registration-heading">
    <div className={styles.progressTop}><span>Student registration</span><span>Step {step + 1} of 4</span></div>
    <ol className={styles.progress} aria-label="Registration progress">{labels.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={index <= step ? styles.active : undefined}><span>{index + 1}</span><small>{label}</small></li>)}</ol>
    <h2 id="registration-heading" ref={heading} tabIndex={-1}>{names[step]}</h2>
    <p className={styles.description}>{["We’ll use these details to contact you about your application.", "Tell us about your most recent or relevant studies.", "Choose the ALS program that interests you.", "Check your information before sending it to admissions."][step]}</p>
    <form onSubmit={submit} noValidate>
      {step === 0 && <div className={styles.fields}>{field("fullName", "Full name", { autoComplete: "name", maxLength: 120 })}{field("email", "Email address", { type: "email", autoComplete: "email", maxLength: 254 })}{field("phone", "Phone / WhatsApp", { type: "tel", autoComplete: "tel", placeholder: "+91 98765 43210", maxLength: 30 })}<p className={styles.hint}>Include your country code so our team can reach you.</p></div>}
      {step === 1 && <div className={styles.fields}>{field("qualification", "Qualification", { placeholder: "For example, BSc MLT", maxLength: 160 })}{field("institution", "Institution", { autoComplete: "organization", maxLength: 200 })}{field("guardian", "Guardian details (optional)", { maxLength: 250 })}{field("address", "Address (optional)", { autoComplete: "street-address", maxLength: 400 })}</div>}
      {step === 2 && <div className={styles.fields}><label className={styles.field} htmlFor="registration-programId"><span>Program</span><select id="registration-programId" value={answers.programId} onChange={event => update("programId", event.target.value)} aria-invalid={!!errors.programId} aria-describedby={errors.programId ? "error-programId" : undefined}><option value="">Choose a program</option>{programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.programId && <small id="error-programId">{errors.programId}</small>}</label>{unavailable ? <p className={styles.warning}>Programs are temporarily unavailable. Please refresh this page later.</p> : !programs.length && <p className={styles.warning}>There are no programs available for registration right now.</p>}{field("preferredBatch", "Preferred batch (optional)", { placeholder: "Tell us your preferred schedule", maxLength: 200 })}<label className={styles.field} htmlFor="registration-additional"><span>Anything else? (optional)</span><textarea id="registration-additional" rows={4} maxLength={1000} value={answers.additional} onChange={event => update("additional", event.target.value)} /></label>{errors.notes && <small className={styles.error}>{errors.notes}</small>}</div>}
      {step === 3 && <><dl className={styles.review}>{[["Name", answers.fullName], ["Email", answers.email], ["Phone / WhatsApp", answers.phone], ["Qualification", answers.qualification], ["Institution", answers.institution], ["Program", program], ...(answers.preferredBatch ? [["Preferred batch", answers.preferredBatch]] : []), ...(answers.guardian ? [["Guardian", answers.guardian]] : []), ...(answers.address ? [["Address", answers.address]] : []), ...(answers.additional ? [["Additional information", answers.additional]] : [])].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.hint}>Use Back to make changes before submitting.</p><label className={styles.consent}><input type="checkbox" checked={answers.consent} onChange={event => update("consent", event.target.checked)} aria-invalid={!!errors.consent} /> <span>I consent to ALS processing my application and contacting me about admission.</span></label>{errors.consent && <small className={styles.error}>{errors.consent}</small>}</>}
      <label className={styles.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label>
      {formError && <p className={styles.formError} role="alert">{formError}</p>}
      <div className={styles.actions}>{step > 0 && <button type="button" onClick={() => move(step - 1)} disabled={pending} className={styles.secondary}><ArrowLeft size={17} aria-hidden="true" /> Back</button>}<button type="submit" className={styles.primary} disabled={pending || (step === 2 && (unavailable || !programs.length))}>{pending ? "Submitting…" : step === 3 ? "Submit application" : "Continue"} {!pending && <ArrowRight size={17} aria-hidden="true" />}</button></div>
    </form>
  </section>;
}

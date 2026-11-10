"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Compass, LockKeyhole, MessageCircle, UserRound } from "lucide-react";
import { validateEnquiry } from "@/lib/enquiries-validation";
import styles from "./home.module.css";

type Program = { id: string; name: string };
const steps = [
  { label: "You", icon: UserRound },
  { label: "Program", icon: BookOpen },
  { label: "Goals", icon: Compass },
  { label: "Contact", icon: MessageCircle },
];
const subscribeToHydration = () => () => {};
const isHydrated = () => true;
const isServer = () => false;
const headings = ["Let’s get to know you.", "What would you like to study?", "Tell us what matters to you.", "How can we reach you?"];

export function EnquiryForm({ programs, unavailable = false, initialProgram = "" }: { programs: Program[]; unavailable?: boolean; initialProgram?: string }) {
  const hydrated = useSyncExternalStore(subscribeToHydration, isHydrated, isServer);
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [programId, setProgramId] = useState(() => programs.some(program => program.id === initialProgram) ? initialProgram : "");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(false);
  const requestId = useRef<string | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (hasNavigated.current) stepHeading.current?.focus({ preventScroll: true });
  }, [step]);

  function goTo(next: number) {
    hasNavigated.current = true;
    setError("");
    setErrors({});
    setStep(next);
  }

  function advance() {
    if (step === 0 && (fullName.trim().length < 2 || fullName.trim().length > 120)) {
      setErrors({ fullName: "Enter your full name (2–120 characters)." });
      document.getElementById("enquiry-name")?.focus({ preventScroll: true });
      return;
    }
    if (step === 1 && !programs.some(program => program.id === programId)) {
      setErrors({ programId: "Choose an available program to continue." });
      document.getElementById("program-options")?.focus({ preventScroll: true });
      return;
    }
    goTo(step + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) { advance(); return; }
    if (inFlight.current) return;
    const fields = new FormData(event.currentTarget);
    requestId.current ||= crypto.randomUUID();
    const payload = { fullName, phone, email, programId, message, consent, website: fields.get("website"), idempotencyKey: requestId.current };
    const validation = validateEnquiry(payload);
    if (Object.keys(validation.errors).length) {
      const nextErrors = validation.errors;
      setErrors(nextErrors);
      if (nextErrors.fullName) { hasNavigated.current = true; setStep(0); }
      else if (nextErrors.programId) { hasNavigated.current = true; setStep(1); }
      else if (nextErrors.message) { hasNavigated.current = true; setStep(2); }
      else { setError("Please check the highlighted details."); requestAnimationFrame(() => feedback.current?.focus()); }
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    setErrors({});
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, phone: validation.value.phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        const serverErrors: Record<string, string> = data.errors || {};
        setErrors(serverErrors);
        if (serverErrors.fullName) { hasNavigated.current = true; setStep(0); }
        else if (serverErrors.programId) { hasNavigated.current = true; setStep(1); }
        else if (serverErrors.message) { hasNavigated.current = true; setStep(2); }
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
    <a href="#courses" className={styles.textLink}>Explore the programs <ArrowRight size={16} aria-hidden="true" /></a>
  </div>;

  return <section className={`${styles.enquiry} ${styles.wizard}`} id="enquire" aria-labelledby="enquiry-title">
    <div className={styles.wizardTop}><span>ADMISSIONS ENQUIRY</span><span aria-live="polite">Step {step + 1} of 4</span></div>
    <ol className={styles.wizardProgress} aria-label="Enquiry progress">{steps.map((item, index) => {
      const Icon = item.icon;
      return <li key={item.label} aria-current={index === step ? "step" : undefined} className={index === step ? styles.progressCurrent : index < step ? styles.progressComplete : undefined}><span className={styles.progressIcon}>{index < step ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span><span>{item.label}</span><span className="sr-only">{index < step ? " completed" : index === step ? " current step" : " upcoming"}</span></li>;
    })}</ol>
    <form method="post" action="/api/enquiries" onSubmit={submit} aria-busy={pending} noValidate>
      <div className={styles.wizardPanel} key={step}>
        <h2 id="enquiry-title" ref={stepHeading} tabIndex={-1}>{headings[step]}</h2>
        {step === 0 && <><p className={styles.formIntro}>A little introduction is a great place to start.</p><div className={styles.formGrid}><label className={styles.fullField} htmlFor="enquiry-name">Full name <span aria-hidden="true">*</span><input id="enquiry-name" name="fullName" autoComplete="name" required minLength={2} maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Your full name" aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "name-error" : undefined} />{errors.fullName && <small id="name-error" className={styles.fieldError}>{errors.fullName}</small>}</label></div></>}
        {step === 1 && <><p className={styles.formIntro}>Choose the program you’re interested in. You can discuss the details with admissions.</p><fieldset className={styles.programOptions} id="program-options" tabIndex={-1} aria-describedby={errors.programId ? "program-error" : undefined}><legend className="sr-only">Interested program (required)</legend>{programs.map(program => <label key={program.id} className={styles.programOption}><input type="radio" name="programId" value={program.id} checked={programId === program.id} onChange={() => setProgramId(program.id)} /><span>{program.name}</span><Check size={17} aria-hidden="true" /></label>)}</fieldset>{errors.programId && <p id="program-error" className={styles.fieldError}>{errors.programId}</p>}{(unavailable || programs.length === 0) && <p className={styles.formNotice}>Program enquiries are temporarily unavailable. Please check back shortly.</p>}</>}
        {step === 2 && <><p className={styles.formIntro}>Share your goals or ask a question, or skip this for now.</p><div className={styles.formGrid}><label className={styles.fullField} htmlFor="enquiry-message">Your goals or questions <span className={styles.optional}>(optional)</span><textarea id="enquiry-message" name="message" rows={4} maxLength={2000} value={message} onChange={event => setMessage(event.target.value)} placeholder="What would you like to know about studying with ALS?" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "message-error" : undefined} />{errors.message && <small id="message-error" className={styles.fieldError}>{errors.message}</small>}</label></div></>}
        {step === 3 && <><p className={styles.formIntro}>Our admissions team will use these details to follow up on your enquiry.</p><div className={styles.formGrid}><label className={styles.fullField} htmlFor="enquiry-phone">Phone / WhatsApp <span aria-hidden="true">*</span><input id="enquiry-phone" name="phone" type="tel" autoComplete="tel" required maxLength={25} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "phone-hint phone-error" : "phone-hint"} /><small id="phone-hint">Include your country code.</small>{errors.phone && <small id="phone-error" className={styles.fieldError}>{errors.phone}</small>}</label><label className={styles.fullField} htmlFor="enquiry-email">Email <span className={styles.optional}>(optional)</span><input id="enquiry-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />{errors.email && <small id="email-error" className={styles.fieldError}>{errors.email}</small>}</label></div><label className={styles.consent}><input name="consent" type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "consent-error" : undefined} /><span>I agree to ALS contacting me about my enquiry by phone, WhatsApp or email.</span></label>{errors.consent && <p id="consent-error" className={styles.formError}>{errors.consent}</p>}</>}
      </div>
      <div className={styles.honeypot} aria-hidden="true"><label htmlFor="enquiry-website">Website<input id="enquiry-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {error && <div className={styles.formError} role="alert" tabIndex={-1} ref={feedback}>{error}</div>}
      <div className={styles.wizardActions}>{step > 0 && <button type="button" className={styles.wizardBack} onClick={() => goTo(step - 1)} disabled={pending}><ArrowLeft size={17} aria-hidden="true" /> Back</button>}<button type="submit" className={styles.submit} disabled={!hydrated || pending || (step === 1 && (unavailable || programs.length === 0))}>{pending ? "Sending your enquiry…" : step === 3 ? "Submit enquiry" : step === 2 && !message.trim() ? "Skip for now" : "Next"}{!pending && <ArrowRight size={18} aria-hidden="true" />}</button></div>
      <p className={styles.privacy}><LockKeyhole size={13} aria-hidden="true" />Your details are shared with ALS admissions staff.</p>
    </form>
  </section>;
}

"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginForm({ initialError = "" }: { initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [error, setError] = useState(initialError);

  async function signIn() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Could not sign in. Please try again.");
        return;
      }
      // The next account receives a new document instead of the previous role's router tree.
      window.location.replace(body.redirect);
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="mt-8 space-y-5" method="post" action="/api/auth/password" aria-busy={busy} onSubmit={event => { event.preventDefault(); void signIn(); }}>
    <div>
      <label htmlFor="login-email" className="block text-sm font-bold">Email address</label>
      <div className="relative mt-2">
        <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 text-muted" size={18}/>
        <input id="login-email" name="email" required disabled={!ready || busy} type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-line pl-11 pr-4 text-base"/>
      </div>
    </div>
    <div>
      <label htmlFor="login-password" className="block text-sm font-bold">Password</label>
      <div className="relative mt-2">
        <KeyRound aria-hidden="true" className="pointer-events-none absolute left-4 top-3.5 text-muted" size={18}/>
        <input id="login-password" name="password" required disabled={!ready || busy} type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-line pl-11 pr-14 text-base"/>
        <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="login-password" onClick={() => setShowPassword(value => !value)} className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-xl text-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-brand">
          {showPassword ? <EyeOff aria-hidden="true" size={20}/> : <Eye aria-hidden="true" size={20}/>}
        </button>
      </div>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <Button disabled={busy || !ready} type="submit" className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
    <p className="text-center text-sm text-muted">New to ALS? <Link href="/#courses" className="font-bold text-brand">Contact admissions</Link></p>
  </form>;
}

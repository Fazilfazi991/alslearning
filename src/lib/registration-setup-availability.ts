/** Test-only opt-in for the disposable, loopback-bound local acceptance stack.
 * The development server must itself bind to 127.0.0.1; configuration values
 * alone cannot prove its listener is private. Never use this on a host.
 */
export function localRegistrationAcceptanceEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === "development"
    && env.ALS_LOCAL_REGISTRATION_QA === "1"
    && env.VERCEL === undefined
    && env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:19424"
    && env.REGISTRATION_SITE_URL === "http://127.0.0.1:19422";
}

export const registrationPasswordSetupAvailable = localRegistrationAcceptanceEnabled(process.env);

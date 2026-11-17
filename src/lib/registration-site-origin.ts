import { localRegistrationAcceptanceEnabled } from "@/lib/registration-setup-availability";

/** A trusted configuration value, never a request Host or forwarded header. */
export function registrationSiteOrigin(): URL | null {
  try {
    const url = new URL(process.env.REGISTRATION_SITE_URL ?? "");
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    if (url.protocol === "https:") return url;
    if (url.origin === "http://127.0.0.1:19422" && localRegistrationAcceptanceEnabled(process.env)) return url;
    return null;
  } catch { return null; }
}

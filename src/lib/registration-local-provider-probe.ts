import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { localRegistrationAcceptanceEnabled } from "@/lib/registration-setup-availability";
import { supabaseConfig } from "@/lib/supabase/config";

/** Strictly disposable local test instrumentation, never a hosted guarantee. */
export async function localRegistrationProviderProbe() {
  if (!localRegistrationAcceptanceEnabled(process.env) || process.env.ALS_LOCAL_PROVIDER_REJECTION_QA !== "1" || process.env.ALS_LOCAL_GOTRUE_VERSION !== "2.197.0" || process.env.ALS_LOCAL_PROXY_SINGLE_DISPATCH !== "1") throw new Error("Local provider probe unavailable");
  const store = await cookies(), { url, key } = supabaseConfig();
  let writes = 0, status = 0, code: unknown = null, redirected = true, unexpectedWrite = false;
  const db = createServerClient(url, key, {
    global: { fetch: async (input, init) => {
      const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const passwordWrite = address === "http://127.0.0.1:19424/auth/v1/user" && method === "PUT";
      if (method === "PUT" && !passwordWrite) { unexpectedWrite = true; throw new Error("Unexpected local provider write"); }
      if (!passwordWrite) return fetch(input, init);
      writes++;
      const response = await fetch(input, { ...init, redirect: "error" });
      status = response.status; redirected = response.redirected;
      if (status === 422 && !redirected) {
        try { const body: unknown = await response.clone().json(); code = body && typeof body === "object" ? (body as Record<string, unknown>).code : null; } catch { code = null; }
      }
      return response;
    } },
    cookies: { getAll: () => store.getAll(), setAll(values) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* Same SSR behavior as the standard server client. */ } } },
  });
  return { db, confirmedWeakRejection: () => writes === 1 && status === 422 && code === "weak_password" && !redirected && !unexpectedWrite };
}

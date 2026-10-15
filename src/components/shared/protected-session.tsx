"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Server layouts can be restored from Next's navigation cache. Revalidate the
// identity before displaying any protected child, including the account shell.
export function ProtectedSession({ children, userId, role }: {
  children: React.ReactNode;
  userId: string;
  role: "admin" | "teacher" | "student";
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    document.documentElement.style.visibility = "";
    const hide = () => { document.documentElement.style.visibility = "hidden"; };
    const reload = () => { hide(); window.location.reload(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) reload(); };
    const { data } = createClient().auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") { hide(); window.location.replace("/login"); }
    });
    void fetch("/api/auth/session", { cache: "no-store" }).then(async response => {
      if (cancelled) return;
      if (response.status === 401 || response.status === 403) {
        window.location.replace("/login"); return;
      }
      if (!response.ok) throw new Error("Session verification unavailable");
      const identity = await response.json();
      if (cancelled) return;
      if (identity.id !== userId || identity.role !== role) { reload(); return; }
      setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    // Back/Forward must reach the server instead of reusing protected RSCs.
    window.addEventListener("popstate", reload);
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", reload);
      document.documentElement.style.visibility = "";
    };
  }, [userId, role]);
  if (!ready) return <main className="mx-auto max-w-lg p-6" role="status">
    <p>{failed ? "Your session could not be verified." : "Checking your session…"}</p>
    {failed && <button className="mt-4 min-h-11 rounded-lg border border-line px-4 font-semibold" onClick={() => window.location.reload()}>Retry</button>}
  </main>;
  return children;
}

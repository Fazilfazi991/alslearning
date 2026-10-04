"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Postgres changes remain filtered by the authenticated caller's class RLS.
export function SessionListRefresh() {
  const router = useRouter();
  useEffect(() => {
    const db = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (!timer) timer = setTimeout(() => { timer = undefined; router.refresh(); }, 300);
    };
    const channel = db.channel("eligible-live-class-list").on("postgres_changes", {
      event: "*", schema: "public", table: "live_sessions",
    }, refresh).subscribe(status => { if (status === "SUBSCRIBED") refresh(); });
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh);
      void db.removeChannel(channel);
    };
  }, [router]);
  return null;
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionStatus = "draft" | "scheduled" | "live" | "completed" | "cancelled";
export const terminalSessionStatus = (status: string) => status === "completed" || status === "cancelled";
const validStatus = (status: unknown): status is SessionStatus =>
  typeof status === "string" && ["draft", "scheduled", "live", "completed", "cancelled"].includes(status);

// Read-only: Postgres events and refetches both remain subject to the existing RLS.
export function observeSessionStatus(db: SupabaseClient, classId: string, initialStatus: string,
  changed: (status: SessionStatus) => void) {
  let status = initialStatus;
  let disposed = false;
  let version = "";
  let pending: Promise<void> | null = null;
  let lastRefetch = -Infinity;
  const accept = (row: Record<string, unknown> | null) => {
    if (disposed || row?.id !== classId || !validStatus(row.status) || terminalSessionStatus(status)) return;
    const updated = typeof row.updated_at === "string" ? row.updated_at : "";
    if (version && updated && updated < version) return;
    version = updated || version;
    if (row.status === status) return;
    status = row.status;
    changed(row.status);
  };
  const refresh = (): Promise<void> => {
    if (disposed || terminalSessionStatus(status)) return Promise.resolve();
    if (pending) return pending;
    // Coalesce focus/online/subscription/error bursts; no periodic polling.
    pending = (async () => {
      const delay = 1_000 - (Date.now() - lastRefetch);
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      if (disposed || terminalSessionStatus(status)) return;
      lastRefetch = Date.now();
      const { data, error } = await db.from("live_sessions").select("id,status,updated_at").eq("id", classId).maybeSingle();
      if (!error) accept(data);
    })().catch(() => undefined).finally(() => { pending = null; });
    return pending;
  };
  const channel = db.channel(`class-status:${classId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${classId}` },
      payload => accept(payload.new))
    .subscribe(state => { if (state === "SUBSCRIBED") void refresh(); });
  return { refresh, dispose: () => { disposed = true; void db.removeChannel(channel); } };
}

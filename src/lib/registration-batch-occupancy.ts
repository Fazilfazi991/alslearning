import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Use the same current occupancy calculation as the newer batch guard.
 * Older installations without that RPC use the older row-count guard. All
 * other database errors and incomplete RPC responses fail closed. */
export async function registrationBatchOccupancy(db: SupabaseClient, batchIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(batchIds)];
  if (!ids.length) return new Map();
  const result = await db.rpc("lms_batch_occupancy");
  if (result.error) {
    // PGRST202 can mean a missing function or a stale PostgREST schema cache.
    // Raw counts are conservative if the newer function is temporarily absent
    // from the cache; any other error must not silently become a count.
    if (result.error.code !== "PGRST202") throw new Error("Batch occupancy could not be loaded");
    const counts = await Promise.all(ids.map(async id => {
      const count = await db.from("enrollments").select("id", { count: "exact", head: true }).eq("batch_id", id).eq("status", "active");
      if (count.error || !Number.isSafeInteger(count.count) || (count.count as number) < 0) throw new Error("Batch occupancy could not be loaded");
      return [id, count.count as number] as const;
    }));
    return new Map(counts);
  }
  if (!Array.isArray(result.data)) throw new Error("Batch occupancy response is incomplete");
  const requested = new Set(ids), counts = new Map<string, number>();
  for (const row of result.data as Array<{ batch_id?: unknown; occupied?: unknown }>) {
    if (typeof row.batch_id !== "string" || !requested.has(row.batch_id)) continue;
    const count = typeof row.occupied === "string" && /^\d+$/.test(row.occupied) ? Number(row.occupied) : row.occupied;
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0 || counts.has(row.batch_id)) throw new Error("Invalid batch occupancy response");
    counts.set(row.batch_id, count);
  }
  if (ids.some(id => !counts.has(id))) throw new Error("Batch occupancy response is incomplete");
  return counts;
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Use the database's registration seat reservation calculation. Missing
 * functions, database errors and incomplete RPC responses all fail closed. */
export async function registrationBatchOccupancy(db: SupabaseClient, batchIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(batchIds)];
  if (!ids.length) return new Map();
  const result = await db.rpc("registration_batch_occupancy");
  if (result.error) throw new Error("Batch seat reservations could not be loaded");
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

import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { registrationBatchOccupancy } from "./registration-batch-occupancy";

function database(result: unknown) {
  return { rpc: vi.fn().mockResolvedValue(result), from: vi.fn() };
}
const asClient = (value: unknown) => value as SupabaseClient;

it("uses database seat reservations rather than raw enrollment rows", async () => {
  const db = database({ data: [{ batch_id: "a", occupied: 2 }, { batch_id: "b", occupied: "3" }], error: null });
  const counts = await registrationBatchOccupancy(asClient(db), ["a", "b"]);
  expect([...counts.entries()]).toEqual([["a", 2], ["b", 3]]);
  expect(db.rpc).toHaveBeenCalledWith("registration_batch_occupancy");
  expect(db.from).not.toHaveBeenCalled();
});
it("fails closed when the reservation RPC is missing", async () => {
  const db = database({ data: null, error: { code: "PGRST202" } });
  await expect(registrationBatchOccupancy(asClient(db), ["a", "a"])).rejects.toThrow();
  expect(db.from).not.toHaveBeenCalled();
});
it("fails closed for permission errors or incomplete and malformed RPC results", async () => {
  for (const result of [
    { data: null, error: { code: "42501" } },
    { data: [], error: null },
    { data: [{ batch_id: "a", occupied: -1 }], error: null },
    { data: [{ batch_id: "a", occupied: 1 }, { batch_id: "a", occupied: 2 }], error: null },
  ]) {
    const db = database(result);
    await expect(registrationBatchOccupancy(asClient(db), ["a"])).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  }
});
it("does not query occupancy for an empty batch list", async () => {
  const db = database({ data: null, error: { code: "42501" } });
  expect((await registrationBatchOccupancy(asClient(db), [])).size).toBe(0);
  expect(db.rpc).not.toHaveBeenCalled();
});

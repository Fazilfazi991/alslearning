import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { registrationBatchOccupancy } from "./registration-batch-occupancy";

function database(result: unknown, count = 7) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => resolve({ error: null, count }) };
  return { rpc: vi.fn().mockResolvedValue(result), from: vi.fn().mockReturnValue(query) };
}
const asClient = (value: unknown) => value as SupabaseClient;

it("uses current distinct occupancy from the staging RPC rather than raw enrollment rows", async () => {
  const db = database({ data: [{ batch_id: "a", occupied: 2 }, { batch_id: "b", occupied: "3" }], error: null }, 7);
  const counts = await registrationBatchOccupancy(asClient(db), ["a", "b"]);
  expect([...counts.entries()]).toEqual([["a", 2], ["b", 3]]);
  expect(db.rpc).toHaveBeenCalledWith("lms_batch_occupancy");
  expect(db.from).not.toHaveBeenCalled();
});
it("uses the older guard's active enrollment-row count only for a missing RPC", async () => {
  const db = database({ data: null, error: { code: "PGRST202" } }, 7);
  expect((await registrationBatchOccupancy(asClient(db), ["a", "a"])).get("a")).toBe(7);
  expect(db.from).toHaveBeenCalledTimes(1);
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

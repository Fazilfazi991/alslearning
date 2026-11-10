import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ occupancyError: false }));
class Query {
  constructor(private table: string) {}
  select() { return this; } eq() { return this; } order() { return this; } limit() { return this; }
  maybeSingle() { return Promise.resolve({ data: { id: "application", program_id: "program", email: "test@example.test" }, error: null }); }
  then(resolve: (value: unknown) => void) {
    const rows = this.table === "batches" ? [{ id: "batch", program_id: "program" }] : [];
    resolve({ data: rows, error: null });
  }
}
vi.mock("@/lib/admin-session", () => ({ adminSession: async () => ({ db: {
  from: (table: string) => new Query(table),
  rpc: async () => state.occupancyError ? { data: null, error: { code: "42501" } } : { data: [{ batch_id: "batch", occupied: 2 }], error: null },
} }) }));
import { GET } from "./route";

it("returns current database occupancy for application details", async () => {
  state.occupancyError = false;
  const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ id: "e9661772-95ad-49d8-90c7-f4030bf0dccf" }) });
  expect(response.status).toBe(200);
  expect((await response.json()).batches[0].reserved_seats).toBe(2);
});
it("does not display misleading readiness when occupancy is unavailable", async () => {
  state.occupancyError = true;
  const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ id: "e9661772-95ad-49d8-90c7-f4030bf0dccf" }) });
  expect(response.status).toBe(503);
});

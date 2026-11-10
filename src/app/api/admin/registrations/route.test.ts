import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ authorized: false, rows: [] as Record<string, unknown>[], profileConflict: "", full: false, fail: "", occupancy: "missing" }));
vi.mock("@/lib/admin-session", () => ({ adminSession: async () => state.authorized ? { db: { from: (table: string) => new Query(table), rpc: async () => state.occupancy === "current" ? { data: [{ batch_id: "batch", occupied: 1 }], error: null } : { error: { code: state.occupancy === "error" ? "42501" : "PGRST202" } } } } : { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) } }));
class Query {
  private filters: Record<string, unknown> = {};
  private start = 0;
  private end = 99;
  constructor(private table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.filters[key] = value; return this; }
  in(key: string, value: unknown) { this.filters[key] = value; return this; }
  ilike(key: string, value: unknown) { this.filters[key] = value; return this; }
  or(value: string) { this.filters.search = value; return this; }
  order() { return this; }
  range(start: number, end: number) { this.start = start; this.end = end; return this; }
  limit() { return this; }
  then(resolve: (value: unknown) => unknown) {
    if (state.fail === this.table) return Promise.resolve(resolve({ error: { message: "unavailable" } }));
    if (this.table === "student_registrations") {
      const needle = typeof this.filters.search === "string" ? this.filters.search.match(/full_name\.ilike\.%(.+?)%/)?.[1] : undefined;
      const rows = state.rows.filter(row => (!needle || String(row.full_name).toLowerCase().includes(needle.toLowerCase())) && (!this.filters.status || row.status === this.filters.status) && (!Array.isArray(this.filters.invitation_status) || this.filters.invitation_status.includes(row.invitation_status)));
      return Promise.resolve(resolve({ data: rows.slice(this.start, this.end + 1), count: rows.length, error: null }));
    }
    if (this.table === "batches") return Promise.resolve(resolve({ data: [{ id: "batch", program_id: "program", status: "active", batch_code: "ALS", max_students: 30, registration_default: true }], error: null }));
    if (this.table === "enrollments") return Promise.resolve(resolve({ count: state.full ? 30 : 4, error: null }));
    if (this.table === "profiles") return Promise.resolve(resolve({ data: this.filters.email === state.profileConflict ? [{ id: "existing" }] : [], error: null }));
    return Promise.resolve(resolve({ error: { message: "unexpected table" } }));
  }
}
import { GET } from "./route";

beforeEach(() => {
  state.authorized = true; state.full = false; state.fail = ""; state.profileConflict = ""; state.occupancy = "missing";
  state.rows = Array.from({ length: 25 }, (_, index) => ({ id: String(index), full_name: `Applicant ${index}`, email: `person${index}@example.test`, phone: "+919876543210", qualification: "Degree", institution: "College", program_id: "program", status: "pending", consent_at: "2026-01-01", student_id: null, created_at: "2026-01-01", programs: { id: "program", name: "ALS", status: "active" } }));
});
const get = (query: string) => GET(new Request(`https://example.test/api/admin/registrations?${query}`));

it("blocks unauthorized access before loading applications", async () => {
  state.authorized = false;
  expect((await get("status=ready_for_approval")).status).toBe(403);
});
it("filters before paginating and excludes known profile conflicts", async () => {
  state.profileConflict = "person3@example.test";
  const result = await get("status=ready_for_approval&page=2");
  const body = await result.json();
  expect(result.status).toBe(200);
  expect(body.count).toBe(24);
  expect(body.registrations).toHaveLength(4);
  expect(body.registrations[0].id).toBe("21");
  expect(body.readiness_is_advisory).toBe(true);
});
it("applies search before readiness and returns no results for a full batch", async () => {
  let body = await (await get("status=ready_for_approval&q=Applicant%201")).json();
  expect(body.count).toBe(11);
  state.full = true;
  body = await (await get("status=ready_for_approval&q=Applicant%201")).json();
  expect(body.count).toBe(0);
});
it("counts across candidate scan pages before selecting the requested result page", async () => {
  const sample = state.rows[0];
  state.rows = Array.from({ length: 125 }, (_, index) => ({ ...sample, id: String(index), email: `person${index}@example.test` }));
  const body = await (await get("status=ready_for_approval&page=6")).json();
  expect(body.count).toBe(125);
  expect(body.registrations).toHaveLength(20);
  expect(body.registrations[0].id).toBe("100");
});
it("fails closed when capacity or identity checks cannot be loaded", async () => {
  state.fail = "enrollments";
  expect((await get("status=ready_for_approval")).status).toBe(503);
  state.fail = "profiles";
  expect((await get("status=ready_for_approval")).status).toBe(503);
});
it("uses current occupancy on staging and fails closed on RPC errors", async () => {
  state.full = true; state.occupancy = "current";
  expect((await (await get("status=ready_for_approval")).json()).count).toBe(25);
  state.occupancy = "error";
  expect((await get("status=ready_for_approval")).status).toBe(503);
});
it("finds approved applications whose setup link needs follow-up", async () => {
  const sample = state.rows[0];
  state.rows = [
    { ...sample, id: "not-sent", status: "approved", invitation_status: "not_sent" },
    { ...sample, id: "failed", status: "approved", invitation_status: "failed" },
    { ...sample, id: "sent", status: "approved", invitation_status: "sent" },
    { ...sample, id: "existing", status: "approved", invitation_status: "not_required" },
    { ...sample, id: "pending", status: "pending", invitation_status: "not_sent" },
  ];
  const response = await get("status=setup_pending");
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.registrations.map((row: { id: string }) => row.id)).toEqual(["not-sent", "failed"]);
  expect(body.count).toBe(2);
});

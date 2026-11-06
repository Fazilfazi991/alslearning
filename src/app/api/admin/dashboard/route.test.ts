import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), resolve: vi.fn(), from: vi.fn() }));
type Query = { table: string; columns: string; head: boolean; filters: [string, unknown][] };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mock.getUser }, from: mock.from }) }));
import { GET } from "./route";

describe("authorized database dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.getUser.mockResolvedValue({ data: { user: { id: "active-admin" } }, error: null });
    mock.profile.mockResolvedValue({ data: { role: "admin", is_active: true }, error: null });
    mock.resolve.mockImplementation((query: Query) => ({ data: query.head ? null : [], count: query.head ? 2 : null, error: null }));
    mock.from.mockImplementation((table: string) => {
      const query: Query = { table, columns: "", head: false, filters: [] };
      const chain = {
        select: (columns: string, options?: { head?: boolean }) => { query.columns = columns; query.head = options?.head ?? false; return chain; },
        eq: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
        is: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
        not: (key: string, operator: string, value: unknown) => { query.filters.push([key, `${operator}:${value}`]); return chain; },
        gte: (key: string, value: unknown) => { query.filters.push([key, value]); return chain; },
        order: () => chain, limit: () => chain, single: mock.profile,
        then: (resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve().then(() => mock.resolve(query)).then(resolve, reject),
      };
      return chain;
    });
  });
  it("rejects signed-out requests before querying dashboard records", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET()).status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each([{ role: "student", is_active: true }, { role: "teacher", is_active: true }, { role: "admin", is_active: false }])("rejects unauthorized profile %j", async profile => {
    mock.profile.mockResolvedValue({ data: profile, error: null });
    expect((await GET()).status).toBe(403);
    expect(mock.resolve).not.toHaveBeenCalled();
  });
  it("returns real zero counts and private uncacheable results", async () => {
    mock.resolve.mockImplementation((query: Query) => ({ data: query.head ? null : [], count: query.head ? 0 : null, error: null }));
    const response = await GET(), value = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(value.academic.students).toBe(0);
    expect(value.admissions.total).toBe(0);
    expect(value.recentAdmissions).toEqual([]);
    expect(value.recentEnquiries).toEqual([]);
  });
  it("keeps learning metrics available when the admissions migration is absent", async () => {
    mock.resolve.mockImplementation((query: Query) => ["admission_enquiries", "enquiry_follow_ups"].includes(query.table)
      ? { data: null, count: null, error: { message: "private schema diagnostic" } }
      : { data: query.head ? null : [], count: query.head ? 7 : null, error: null });
    const response = await GET(), value = await response.json();
    expect(response.status).toBe(200);
    expect(value.academic.students).toBe(7);
    expect(value.admissions).toBeNull();
    expect(value.recentEnquiries).toBeNull();
    expect(value.upcomingClasses).toEqual([]);
    expect(JSON.stringify(value)).not.toContain("private schema diagnostic");
  });
  it("does not turn failed count queries into invented zero metrics", async () => {
    mock.resolve.mockImplementation((query: Query) => query.table === "batches"
      ? { data: null, count: null, error: { message: "permission denied" } }
      : { data: query.head ? null : [], count: query.head ? 3 : null, error: null });
    const value = await (await GET()).json();
    expect(value.academic).toBeNull();
    expect(value.admissions.total).toBe(3);
  });
  it("counts only pending follow-ups on open enquiries", async () => {
    await GET();
    const pending = mock.resolve.mock.calls.map(([query]) => query as Query).find(query => query.table === "enquiry_follow_ups");
    expect(pending?.columns).toContain("admission_enquiries!inner");
    expect(pending?.filters).toContainEqual(["completed_at", null]);
    expect(pending?.filters).toContainEqual(["admission_enquiries.status", "in:(converted,closed)"]);
  });
  it("isolates a class-list failure without losing admission figures", async () => {
    mock.resolve.mockImplementation((query: Query) => {
      if (query.table === "live_sessions") throw Error("private transport diagnostic");
      return { data: query.head ? null : [], count: query.head ? 4 : null, error: null };
    });
    const value = await (await GET()).json();
    expect(value.upcomingClasses).toBeNull();
    expect(value.academic.students).toBe(4);
    expect(value.admissions.total).toBe(4);
    expect(JSON.stringify(value)).not.toContain("private transport diagnostic");
  });
  it("hides session backend diagnostics", async () => {
    mock.getUser.mockRejectedValue(Error("secret session credential"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret session credential");
  });
});

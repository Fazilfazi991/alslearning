import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ failures: 0, reads: 0, writes: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const builder = {
        select: () => builder,
        in: () => builder,
        eq: () => builder,
        is: () => builder,
        update: fixture.writes,
        limit: async () => {
          if (table === "live_media_connections") {
            fixture.reads++;
            if (fixture.reads <= fixture.failures) {
              return { data: null, error: { code: "PGRST303", message: "JWT issued at future" } };
            }
          }
          return { data: [], error: null };
        },
      };
      return builder;
    },
  }),
}));
vi.mock("./transport-reconciliation", () => ({ reconcileClassTransport: vi.fn() }));
import { POST } from "@/app/api/internal/live-cleanup/route";

const token = "synthetic-test-token-with-no-provider-access";
const request = (authorized = true) => new Request("https://staging.example.test/api/internal/live-cleanup", {
  method: "POST", headers: authorized ? { Authorization: `Bearer ${token}` } : {},
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("ALS_STAGING_MODE", "true");
  vi.stubEnv("SUPABASE_PROJECT_REF", "slghshcdaijbcjfoqerq");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://slghshcdaijbcjfoqerq.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-test-key");
  vi.stubEnv("ALS_STAGING_CLEANUP_TOKEN", token);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fixture.failures = 0; fixture.reads = 0; fixture.writes.mockClear();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("guarded staging cleanup failure state", () => {
  it("keeps an exhausted initial-read failure observable as HTTP 500 without starting mutations", async () => {
    fixture.failures = 3;
    const pending = POST(request());
    await vi.runAllTimersAsync();
    const response = await pending;
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Cleanup failed" });
    expect(fixture.reads).toBe(3);
    expect(fixture.writes).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenLastCalledWith("Staging cleanup authentication", expect.objectContaining({
      query: "live_media_connections", attempt: 3, outcome: "exhausted", code: "PGRST303",
    }));
  });

  it("can recover from the exact recorded read failure within one guarded invocation", async () => {
    fixture.failures = 1;
    const pending = POST(request());
    await vi.runAllTimersAsync();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expiredClasses: 0, closedOrphanAttendance: 0, inspectedClasses: 0, results: [] });
    expect(fixture.reads).toBe(2);
    expect(console.warn).toHaveBeenLastCalledWith("Staging cleanup authentication", expect.objectContaining({ outcome: "recovered", attempt: 2 }));
  });

  it("does not enter the database or retry loop when the caller lacks the endpoint bearer", async () => {
    expect((await POST(request(false))).status).toBe(404);
    expect(fixture.reads).toBe(0);
    expect(fixture.writes).not.toHaveBeenCalled();
  });
});

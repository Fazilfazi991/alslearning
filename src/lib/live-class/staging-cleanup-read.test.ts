import { describe, expect, it, vi } from "vitest";
import { readStagingCleanup } from "./staging-cleanup-read";

const future = { data: null, error: { code: "PGRST303", message: "JWT issued at future" } };

describe("staging cleanup authentication recovery", () => {
  it("rebuilds a rejected SELECT and records recovery without changing its data", async () => {
    const success = { data: [{ id: "candidate" }], error: null };
    const read = vi.fn().mockResolvedValueOnce(future).mockResolvedValueOnce(success);
    const wait = vi.fn().mockResolvedValue(undefined);
    const report = vi.fn();
    expect(await readStagingCleanup("live_media_connections", read, { wait, report })).toBe(success);
    expect(read).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(500);
    expect(report.mock.calls.map(([event]) => event.outcome)).toEqual(["retrying", "recovered"]);
  });

  it("stops persistent failures after three attempts and keeps the original error observable", async () => {
    const read = vi.fn().mockResolvedValue(future);
    const wait = vi.fn().mockResolvedValue(undefined);
    const report = vi.fn();
    expect(await readStagingCleanup("live_media_connections", read, { wait, report })).toBe(future);
    expect(read).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[500], [1500]]);
    expect(report).toHaveBeenLastCalledWith({ query: "live_media_connections", attempt: 3, outcome: "exhausted" });
  });

  it.each([
    { code: "PGRST303", message: "JWT expired" },
    { code: "42501", message: "permission denied" },
    { code: "PGRST301", message: "JWT issued at future" },
  ])("does not retry other authentication or authorization failures: $message", async error => {
    const result = { data: null, error };
    const read = vi.fn().mockResolvedValue(result);
    const wait = vi.fn();
    expect(await readStagingCleanup("live_media_connections", read, { wait })).toBe(result);
    expect(read).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});

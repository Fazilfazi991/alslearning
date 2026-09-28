import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/live-class/staging-cleanup", () => ({ runStagingCleanup: mocks.run }));

import { POST } from "./route";

const url = "https://als-staging.example.test/api/internal/live-cleanup";
const token = "a-test-only-machine-token-of-sufficient-length";

describe("staging cleanup machine endpoint", () => {
  beforeEach(() => {
    vi.stubEnv("ALS_STAGING_MODE", "true");
    vi.stubEnv("ALS_STAGING_CLEANUP_TOKEN", token);
    mocks.run.mockReset().mockResolvedValue({ inspectedClasses: 0 });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects unauthenticated and incorrect requests without doing cleanup", async () => {
    const absent = await POST(new Request(url, { method: "POST" }));
    const wrong = await POST(new Request(url, { method: "POST", headers: { authorization: `Bearer ${token}x` } }));
    expect(absent.status).toBe(404);
    expect(wrong.status).toBe(404);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("runs only for the correct token in staging mode", async () => {
    const request = new Request(url, { method: "POST", headers: { authorization: `Bearer ${token}` } });
    const allowed = await POST(request);
    expect(allowed.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledOnce();
    vi.stubEnv("ALS_STAGING_MODE", "false");
    const disabled = await POST(request);
    expect(disabled.status).toBe(404);
    expect(mocks.run).toHaveBeenCalledOnce();
  });
});

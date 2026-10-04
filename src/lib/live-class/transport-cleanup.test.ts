import { beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ closeTracks: vi.fn(), inspectSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./provider", () => ({
  cloudflareRealtime: provider,
  CloudflareRealtimeError: class CloudflareRealtimeError extends Error {
    constructor(message: string, readonly status: number, readonly retryable: boolean, readonly code?: string) { super(message); }
  },
}));

import { closeProviderTracks } from "./transport-cleanup";

const track = (id: string, mid: string, session = "provider-session") => ({
  id,
  provider_mid: mid,
  live_media_connections: { provider_session_id: session, publisher_provider_session_id: `${session}-publisher` },
});

describe("closeProviderTracks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("routes publication and subscription cleanup to their separate provider sessions", async () => {
    provider.closeTracks.mockResolvedValue({ tracks: [{ mid: "mid-a" }] });
    await closeProviderTracks([track("a", "mid-a")]);
    expect(provider.closeTracks).toHaveBeenLastCalledWith("provider-session-publisher", ["mid-a"]);
    await closeProviderTracks([track("a", "mid-a")], "subscriber");
    expect(provider.closeTracks).toHaveBeenLastCalledWith("provider-session", ["mid-a"]);
  });

  it("matches partial results by mid instead of assuming response order", async () => {
    provider.closeTracks.mockResolvedValue({ tracks: [
      { mid: "mid-b", errorCode: "TRACK_NOT_FOUND" },
      { mid: "mid-a" },
    ] });
    await expect(closeProviderTracks([track("a", "mid-a"), track("b", "mid-b")])).resolves.toEqual({
      closed: ["a"], expired: [], failed: ["b"],
    });
  });

  it("inspects uncertain close outcomes and accepts only mids proven absent", async () => {
    provider.closeTracks.mockRejectedValue(new Error("timeout"));
    provider.inspectSession.mockResolvedValue({ tracks: [{ mid: "mid-b" }] });
    await expect(closeProviderTracks([track("a", "mid-a"), track("b", "mid-b")])).resolves.toEqual({
      closed: ["a"], expired: [], failed: ["b"],
    });
  });

  it("keeps missing provider-session metadata retryable", async () => {
    await expect(closeProviderTracks([{ id: "a", provider_mid: "mid-a" }])).resolves.toEqual({
      closed: [], expired: [], failed: ["a"],
    });
    expect(provider.closeTracks).not.toHaveBeenCalled();
  });

  it("treats an expired provider session as independently confirmed absent", async () => {
    const { CloudflareRealtimeError } = await import("./provider");
    provider.closeTracks.mockRejectedValue(new CloudflareRealtimeError("expired", 410, false, "session_error"));
    await expect(closeProviderTracks([track("a", "mid-a")])).resolves.toEqual({
      closed: [], expired: ["a"], failed: [],
    });
    expect(provider.inspectSession).not.toHaveBeenCalled();
  });
});

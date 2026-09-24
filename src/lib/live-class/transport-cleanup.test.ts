import { beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ closeTracks: vi.fn(), inspectSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./provider", () => ({ cloudflareRealtime: provider }));

import { closeProviderTracks } from "./transport-cleanup";

const track = (id: string, mid: string, session = "provider-session") => ({
  id,
  provider_mid: mid,
  live_media_connections: { provider_session_id: session },
});

describe("closeProviderTracks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("matches partial results by mid instead of assuming response order", async () => {
    provider.closeTracks.mockResolvedValue({ tracks: [
      { mid: "mid-b", errorCode: "TRACK_NOT_FOUND" },
      { mid: "mid-a" },
    ] });
    await expect(closeProviderTracks([track("a", "mid-a"), track("b", "mid-b")])).resolves.toEqual({
      closed: ["a"], failed: ["b"],
    });
  });

  it("inspects uncertain close outcomes and accepts only mids proven absent", async () => {
    provider.closeTracks.mockRejectedValue(new Error("timeout"));
    provider.inspectSession.mockResolvedValue({ tracks: [{ mid: "mid-b" }] });
    await expect(closeProviderTracks([track("a", "mid-a"), track("b", "mid-b")])).resolves.toEqual({
      closed: ["a"], failed: ["b"],
    });
  });

  it("keeps missing provider-session metadata retryable", async () => {
    await expect(closeProviderTracks([{ id: "a", provider_mid: "mid-a" }])).resolves.toEqual({
      closed: [], failed: ["a"],
    });
    expect(provider.closeTracks).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForPublicationMedia } from "./publication-readiness";

afterEach(() => vi.useRealTimers());
const report = (...rows: object[]) => new Map(rows.map((row, index) => [String(index), row])) as unknown as RTCStatsReport;
const outgoing = (mid: string) => ({ type: "outbound-rtp", mid, bytesSent: 120, packetsSent: 2 });

describe("publication discovery readiness", () => {
  it("waits for connected transport and packets from every new publication, ignoring incoming and old media", async () => {
    vi.useFakeTimers();
    const peer = { connectionState: "connecting" as RTCPeerConnectionState, getStats: vi.fn(async () => report(outgoing("old"), outgoing("0"), { type: "inbound-rtp", mid: "1", bytesSent: 120, packetsSent: 2 })) };
    let ready = false;
    const pending = waitForPublicationMedia(peer, ["0", "1"]).then(() => { ready = true; });
    await vi.advanceTimersByTimeAsync(100);
    expect(ready).toBe(false);
    expect(peer.getStats).not.toHaveBeenCalled();
    peer.connectionState = "connected";
    await vi.advanceTimersByTimeAsync(100);
    expect(ready).toBe(false);
    peer.getStats.mockResolvedValue(report(outgoing("0"), outgoing("1")));
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(ready).toBe(true);
  });

  it("fails a closed publisher before advertising media", async () => {
    await expect(waitForPublicationMedia({ connectionState: "closed", getStats: vi.fn() }, ["0"])).rejects.toThrow("Publishing connection failed");
  });

  it("times out a connected publisher that sends no packets", async () => {
    vi.useFakeTimers();
    const pending = expect(waitForPublicationMedia({ connectionState: "connected", getStats: async () => report({ ...outgoing("0"), packetsSent: 0 }) }, ["0"], 200)).rejects.toThrow("Published media did not start");
    await vi.advanceTimersByTimeAsync(200);
    await pending;
  });
});

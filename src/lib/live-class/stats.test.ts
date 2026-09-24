import { describe, expect, it, vi } from "vitest";
import { PeerStatsSampler } from "./stats";

function peerWithReports(...reports: Map<string, Record<string, unknown>>[]) {
  let index = 0;
  return { getStats: vi.fn(async () => reports[Math.min(index++, reports.length - 1)]) } as unknown as RTCPeerConnection;
}

describe("PeerStatsSampler", () => {
  it("classifies inbound and outbound RTP by receiver and publication mids", async () => {
    const first = new Map([
      ["rx-screen", { id: "rx-screen", type: "inbound-rtp", mid: "4", kind: "video", bytesReceived: 1000, packetsLost: 2 }],
      ["tx-camera", { id: "tx-camera", type: "outbound-rtp", mid: "1", kind: "video", bytesSent: 500 }],
    ]);
    const second = new Map([
      ["rx-screen", { id: "rx-screen", type: "inbound-rtp", mid: "4", kind: "video", bytesReceived: 1900, packetsLost: 5 }],
      ["tx-camera", { id: "tx-camera", type: "outbound-rtp", mid: "1", kind: "video", bytesSent: 700 }],
    ]);
    const sampler = new PeerStatsSampler(peerWithReports(first, second), ({ direction, mid }) =>
      direction === "received" && mid === "4" ? "screen" : direction === "sent" && mid === "1" ? "camera" : null);
    await sampler.sample();
    const sample = await sampler.sample();
    expect(sample.bytes.received.screen).toBe(900);
    expect(sample.bytes.sent.camera).toBe(200);
    expect(sample.packetsLost).toBe(3);
  });

  it("does not double-count cumulative counters and tolerates counter replacement", async () => {
    const reports = [1000, 1400, 1400, 100].map(bytes => new Map([
      ["audio", { id: "audio", type: "inbound-rtp", mid: "0", kind: "audio", bytesReceived: bytes, packetsLost: 0 }],
    ]));
    const sampler = new PeerStatsSampler(peerWithReports(...reports), () => "microphone");
    expect((await sampler.sample()).bytes.received.microphone).toBe(0);
    expect((await sampler.sample()).bytes.received.microphone).toBe(400);
    expect((await sampler.sample()).bytes.received.microphone).toBe(0);
    expect((await sampler.sample()).bytes.received.microphone).toBe(100);
  });

  it("records unresolved layers as unclassified instead of guessing by media kind", async () => {
    const reports = [100, 300].map(bytes => new Map([
      ["unknown", { id: "unknown", type: "outbound-rtp", mid: "99", kind: "video", bytesSent: bytes, rid: "h" }],
    ]));
    const sampler = new PeerStatsSampler(peerWithReports(...reports), () => null);
    await sampler.sample();
    expect((await sampler.sample()).bytes.sent.unclassified).toBe(200);
  });
});

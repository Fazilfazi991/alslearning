"use client";

export type LiveStatsSample = {
  sampledAt: number;
  audioBytes: number;
  videoBytes: number;
  screenBytes: number;
  audioKbps: number;
  videoKbps: number;
  screenKbps: number;
  packetsLost: number;
  jitterMs: number | null;
  rttMs: number | null;
  candidateType: string | null;
  width: number | null;
  height: number | null;
  framesPerSecond: number | null;
};

type Counter = { at: number; bytes: number };

export class PeerStatsSampler {
  private counters = new Map<string, Counter>();

  constructor(private readonly peer: RTCPeerConnection, private readonly screenTrackId: () => string | null) {}

  async sample(): Promise<LiveStatsSample> {
    const report = await this.peer.getStats();
    const now = performance.now();
    let audioBytes = 0, videoBytes = 0, screenBytes = 0;
    let audioKbps = 0, videoKbps = 0, screenKbps = 0;
    let packetsLost = 0, jitterMs: number | null = null, rttMs: number | null = null;
    let candidateType: string | null = null, width: number | null = null, height: number | null = null, framesPerSecond: number | null = null;
    report.forEach(value => {
      if ((value.type === "inbound-rtp" || value.type === "outbound-rtp") && !value.isRemote) {
        const bytes = Number(value.bytesReceived ?? value.bytesSent ?? 0);
        const mediaKind = String(value.kind || value.mediaType || "");
        const isScreen = mediaKind === "video" && value.trackIdentifier === this.screenTrackId();
        const previous = this.counters.get(value.id);
        const kbps = previous && bytes >= previous.bytes && now > previous.at ? (bytes - previous.bytes) * 8 / (now - previous.at) : 0;
        this.counters.set(value.id, { at: now, bytes });
        if (mediaKind === "audio") { audioBytes += bytes; audioKbps += kbps; }
        else if (isScreen) { screenBytes += bytes; screenKbps += kbps; }
        else if (mediaKind === "video") { videoBytes += bytes; videoKbps += kbps; }
        packetsLost += Number(value.packetsLost || 0);
        if (typeof value.jitter === "number") jitterMs = Math.max(jitterMs || 0, value.jitter * 1000);
        if (typeof value.frameWidth === "number") width = Math.max(width || 0, value.frameWidth);
        if (typeof value.frameHeight === "number") height = Math.max(height || 0, value.frameHeight);
        if (typeof value.framesPerSecond === "number") framesPerSecond = Math.max(framesPerSecond || 0, value.framesPerSecond);
      }
      if (value.type === "candidate-pair" && value.state === "succeeded" && (value.nominated || value.selected)) {
        if (typeof value.currentRoundTripTime === "number") rttMs = value.currentRoundTripTime * 1000;
        const local = report.get(value.localCandidateId);
        const remote = report.get(value.remoteCandidateId);
        candidateType = local?.candidateType || remote?.candidateType || null;
      }
    });
    return { sampledAt: Date.now(), audioBytes, videoBytes, screenBytes, audioKbps, videoKbps, screenKbps, packetsLost, jitterMs, rttMs, candidateType, width, height, framesPerSecond };
  }
}

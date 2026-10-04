"use client";

export type LiveMediaKind = "microphone" | "camera" | "screen" | "unclassified";
export type LiveMediaDirection = "sent" | "received";
export type DirectionalMediaValues = Record<LiveMediaKind, number>;

export type LiveStatsSample = {
  sampledAt: number;
  bytes: Record<LiveMediaDirection, DirectionalMediaValues>;
  kbps: Record<LiveMediaDirection, DirectionalMediaValues>;
  packetsLost: number;
  jitterMs: number | null;
  rttMs: number | null;
  candidateType: string | null;
  width: number | null;
  height: number | null;
  framesPerSecond: number | null;
};

type Counter = { at: number; value: number };
type StatIdentity = { direction: LiveMediaDirection; mid: string | null; trackIdentifier: string | null; mediaKind: string };
export type StatsIdentityResolver = (identity: StatIdentity) => Exclude<LiveMediaKind, "unclassified"> | null;

const mediaValues = (): DirectionalMediaValues => ({ microphone: 0, camera: 0, screen: 0, unclassified: 0 });
export const emptyLiveStats = (): LiveStatsSample => ({
  sampledAt: 0,
  bytes: { sent: mediaValues(), received: mediaValues() },
  kbps: { sent: mediaValues(), received: mediaValues() },
  packetsLost: 0,
  jitterMs: null,
  rttMs: null,
  candidateType: null,
  width: null,
  height: null,
  framesPerSecond: null,
});

function delta(current: number, previous: Counter | undefined) {
  if (!previous) return 0;
  return current >= previous.value ? current - previous.value : current;
}

export class PeerStatsSampler {
  private byteCounters = new Map<string, Counter>();
  private lossCounters = new Map<string, Counter>();

  constructor(private readonly peer: RTCPeerConnection, private readonly resolveIdentity: StatsIdentityResolver) {}

  async sample(): Promise<LiveStatsSample> {
    const report = await this.peer.getStats();
    const now = performance.now();
    const sample = emptyLiveStats();
    sample.sampledAt = Date.now();
    report.forEach(value => {
      if ((value.type === "inbound-rtp" || value.type === "outbound-rtp") && !value.isRemote) {
        const direction: LiveMediaDirection = value.type === "inbound-rtp" ? "received" : "sent";
        const currentBytes = Number(direction === "received" ? value.bytesReceived || 0 : value.bytesSent || 0);
        const previous = this.byteCounters.get(value.id);
        const byteDelta = delta(currentBytes, previous);
        const elapsed = previous ? now - previous.at : 0;
        this.byteCounters.set(value.id, { at: now, value: currentBytes });
        const kind = this.resolveIdentity({
          direction,
          mid: typeof value.mid === "string" ? value.mid : null,
          trackIdentifier: typeof value.trackIdentifier === "string" ? value.trackIdentifier : null,
          mediaKind: String(value.kind || value.mediaType || ""),
        }) || "unclassified";
        sample.bytes[direction][kind] += byteDelta;
        if (elapsed > 0) sample.kbps[direction][kind] += byteDelta * 8 / elapsed;

        if (direction === "received") {
          const lost = Math.max(0, Number(value.packetsLost || 0));
          const previousLost = this.lossCounters.get(value.id);
          sample.packetsLost += delta(lost, previousLost);
          this.lossCounters.set(value.id, { at: now, value: lost });
          if (typeof value.jitter === "number") sample.jitterMs = Math.max(sample.jitterMs || 0, value.jitter * 1000);
        }
        if (typeof value.frameWidth === "number") sample.width = Math.max(sample.width || 0, value.frameWidth);
        if (typeof value.frameHeight === "number") sample.height = Math.max(sample.height || 0, value.frameHeight);
        if (typeof value.framesPerSecond === "number") sample.framesPerSecond = Math.max(sample.framesPerSecond || 0, value.framesPerSecond);
      }
      if (value.type === "candidate-pair" && value.state === "succeeded" && (value.nominated || value.selected)) {
        if (typeof value.currentRoundTripTime === "number") sample.rttMs = value.currentRoundTripTime * 1000;
        const local = report.get(value.localCandidateId);
        const remote = report.get(value.remoteCandidateId);
        sample.candidateType = local?.candidateType || remote?.candidateType || null;
      }
    });
    return sample;
  }
}

export class StatsIntervalAccumulator {
  readonly bytes = { sent: mediaValues(), received: mediaValues() };
  packetsLost = 0;
  sampledFrom = new Date().toISOString();

  add(sample: LiveStatsSample) {
    for (const direction of ["sent", "received"] as const) {
      for (const kind of ["microphone", "camera", "screen", "unclassified"] as const) {
        this.bytes[direction][kind] += sample.bytes[direction][kind];
      }
    }
    this.packetsLost += sample.packetsLost;
  }
}

import "server-only";

export type SdpDescription = { type: "offer" | "answer"; sdp: string };
export type PublishedTrackKind = "microphone" | "camera" | "screen";
export type CloudflareTrackResult = {
  mid?: string;
  trackName?: string;
  sessionId?: string;
  errorCode?: string;
  errorDescription?: string;
};
export type CloudflareResponse = {
  sessionId?: string;
  sessionDescription?: SdpDescription;
  tracks?: CloudflareTrackResult[];
  requiresImmediateRenegotiation?: boolean;
  errorCode?: string;
  errorDescription?: string;
};

type RealtimeConfiguration = { appId: string; appSecret: string };

export class CloudflareRealtimeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CloudflareRealtimeError";
  }
}

export function realtimeConfiguration(): RealtimeConfiguration {
  const appId = process.env.CF_REALTIME_APP_ID;
  const appSecret = process.env.CF_REALTIME_APP_SECRET;
  const missing = [
    !appId && "CF_REALTIME_APP_ID",
    !appSecret && "CF_REALTIME_APP_SECRET",
  ].filter(Boolean);
  if (missing.length) throw new Error(`Cloudflare Realtime is not configured (${missing.join(", ")})`);
  return { appId: appId!, appSecret: appSecret! };
}

const retryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function request(
  path: string,
  method: "GET" | "POST" | "PUT",
  payload?: unknown,
): Promise<CloudflareResponse> {
  const { appId, appSecret } = realtimeConfiguration();
  const url = `https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(appId)}/${path}`;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${appSecret}`,
          "Content-Type": "application/json",
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      const body = (await response.json().catch(() => ({}))) as CloudflareResponse;
      if (!response.ok) {
        const retryable = retryableStatus(response.status);
        const error = new CloudflareRealtimeError(
          body.errorDescription || body.errorCode || `Cloudflare Realtime request failed (${response.status})`,
          response.status,
          retryable,
        );
        if (!retryable || attempt === 2) throw error;
        lastError = error;
      } else {
        return body;
      }
    } catch (error) {
      if (error instanceof CloudflareRealtimeError && !error.retryable) throw error;
      lastError = error;
      if (attempt === 2) break;
    }
    await wait(150 * 2 ** attempt);
  }
  if (lastError instanceof Error) throw lastError;
  throw new CloudflareRealtimeError("Cloudflare Realtime request failed", 502, true);
}

function assertTrackResults(response: CloudflareResponse, expected: number) {
  const results = response.tracks || [];
  if (results.length !== expected) throw new CloudflareRealtimeError("Cloudflare returned an incomplete track result", 502, true);
  const failed = results.find(track => track.errorCode);
  if (failed) throw new CloudflareRealtimeError(failed.errorDescription || failed.errorCode!, 502, true);
  return response;
}

export const cloudflareRealtime = {
  async createSession(correlationId: string) {
    const response = await request(`sessions/new?correlationId=${encodeURIComponent(correlationId)}`, "POST");
    if (!response.sessionId) throw new CloudflareRealtimeError("Cloudflare did not return a session ID", 502, true);
    return response.sessionId;
  },

  async publishTracks(
    providerSessionId: string,
    description: SdpDescription,
    tracks: { mid: string; trackName: string }[],
  ) {
    const response = await request(
      `sessions/${encodeURIComponent(providerSessionId)}/tracks/new`,
      "POST",
      {
        sessionDescription: description,
        tracks: tracks.map(track => ({ location: "local", ...track })),
      },
    );
    if (!response.sessionDescription) throw new CloudflareRealtimeError("Cloudflare did not return a publication answer", 502, true);
    return assertTrackResults(response, tracks.length);
  },

  async subscribeTracks(
    providerSessionId: string,
    tracks: { sessionId: string; trackName: string }[],
  ) {
    const response = await request(
      `sessions/${encodeURIComponent(providerSessionId)}/tracks/new`,
      "POST",
      { tracks: tracks.map(track => ({ location: "remote", ...track })) },
    );
    if (!response.sessionDescription) throw new CloudflareRealtimeError("Cloudflare did not return a subscription offer", 502, true);
    return assertTrackResults(response, tracks.length);
  },

  renegotiate(providerSessionId: string, description: SdpDescription) {
    return request(`sessions/${encodeURIComponent(providerSessionId)}/renegotiate`, "PUT", {
      sessionDescription: description,
    });
  },

  closeTracks(providerSessionId: string, mids: string[]) {
    return request(`sessions/${encodeURIComponent(providerSessionId)}/tracks/close`, "PUT", {
      tracks: mids.map(mid => ({ mid })),
      force: true,
    });
  },

  inspectSession(providerSessionId: string) {
    return request(`sessions/${encodeURIComponent(providerSessionId)}`, "GET");
  },
};

export async function getIceServers(): Promise<RTCIceServer[]> {
  const fallback: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478"] }];
  const keyId = process.env.CF_TURN_KEY_ID;
  const apiToken = process.env.CF_TURN_KEY_API_TOKEN;
  if (!keyId || !apiToken) return fallback;
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 14_400 }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new CloudflareRealtimeError("TURN credential generation failed", response.status, retryableStatus(response.status));
  const body = (await response.json()) as { iceServers?: RTCIceServer[] };
  if (!body.iceServers?.length) throw new CloudflareRealtimeError("TURN credential response was incomplete", 502, true);
  return body.iceServers;
}

import "server-only";
import { cloudflareRealtime, CloudflareRealtimeError } from "./provider";

export type ClosableTrack = {
  id: string;
  provider_mid: string;
  live_media_connections?:
    | { provider_session_id: string | null; publisher_provider_session_id?: string | null }
    | { provider_session_id: string | null; publisher_provider_session_id?: string | null }[];
};

function providerSession(track: ClosableTrack, role: "publisher" | "subscriber") {
  const connection = Array.isArray(track.live_media_connections) ? track.live_media_connections[0] : track.live_media_connections;
  return role === "publisher"
    ? connection?.publisher_provider_session_id || connection?.provider_session_id
    : connection?.provider_session_id;
}

export async function closeProviderTracks(tracks: ClosableTrack[], role: "publisher" | "subscriber" = "publisher") {
  const grouped = new Map<string, { mids: string[]; ids: string[] }>();
  for (const track of tracks) {
    const sessionId = providerSession(track, role);
    if (!sessionId) continue;
    const group = grouped.get(sessionId) || { mids: [], ids: [] };
    group.mids.push(track.provider_mid);
    group.ids.push(track.id);
    grouped.set(sessionId, group);
  }
  const closed: string[] = [];
  const expired: string[] = [];
  const failed: string[] = [];
  for (const track of tracks) {
    if (!providerSession(track, role) || !track.provider_mid) failed.push(track.id);
  }
  for (const [sessionId, group] of grouped) {
    try {
      const response = await cloudflareRealtime.closeTracks(sessionId, group.mids);
      if (response.errorCode || !response.tracks) {
        failed.push(...group.ids);
        continue;
      }
      const byMid = new Map(response.tracks.map(result => [result.mid, result]));
      group.mids.forEach((mid, index) => {
        const result = byMid.get(mid) || response.tracks?.[index];
        if (result && !result.errorCode) closed.push(group.ids[index]);
        else failed.push(group.ids[index]);
      });
    } catch (closeError) {
      if (closeError instanceof CloudflareRealtimeError && closeError.status === 410 && closeError.code === "session_error") {
        expired.push(...group.ids);
        continue;
      }
      // A timed-out or duplicate close is an uncertain result. Inspect the
      // provider session: a missing mid proves that cleanup already won.
      try {
        const state = await cloudflareRealtime.inspectSession(sessionId);
        const remaining = new Set((state.tracks || []).filter(track => !track.status || !["closed", "inactive"].includes(track.status)).map(track => track.mid).filter(Boolean));
        group.mids.forEach((mid, index) => {
          if (remaining.has(mid)) failed.push(group.ids[index]);
          else closed.push(group.ids[index]);
        });
      } catch (inspectError) {
        if (inspectError instanceof CloudflareRealtimeError && inspectError.status === 410 && inspectError.code === "session_error") expired.push(...group.ids);
        else failed.push(...group.ids);
      }
    }
  }
  return { closed: [...new Set(closed)], expired: [...new Set(expired)], failed: [...new Set(failed)] };
}

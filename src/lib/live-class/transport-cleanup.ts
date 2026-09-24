import "server-only";
import { cloudflareRealtime } from "./provider";

export type ClosableTrack = {
  id: string;
  provider_mid: string;
  live_media_connections?: { provider_session_id: string } | { provider_session_id: string }[];
};

function providerSession(track: ClosableTrack) {
  const connection = Array.isArray(track.live_media_connections) ? track.live_media_connections[0] : track.live_media_connections;
  return connection?.provider_session_id;
}

export async function closeProviderTracks(tracks: ClosableTrack[]) {
  const grouped = new Map<string, { mids: string[]; ids: string[] }>();
  for (const track of tracks) {
    const sessionId = providerSession(track);
    if (!sessionId) continue;
    const group = grouped.get(sessionId) || { mids: [], ids: [] };
    group.mids.push(track.provider_mid);
    group.ids.push(track.id);
    grouped.set(sessionId, group);
  }
  const closed: string[] = [];
  const failed: string[] = [];
  for (const [sessionId, group] of grouped) {
    try {
      const response = await cloudflareRealtime.closeTracks(sessionId, group.mids);
      response.tracks?.forEach((result, index) => {
        if (!result.errorCode) closed.push(group.ids[index]);
        else failed.push(group.ids[index]);
      });
      if (!response.tracks) closed.push(...group.ids);
    } catch {
      failed.push(...group.ids);
    }
  }
  return { closed: [...new Set(closed)], failed: [...new Set(failed)] };
}

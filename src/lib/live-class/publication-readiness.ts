/** Do not advertise a negotiated track before its publisher sends media. */
export async function waitForPublicationMedia(
  peer: Pick<RTCPeerConnection, "connectionState" | "getStats">,
  mids: string[],
  timeoutMs = 20_000,
) {
  if (!mids.length || mids.some(mid => !mid)) throw new Error("Publication media identifiers are missing");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (["closed", "failed"].includes(peer.connectionState)) throw new Error("Publishing connection failed before media started");
    if (peer.connectionState === "connected") {
      const sending = new Set<string>();
      (await peer.getStats()).forEach(stat => {
        if (stat.type === "outbound-rtp" && !stat.isRemote && stat.mid != null && stat.bytesSent > 0 && stat.packetsSent > 0) {
          sending.add(String(stat.mid));
        }
      });
      if (mids.every(mid => sending.has(mid))) return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Published media did not start. Check your connection and try again.");
}

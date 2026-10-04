type ReceiverPeer = {
  localDescription: RTCSessionDescriptionInit | null;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  createAnswer(): Promise<RTCSessionDescriptionInit>;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
};

export async function acceptReceiveOffer<T extends { id: string; mid?: string }>(
  peer: ReceiverPeer,
  offer: { sessionDescription: RTCSessionDescriptionInit; tracks: T[] },
  identities: Map<string, T>,
  subscribed: Set<string>,
  waitForIce: () => Promise<void>,
  renegotiate: (answer: RTCSessionDescriptionInit | null) => Promise<void>,
) {
  // ontrack can fire during setRemoteDescription, so install identities first.
  offer.tracks.forEach(track => { if (track.mid) identities.set(track.mid, track); });
  try {
    await peer.setRemoteDescription(offer.sessionDescription);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await waitForIce();
    await renegotiate(peer.localDescription);
    offer.tracks.forEach(track => subscribed.add(track.id));
  } catch (error) {
    offer.tracks.forEach(track => {
      if (track.mid && identities.get(track.mid)?.id === track.id) identities.delete(track.mid);
    });
    throw error;
  }
}

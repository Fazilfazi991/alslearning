import { describe, expect, it, vi } from "vitest";
import { acceptReceiveOffer } from "./receive-negotiation";

function receiver() {
  const peer = {
    localDescription: { type: "answer" as const, sdp: "answer" },
    setRemoteDescription: vi.fn(async () => undefined),
    createAnswer: vi.fn(async () => ({ type: "answer" as const, sdp: "answer" })),
    setLocalDescription: vi.fn(async () => undefined),
  };
  const identities = new Map<string, { id: string; mid: string }>();
  const subscribed = new Set<string>();
  const waitForIce = vi.fn(async () => undefined);
  const renegotiate = vi.fn(async () => undefined);
  const offer = {
    sessionDescription: { type: "offer" as const, sdp: "offer" },
    tracks: [{ id: "teacher-mic", mid: "0" }],
  };
  return { peer, identities, subscribed, waitForIce, renegotiate, offer };
}

describe("receive negotiation", () => {
  it("makes the microphone identity available to ontrack and commits only after renegotiation", async () => {
    const value = receiver();
    value.peer.setRemoteDescription.mockImplementation(async () => {
      expect(value.identities.get("0")?.id).toBe("teacher-mic");
      expect(value.subscribed.size).toBe(0);
    });
    value.renegotiate.mockImplementation(async () => {
      expect(value.subscribed.size).toBe(0);
    });
    await acceptReceiveOffer(value.peer, value.offer, value.identities, value.subscribed,
      value.waitForIce, value.renegotiate);
    expect(value.subscribed.has("teacher-mic")).toBe(true);
    expect(value.renegotiate).toHaveBeenCalledWith(value.peer.localDescription);
  });

  it("leaves a failed subscription eligible for retry", async () => {
    const value = receiver();
    value.renegotiate.mockRejectedValue(new Error("signaling failed"));
    await expect(acceptReceiveOffer(value.peer, value.offer, value.identities, value.subscribed,
      value.waitForIce, value.renegotiate)).rejects.toThrow("signaling failed");
    expect(value.subscribed.has("teacher-mic")).toBe(false);
    expect(value.identities.has("0")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { engagedPlaybackDelta } from "./use-engaged-playback";
describe("engaged playback sampling", () => {
  it("counts elapsed viewing rather than media position or playback speed", () => {
    expect(engagedPlaybackDelta(40, 41, 1, true, 1)).toBe(1);
    expect(engagedPlaybackDelta(40, 42, 1, true, 2)).toBe(1);
  });
  it("excludes seeks, inactive/paused/buffering state and stalled playback", () => {
    expect(engagedPlaybackDelta(40, 340, 1, true, 1)).toBe(0);
    expect(engagedPlaybackDelta(40, 41, 1, false, 1)).toBe(0);
    expect(engagedPlaybackDelta(40, 40, 1, true, 1)).toBe(0);
    expect(engagedPlaybackDelta(40, 39, 1, true, 1)).toBe(0);
    expect(engagedPlaybackDelta(40, 100, 60, true, 1)).toBe(0);
  });
});

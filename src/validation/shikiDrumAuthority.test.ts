import { describe, expect, it } from "vitest";
import { drumMeasures, SHIKI_SCORE_DRUMS } from "../demo/shikiDrumAuthority";

describe("Shiki No Uta full-score drum authority", () => {
  it("preserves the sparse A entrance and printed measure-12 fill", () => {
    expect(drumMeasures(4, 4)[0]?.events).toEqual([]);
    expect(drumMeasures(5, 11).every(({ events }) =>
      events.every(({ voice }) => voice === "hat"))).toBe(true);
    expect(drumMeasures(12, 12)[0]?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ step: 9, voice: "snare" }),
      expect.objectContaining({ step: 11, voice: "kick" }),
      expect.objectContaining({ step: 13, voice: "kick" }),
      expect.objectContaining({ step: 15, voice: "kick" }),
    ]));
  });

  it("keeps B, C and D as evolving score measures instead of one repeated beat", () => {
    for (const [start, end] of [[13, 20], [29, 36], [37, 44]]) {
      const signatures = drumMeasures(start, end).map(({ events }) =>
        events.map(({ step, voice }) => `${step}:${voice}`).join("|"));
      expect(new Set(signatures).size).toBeGreaterThanOrEqual(6);
    }
  });

  it("keeps every onset unique and inside the 16-step prototype grid", () => {
    for (const { events } of SHIKI_SCORE_DRUMS) {
      const signatures = events.map(({ step, voice }) => `${step}:${voice}`);
      expect(new Set(signatures).size).toBe(signatures.length);
      expect(events.every(({ step, velocity }) =>
        step >= 0 && step < 16 && velocity > 0 && velocity <= 1)).toBe(true);
    }
  });
});

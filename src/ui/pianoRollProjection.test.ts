import { describe, expect, it } from "vitest";
import { computePianoRollProjection, pitchToDisplayRow } from "./pianoRollProjection";
import type { PatternDraft } from "../types";

function draftWithPitches(pitches: number[]): PatternDraft {
  return {
    id: "test",
    owner: "memory",
    title: "Test",
    kind: "bass",
    status: "editing",
    revision: 1,
    patternBars: 4,
    notes: pitches.map((pitch, i) => ({
      id: `n-${i}`,
      step: i,
      pitch,
      note: `N${pitch}`,
      velocity: 100,
      duration: "4n",
    })),
  };
}

describe("pianoRollProjection", () => {
  it("maps bass register pitches into display rows", () => {
    const projection = computePianoRollProjection(draftWithPitches([39, 43, 47, 53]));
    expect(pitchToDisplayRow(53, projection)).toBe(0);
    expect(pitchToDisplayRow(39, projection)).toBe(3);
    expect(pitchToDisplayRow(43, projection)).toBe(pitchToDisplayRow(43, projection));
  });

  it("keeps identical pitches on the same row", () => {
    const projection = computePianoRollProjection(draftWithPitches([48, 48, 60]));
    expect(pitchToDisplayRow(48, projection)).toBe(pitchToDisplayRow(48, projection));
    expect(pitchToDisplayRow(60, projection)).toBeLessThan(pitchToDisplayRow(48, projection));
  });
});

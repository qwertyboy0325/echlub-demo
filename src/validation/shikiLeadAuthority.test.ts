import { describe, expect, it } from "vitest";
import { leadMeasures, SHIKI_SCORE_LEAD } from "../demo/shikiLeadAuthority";

describe("Shiki No Uta full-score lead authority", () => {
  it("uses tenor for A and alto for the upper lead in B/C/D", () => {
    expect(leadMeasures(4, 12).every(({ sourceStaff }) => sourceStaff === "tenor-sax")).toBe(true);
    expect(leadMeasures(13, 20).every(({ sourceStaff }) => sourceStaff === "alto-sax")).toBe(true);
    expect(leadMeasures(29, 44).every(({ sourceStaff }) => sourceStaff === "alto-sax")).toBe(true);
  });

  it("keeps every onset inside a 16-step bar and every measure monophonic", () => {
    for (const scoreMeasure of SHIKI_SCORE_LEAD) {
      const steps = scoreMeasure.events.map(({ step }) => step);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
      expect(new Set(steps).size).toBe(steps.length);
      expect(steps.every((step) => step >= 0 && step < 16)).toBe(true);
    }
  });

  it("retains the score's recognizable A pickup and opening phrase in concert pitch", () => {
    expect(leadMeasures(4, 5)).toEqual([
      expect.objectContaining({ measure: 4, events: [
        expect.objectContaining({ step: 13, note: "Eb4" }),
        expect.objectContaining({ step: 14, note: "Eb4" }),
        expect.objectContaining({ step: 15, note: "F4" }),
      ] }),
      expect.objectContaining({ measure: 5, events: [
        expect.objectContaining({ step: 0, note: "Eb4" }),
        expect.objectContaining({ step: 2, note: "F4" }),
        expect.objectContaining({ step: 4, note: "Bb3" }),
        expect.objectContaining({ step: 6, note: "Db4" }),
        expect.objectContaining({ step: 8, note: "Eb4" }),
        expect.objectContaining({ step: 10, note: "F4" }),
        expect.objectContaining({ step: 12, note: "Ab4" }),
        expect.objectContaining({ step: 15, note: "F4" }),
      ] }),
    ]);
  });

  it("applies the written key signature when converting the alto staff to concert pitch", () => {
    const notes = leadMeasures(13, 44).flatMap(({ events }) => events.map(({ note }) => note));
    expect(notes).not.toContain("B3");
    expect(notes).not.toContain("B4");
    expect(leadMeasures(14, 14)[0]?.events[2]?.note).toBe("Bb3");
    expect(leadMeasures(30, 30)[0]?.events[5]?.note).toBe("Bb4");
  });
});

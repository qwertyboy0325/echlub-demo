import { describe, expect, it } from "vitest";
import { faderUiToDb, filterUiToHz, delayUiToWet, knobRotationForFilter, knobRotationForDelay } from "../mixMapping";

describe("gesture audio mapping", () => {
  it("shares normalized fader mapping for UI and audio", () => {
    const ui = 72;
    expect(faderUiToDb(ui)).toBeCloseTo(-9.6, 1);
  });

  it("shares filter mapping between knob rotation and audio Hz", () => {
    const ui = 1800;
    expect(filterUiToHz(ui)).toBeGreaterThan(1000);
    expect(knobRotationForFilter(ui)).toBeGreaterThan(-135);
  });

  it("shares delay mapping between knob rotation and wet gain", () => {
    const ui = 0.35;
    expect(delayUiToWet(ui)).toBeCloseTo(0.35, 2);
    expect(knobRotationForDelay(ui)).toBeGreaterThan(-135);
  });
});

import { describe, expect, it } from "vitest";
import {
  faderUiToDb,
  faderUiToGain,
  filterUiToHz,
  delayUiToWet,
  mixEquals,
  applyFaderToMix,
  MIX_CONTROL_MAPPINGS,
} from "../mixMapping";
import { defaultMix } from "../musicData";

describe("mix mapping", () => {
  it("maps fader UI to dB and gain", () => {
    expect(faderUiToDb(64)).toBeCloseTo(-11.2);
    expect(faderUiToGain(64)).toBeCloseTo(Math.pow(10, -11.2 / 20), 4);
  });

  it("maps filter and delay UI values", () => {
    expect(filterUiToHz(780)).toBe(780);
    expect(filterUiToHz(40)).toBe(80);
    expect(delayUiToWet(0.3)).toBe(0.3);
    expect(delayUiToWet(1.5)).toBe(1);
  });

  it("documents all visible controls", () => {
    expect(MIX_CONTROL_MAPPINGS.length).toBe(6);
    expect(MIX_CONTROL_MAPPINGS.map((m) => m.controlId)).toEqual([
      "fader-groove", "fader-harmony", "fader-melody", "fader-texture", "filter-knob", "delay-knob",
    ]);
  });

  it("applies fader to mix immutably", () => {
    const next = applyFaderToMix(defaultMix, "melody", 72);
    expect(next.faders.melody).toBe(72);
    expect(defaultMix.faders.melody).not.toBe(72);
    expect(mixEquals(next, { ...defaultMix, faders: { ...defaultMix.faders, melody: 72 } })).toBe(true);
  });
});

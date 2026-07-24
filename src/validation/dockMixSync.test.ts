import { describe, expect, it } from "vitest";
import { dockUpdatesFromMix, dockValueFromMixParam, mixPatchFromDockParam } from "../shell/audio/dockMixSync";
import { createInitialShellState } from "../shell/domain/shellFixtures";

describe("dockMixSync", () => {
  it("round-trips filter cutoff through mix patch", () => {
    const param = "Filter · Cutoff";
    const value = 0.72;
    const patch = mixPatchFromDockParam(param, value)!;
    expect(patch.filter).toBeCloseTo(200 + value * 7800, 1);
    const roundTrip = dockValueFromMixParam(param, { filter: patch.filter!, delayWet: 0, reverbWet: 0, masterGain: 0, faders: { groove: 0, harmony: 0, melody: 0, texture: 0 } });
    expect(roundTrip).toBeCloseTo(value, 3);
  });

  it("writes engine mix back to mapped dock slots", () => {
    const state = createInitialShellState();
    state.dockSlots[0] = {
      ...state.dockSlots[0]!,
      mapped: true,
      sourceParam: "Filter · Cutoff",
      value: 0.5,
    };
    const mix = { filter: 200 + 0.72 * 7800, delayWet: 0.1, reverbWet: 0.2, masterGain: -3, faders: { groove: 64, harmony: 48, melody: 28, texture: 58 } };
    const updates = dockUpdatesFromMix(state, mix);
    expect(updates).toEqual([{ index: 0, value: 0.72 }]);
  });
});

import { describe, expect, it } from "vitest";
import { dockUpdatesFromMix, dockValueFromMixParam, mixPatchFromDockParam } from "../shell/audio/dockMixSync";
import { createInitialShellState } from "../shell/domain/shellFixtures";

const baseMix = {
  filter: 200 + 0.72 * 7800,
  delayWet: 0.1,
  reverbWet: 0.2,
  masterGain: -3,
  faders: { groove: 64, harmony: 48, melody: 28, texture: 58 },
};

describe("dockMixSync", () => {
  it("round-trips filter cutoff through mix patch", () => {
    const param = "Filter · Cutoff";
    const value = 0.72;
    const patch = mixPatchFromDockParam(param, value)!;
    expect(patch.filter).toBeCloseTo(200 + value * 7800, 1);
    const roundTrip = dockValueFromMixParam(param, {
      filter: patch.filter!,
      delayWet: 0,
      reverbWet: 0,
      masterGain: 0,
      faders: { groove: 0, harmony: 0, melody: 0, texture: 0 },
    });
    expect(roundTrip).toBeCloseTo(value, 3);
  });

  it("writes engine mix back to mapped dock slots (mix → dock)", () => {
    const state = createInitialShellState();
    state.dockSlots[0] = {
      ...state.dockSlots[0]!,
      mapped: true,
      sourceParam: "Filter · Cutoff",
      value: 0.5,
    };
    const updates = dockUpdatesFromMix(state, baseMix);
    expect(updates).toEqual([{ index: 0, value: 0.72 }]);
  });

  it("maps device filter param to engine mix (device → engine)", () => {
    const normalized = 0.55;
    const patch = { filter: 200 + normalized * 7800 };
    expect(patch.filter).toBeCloseTo(4490, 0);
    const dockValue = dockValueFromMixParam("Filter · Cutoff", {
      ...baseMix,
      filter: patch.filter,
    });
    expect(dockValue).toBeCloseTo(normalized, 3);
  });

  it("maps dock delay wet back from engine mix (engine → dock)", () => {
    const state = createInitialShellState();
    state.dockSlots[1] = {
      ...state.dockSlots[1]!,
      mapped: true,
      sourceParam: "Delay · Wet",
      value: 0.1,
    };
    const mix = { ...baseMix, delayWet: 0.4 * 0.65 };
    const updates = dockUpdatesFromMix(state, mix);
    expect(updates).toEqual([{ index: 1, value: 0.4 }]);
  });

  it("maps dock value to engine patch (dock → engine)", () => {
    const patch = mixPatchFromDockParam("Reverb · Send", 0.35)!;
    expect(patch.reverbWet).toBeCloseTo(0.35 * 0.85, 4);
    const roundTrip = dockValueFromMixParam("Reverb · Send", { ...baseMix, reverbWet: patch.reverbWet! });
    expect(roundTrip).toBeCloseTo(0.35, 3);
  });

  it("maps Horns · Delay desk send through mix patch", () => {
    const patch = mixPatchFromDockParam("Horns · Delay", 0.5)!;
    expect(patch.desk?.horns?.delaySend).toBeCloseTo(0.5 * 0.65, 4);
    const roundTrip = dockValueFromMixParam("Horns · Delay", {
      ...baseMix,
      desk: { horns: { delaySend: patch.desk!.horns!.delaySend! } },
    });
    expect(roundTrip).toBeCloseTo(0.5, 3);
  });

  it("maps Rhythm · Filter desk filter through mix patch", () => {
    const value = 0.4;
    const patch = mixPatchFromDockParam("Rhythm · Filter", value)!;
    expect(patch.desk?.rhythm?.filterHz).toBeCloseTo(200 + value * 7800, 1);
  });

  it("keeps canonical mix as single source — dock never duplicates engine state", () => {
    const state = createInitialShellState();
    state.dockSlots[0] = {
      ...state.dockSlots[0]!,
      mapped: true,
      sourceParam: "Filter · Cutoff",
      value: 0.72,
    };
    const secondPass = dockUpdatesFromMix(state, baseMix);
    expect(secondPass).toEqual([]);
  });
});

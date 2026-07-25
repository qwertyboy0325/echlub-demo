import { describe, expect, it, vi } from "vitest";
import { applyMixParamsToGraph } from "../audio/mixApplication";
import type { MasterAudioGraph } from "../audio/masterAudioGraph";
import type { MixParams } from "../types";

function mockParam(value = 0) {
  return {
    value,
    setRampPoint: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
}

function createMockGraph(): MasterAudioGraph {
  const makeDesk = () => ({
    volume: mockParam(0),
    frequency: mockParam(12_000),
    gain: mockParam(0),
  });
  return {
    masterFilter: { frequency: mockParam(6400) },
    delaySend: { gain: mockParam(0.08) },
    reverbSend: { gain: mockParam(0.12) },
    master: { volume: mockParam(4) },
    grooveGain: { volume: mockParam(-6) },
    harmonyGain: { volume: mockParam(-8) },
    melodyGain: { volume: mockParam(-4) },
    textureGain: { volume: mockParam(-100) },
    drumFilter: { frequency: mockParam(9600) },
    drumReverbSend: { gain: mockParam(0) },
    drumTrim: { volume: mockParam(0) },
    bassTrim: { volume: mockParam(0) },
    rhythmDeskGain: makeDesk(),
    rhythmDeskFilter: makeDesk(),
    rhythmDeskDelaySend: makeDesk(),
    rhythmDeskReverbSend: makeDesk(),
    keysDeskGain: makeDesk(),
    keysDeskFilter: makeDesk(),
    keysDeskDelaySend: makeDesk(),
    keysDeskReverbSend: makeDesk(),
    hornsDeskGain: makeDesk(),
    hornsDeskFilter: makeDesk(),
    hornsDeskDelaySend: makeDesk(),
    hornsDeskReverbSend: makeDesk(),
    guitarDeskGain: makeDesk(),
    guitarDeskFilter: makeDesk(),
    guitarDeskDelaySend: makeDesk(),
    guitarDeskReverbSend: makeDesk(),
  } as unknown as MasterAudioGraph;
}

describe("desk bus mix application", () => {
  it("applies per-desk delay and reverb sends into shared engines", () => {
    const graph = createMockGraph();
    const current: MixParams = {
      filter: 6400,
      delayWet: 0.08,
      reverbWet: 0.12,
      masterGain: 4,
      faders: { groove: 70, harmony: 52, melody: 76, texture: 0 },
      desk: {
        rhythm: { delaySend: 0, reverbSend: 0.05 },
        keys: { delaySend: 0.15, reverbSend: 0.2 },
        horns: { delaySend: 0.45, reverbSend: 0.25 },
        guitar: { delaySend: 0.3, reverbSend: 0.1 },
      },
    };

    const next = applyMixParamsToGraph(graph, current, {
      desk: {
        horns: { delaySend: 0.62, mute: true },
        guitar: { gainDb: -3 },
      },
    });

    expect(next.desk?.horns?.delaySend).toBe(0.62);
    expect(next.desk?.horns?.mute).toBe(true);
    expect(next.desk?.guitar?.gainDb).toBe(-3);
    expect(graph.hornsDeskDelaySend.gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(graph.hornsDeskGain.volume.linearRampToValueAtTime).toHaveBeenCalled();
    expect(graph.guitarDeskGain.volume.linearRampToValueAtTime).toHaveBeenCalled();
  });
});

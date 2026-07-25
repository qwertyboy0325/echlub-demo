import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShellAudioAdapter } from "../shell/audio/shellAudioAdapter";
import { MusicalDomainStore } from "../shell/domain/musicalDomain";
import { createInitialShellState } from "../shell/domain/shellFixtures";

describe("launch velocity scale and lane mute", () => {
  let adapter: ShellAudioAdapter;
  let domain: MusicalDomainStore;

  beforeEach(() => {
    domain = new MusicalDomainStore();
    domain.loadPackJson(readFileSync(join(process.cwd(), "public/shiki-no-uta.demo.pack.json"), "utf8"));
    adapter = new ShellAudioAdapter(domain);
    const engine = {
      setLaunchVelocityScale: vi.fn(),
      setLaneMute: vi.fn(),
      clearLaneMutes: vi.fn(),
      setMixParams: vi.fn(),
      getMix: vi.fn().mockReturnValue({ filter: 6400, delayWet: 0.08, reverbWet: 0.12, masterGain: 4, faders: {} }),
      dispose: vi.fn(),
    };
    (adapter as unknown as { engine: typeof engine }).engine = engine;
  });

  afterEach(() => {
    adapter.dispose();
  });

  it("routes launch velocity scale command to engine", () => {
    const state = createInitialShellState();
    adapter.handleCommand({ type: "SET_LAUNCH_VELOCITY_SCALE", scale: 0.72 }, state, state);
    const engine = (adapter as unknown as { engine: { setLaunchVelocityScale: ReturnType<typeof vi.fn> } }).engine;
    expect(engine.setLaunchVelocityScale).toHaveBeenCalledWith(0.72);
  });

  it("routes lane mute command to engine", () => {
    const state = createInitialShellState();
    adapter.handleCommand({ type: "SET_LANE_MUTE", layer: "melody", muted: true }, state, state);
    const engine = (adapter as unknown as { engine: { setLaneMute: ReturnType<typeof vi.fn> } }).engine;
    expect(engine.setLaneMute).toHaveBeenCalledWith("melody", true);
  });

  it("routes desk bus patch through mix params", () => {
    const state = createInitialShellState();
    adapter.handleCommand({
      type: "SET_DESK_BUS",
      desk: "horns",
      params: { delaySend: 0.5 },
    }, state, state);
    const engine = (adapter as unknown as { engine: { setMixParams: ReturnType<typeof vi.fn> } }).engine;
    expect(engine.setMixParams).toHaveBeenCalledWith({ desk: { horns: { delaySend: 0.5 } } }, 0.18);
  });
});

import { playLayerOnGraph } from "../audio/voicePlayback";

describe("voice playback launch options", () => {
  it("skips muted layers during master playback", () => {
    const kick = { triggerAttackRelease: vi.fn() };
    const graph = { kick } as unknown as import("../audio/masterAudioGraph").MasterAudioGraph;
    const materialBank = {
      version: 1,
      drafts: {
        "midi-entry-drums": {
          draftId: "midi-entry-drums",
          revision: 0,
          contentFingerprint: "x",
          content: {
            kind: "drums",
            patternBars: 4,
            hits: [{ bar: 0, step: 0, voice: "kick", velocity: 0.8 }],
          },
        },
      },
    };
    const scene = {
      id: "entry",
      title: "entry",
      bars: 8,
      startBar: 4,
      description: "",
      layers: {
        drums: { draftId: "midi-entry-drums", revision: 0, fingerprint: "x" },
        bass: null,
        harmony: null,
        melody: null,
        texture: null,
      },
      fx: { filter: 6400, delayWet: 0.08, reverbWet: 0.12, masterGain: 4, faders: {} },
    };

    playLayerOnGraph(
      graph,
      materialBank as never,
      scene,
      "drums",
      scene.layers.drums,
      0,
      0,
      0,
      0,
      { mutedLayers: new Set(["drums"]) },
    );
    expect(kick.triggerAttackRelease).not.toHaveBeenCalled();
  });
});

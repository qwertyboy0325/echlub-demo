import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toneStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("tone", async (importOriginal) => {
  const tone = await importOriginal<typeof import("tone")>();
  return { ...tone, start: toneStart };
});

import { ShellAudioAdapter } from "../shell/audio/shellAudioAdapter";
import { MusicalDomainStore } from "../shell/domain/musicalDomain";
import { createInitialShellState } from "../shell/domain/shellFixtures";
import { shellStore } from "../shell/domain/shellStore";

type AdapterInternals = {
  engine: {
    state: string;
    start: () => void;
    pause: () => void;
    dispose: () => void;
    isCueActive: () => boolean;
    setCurrentAct: (act: string) => void;
    setMaterialBank: (bank: unknown) => void;
    setBaselineMix: (mix: unknown) => void;
  } | null;
  initialized: boolean;
  pendingPreviewDraftId: string | null;
  syncTransportFromStore(): void;
  applyTransportPlaying(playing: boolean): Promise<void>;
};

describe("ShellAudioAdapter", () => {
  let adapter: ShellAudioAdapter;
  let domain: MusicalDomainStore;

  beforeEach(() => {
    toneStart.mockClear();
    domain = new MusicalDomainStore();
    domain.loadPackJson(readFileSync(join(process.cwd(), "public/shiki-no-uta.demo.pack.json"), "utf8"));
    adapter = new ShellAudioAdapter(domain);
    shellStore.dispatch({ type: "RESTART_SESSION" });
  });

  afterEach(() => {
    adapter.dispose();
  });

  it("dedupes concurrent initialize calls", async () => {
    const internal = vi.spyOn(adapter as unknown as { initializeInternal(): Promise<void> }, "initializeInternal").mockResolvedValue(undefined);
    const first = adapter.initialize();
    const second = adapter.initialize();
    expect(first).toBe(second);
    await first;
    expect(internal).toHaveBeenCalledTimes(1);
  });

  it("syncs pending Play when engine becomes ready", () => {
    shellStore.dispatch({ type: "TOGGLE_TRANSPORT" });
    const internals = adapter as unknown as AdapterInternals;
    const toggle = vi.spyOn(internals, "applyTransportPlaying");
    internals.syncTransportFromStore();
    expect(toggle).toHaveBeenCalledWith(true);
  });

  it("unlocks AudioContext synchronously on Play click", () => {
    const before = { ...createInitialShellState(), transportPlaying: false };
    const after = { ...before, transportPlaying: true };
    adapter.handleCommand({ type: "TOGGLE_TRANSPORT" }, before, after);
    expect(toneStart).toHaveBeenCalledTimes(1);
  });

  it("queues preview until engine is ready", () => {
    const before = createInitialShellState();
    adapter.handleCommand({ type: "PREVIEW_WORKSPACE", draftId: "midi-opening-bass" }, before, before);
    expect((adapter as unknown as AdapterInternals).pendingPreviewDraftId).toBe("midi-opening-bass");
    expect(toneStart).toHaveBeenCalledTimes(1);
  });

  it("applies dock value to engine mix params", () => {
    const setMixParams = vi.fn();
    const getMix = vi.fn().mockReturnValue({
      filter: 5816,
      delayWet: 0.1,
      reverbWet: 0.2,
      masterGain: -3,
      faders: { groove: 64, harmony: 48, melody: 28, texture: 58 },
    });
    (adapter as unknown as AdapterInternals).engine = {
      setMixParams,
      getMix,
      dispose: vi.fn(),
    } as unknown as AdapterInternals["engine"];
    const before = createInitialShellState();
    const after = {
      ...before,
      dockSlots: before.dockSlots.map((slot, index) =>
        index === 0
          ? { ...slot, mapped: true, sourceParam: "Filter · Cutoff", value: 0.72 }
          : slot,
      ),
    };
    adapter.handleCommand({ type: "SET_DOCK_VALUE", slotIndex: 0, value: 0.72 }, before, after);
    expect(setMixParams).toHaveBeenCalledWith({ filter: expect.closeTo(5816, 1) }, 0.12);
  });

  it("dispose clears engine without leaving initialized state", () => {
    expect(adapter.isAudioReady()).toBe(false);
    adapter.dispose();
    expect(adapter.getEngine()).toBeNull();
    expect(adapter.isAudioReady()).toBe(false);
  });
});

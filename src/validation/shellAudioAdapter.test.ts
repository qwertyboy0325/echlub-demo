import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  handleTransportToggle(playing: boolean): Promise<void>;
};

describe("ShellAudioAdapter", () => {
  let adapter: ShellAudioAdapter;
  let domain: MusicalDomainStore;

  beforeEach(() => {
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
    const toggle = vi.spyOn(internals, "handleTransportToggle");
    internals.syncTransportFromStore();
    expect(toggle).toHaveBeenCalledWith(true);
  });

  it("queues preview until engine is ready", () => {
    const before = createInitialShellState();
    adapter.handleCommand({ type: "PREVIEW_WORKSPACE", draftId: "midi-opening-bass" }, before, before);
    expect((adapter as unknown as AdapterInternals).pendingPreviewDraftId).toBe("midi-opening-bass");
  });

  it("dispose clears engine without leaving initialized state", () => {
    expect(adapter.isAudioReady()).toBe(false);
    adapter.dispose();
    expect(adapter.getEngine()).toBeNull();
    expect(adapter.isAudioReady()).toBe(false);
  });
});

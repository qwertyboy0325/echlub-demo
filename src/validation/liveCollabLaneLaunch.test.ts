import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileSessionMaterialBank } from "../domain/sessionMaterialBank";
import {
  LIVE_COLLAB_LAUNCH_ORDER,
  LIVE_COLLAB_SLOT_TRACKS,
} from "../domain/liveCollabSessionAdapter";
import { SHIKI_LIVE_COLLAB_PACK_PATH } from "../domain/liveCollabPack";
import type { ProductionSession } from "../domain/sessionTypes";
import { ShellAudioAdapter } from "../shell/audio/shellAudioAdapter";
import { MusicalDomainStore } from "../shell/domain/musicalDomain";
import { ShellStore } from "../shell/domain/shellStore";
import { createInitialShellState } from "../shell/domain/shellFixtures";

const LIVE_COLLAB_JSON = readFileSync(join(process.cwd(), SHIKI_LIVE_COLLAB_PACK_PATH), "utf8");

function sessionArrangementSnapshot(session: ProductionSession) {
  return session.scenes.map((scene) => ({
    id: scene.id,
    layers: Object.fromEntries(
      Object.entries(scene.layers).map(([layer, ref]) => [layer, ref ? ref.draftId : null]),
    ),
    layerStacks: Object.fromEntries(
      Object.entries(scene.layerStacks ?? {}).map(([layer, refs]) => [
        layer,
        (refs ?? []).map((ref) => ref.draftId),
      ]),
    ),
  }));
}

function materialFingerprintMap(session: ProductionSession): Record<string, string> {
  const bank = compileSessionMaterialBank(session);
  const out: Record<string, string> = {};
  for (const [key, material] of bank.materials.entries()) {
    out[key] = material.contentFingerprint;
  }
  return out;
}

describe("live-collab derived pack session", () => {
  it("adapts pack into a 13-scene session with loop-unit drafts", () => {
    const domain = new MusicalDomainStore();
    const livePack = domain.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    const session = domain.getSession()!;

    expect(domain.getPackMode()).toBe("live-collab");
    expect(livePack.loopUnits).toHaveLength(20);
    expect(session.scenes).toHaveLength(13);
    expect(domain.getPack()?.metadata.id).toBe("shiki-no-uta-live-collab-demo-v1");
    expect(domain.workspaceDraft()?.id).toBe("kai-lh-sparse-4");
  });
});

describe("progressive lane launch", () => {
  it("accumulates active lanes and audible inventory", () => {
    const domain = new MusicalDomainStore();
    domain.loadLiveCollabPackJson(LIVE_COLLAB_JSON);

    expect(domain.getActiveLanes().size).toBe(0);
    expect(domain.activateLane("track-piano-lh")).toBe(true);
    expect(domain.getActiveLanes()).toEqual(new Set(["track-piano-lh"]));
    expect(domain.getAuthority()).toBe("shared-master");

    domain.activateLane("track-bass");
    domain.activateLane("track-guitar");
    expect(domain.getActiveLanes().size).toBe(3);
    const audible = domain.getSevenTrackMasterInventory().filter((track) => track.audibleInPayoff);
    expect(audible.map((track) => track.instrument).sort()).toEqual(["bass", "guitar", "piano-lh"]);
  });

  it("maps launch slots to the seven Shiki lanes", () => {
    expect(Object.keys(LIVE_COLLAB_SLOT_TRACKS).sort()).toEqual([
      "lane-1", "lane-2", "lane-3", "lane-4", "lane-5", "lane-6", "lane-7",
    ]);
    expect(LIVE_COLLAB_LAUNCH_ORDER).toEqual([
      "track-piano-lh",
      "track-bass",
      "track-drums",
      "track-piano-rh",
      "track-guitar",
      "track-alto",
      "track-tenor",
    ]);
  });

  it("is order-independent at full payoff", () => {
    const forward = new MusicalDomainStore();
    forward.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    for (const trackId of LIVE_COLLAB_LAUNCH_ORDER) forward.activateLane(trackId);

    const reverse = new MusicalDomainStore();
    reverse.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    for (const trackId of [...LIVE_COLLAB_LAUNCH_ORDER].reverse()) reverse.activateLane(trackId);

    const forwardSession = forward.getSession()!;
    const reverseSession = reverse.getSession()!;
    expect(sessionArrangementSnapshot(forwardSession)).toEqual(sessionArrangementSnapshot(reverseSession));
    expect(materialFingerprintMap(forwardSession)).toEqual(materialFingerprintMap(reverseSession));
  });

  it("matches activateAllLanes payoff equivalence", () => {
    const allAtOnce = new MusicalDomainStore();
    allAtOnce.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    allAtOnce.activateAllLanes();

    const progressive = new MusicalDomainStore();
    progressive.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    for (const trackId of LIVE_COLLAB_LAUNCH_ORDER) progressive.activateLane(trackId);

    const allSession = allAtOnce.getSession()!;
    const progressiveSession = progressive.getSession()!;

    expect(sessionArrangementSnapshot(allSession)).toEqual(sessionArrangementSnapshot(progressiveSession));
    expect(materialFingerprintMap(allSession)).toEqual(materialFingerprintMap(progressiveSession));
    expect(allAtOnce.getSevenTrackMasterInventory().filter((t) => t.audibleInPayoff).length).toBe(7);
    expect(progressive.getSevenTrackMasterInventory().filter((t) => t.audibleInPayoff).length).toBe(7);
  });

  it("clears active lanes on restart", () => {
    const domain = new MusicalDomainStore();
    domain.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    domain.activateLane("track-drums");
    domain.activateLane("track-bass");
    expect(domain.getActiveLanes().size).toBe(2);

    domain.restart();
    expect(domain.getActiveLanes().size).toBe(0);
    expect(domain.getAuthority()).toBe("clip-preview");
    expect(domain.getActiveMasterDraftId()).toBeNull();
  });
});

describe("shell LAUNCH_SLOT adapter", () => {
  let adapter: ShellAudioAdapter;
  let domain: MusicalDomainStore;

  beforeEach(() => {
    domain = new MusicalDomainStore();
    domain.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    adapter = new ShellAudioAdapter(domain);
    const engine = {
      setCurrentAct: vi.fn(),
      setMaterialBank: vi.fn(),
      setBaselineMix: vi.fn(),
      setArrangementSceneBoundaries: vi.fn(),
      clearArrangementSceneBoundaries: vi.fn(),
      activateSceneAtBoundary: vi.fn(),
      dispose: vi.fn(),
    };
    (adapter as unknown as { engine: typeof engine }).engine = engine;
  });

  afterEach(() => {
    adapter.dispose();
  });

  it("commits lane launch immediately when transport is stopped", () => {
    const state = createInitialShellState();
    adapter.handleCommand({ type: "LAUNCH_SLOT", slotId: "lane-1" }, state, state);
    expect(domain.getActiveLanes()).toEqual(new Set(["track-piano-lh"]));
  });

  it("defers lane launch until bar boundary while transport is playing", () => {
    const stopped = createInitialShellState();
    const playing = { ...stopped, transportPlaying: true };
    adapter.handleCommand({ type: "LAUNCH_SLOT", slotId: "lane-3" }, stopped, playing);
    expect(domain.getActiveLanes().size).toBe(0);

    (adapter as unknown as { commitPendingLaneLaunches: () => void }).commitPendingLaneLaunches();
    expect(domain.getActiveLanes()).toEqual(new Set(["track-drums"]));
  });

  it("marks launch slot active in shell reducer", () => {
    const store = new ShellStore({
      ...createInitialShellState(),
      arrangementSlots: [
        { id: "lane-1", clipId: null, state: "empty", label: "Piano LH" },
        { id: "lane-2", clipId: null, state: "empty", label: "Bass" },
      ],
    });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-1" });
    expect(store.getState().arrangementSlots[0]?.state).toBe("active");
  });
});

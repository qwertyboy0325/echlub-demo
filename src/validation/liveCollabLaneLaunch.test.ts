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
    expect(livePack.loopUnits).toHaveLength(19);
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

  it("replaces prior guitar draft on fork relaunch instead of stacking", () => {
    const domain = new MusicalDomainStore();
    domain.loadLiveCollabPackJson(LIVE_COLLAB_JSON);
    for (const trackId of LIVE_COLLAB_LAUNCH_ORDER) domain.activateLane(trackId);
    domain.activateLane("track-guitar", "ren-fork-alt-2");

    const guitarDraftIds = new Set<string>();
    for (const scene of domain.getSession()!.scenes) {
      for (const ref of Object.values(scene.layers)) {
        if (ref?.draftId?.startsWith("ren-")) guitarDraftIds.add(ref.draftId);
      }
      for (const refs of Object.values(scene.layerStacks ?? {})) {
        for (const ref of refs ?? []) {
          if (ref.draftId.startsWith("ren-")) guitarDraftIds.add(ref.draftId);
        }
      }
    }
    expect(guitarDraftIds.has("ren-comp-2")).toBe(false);
    expect(guitarDraftIds.has("ren-fork-alt-2")).toBe(true);

    const leadA = domain.getSession()!.scenes.find((scene) => scene.id === "lead-a")!;
    const guitarRefs = [
      leadA.layers.melody?.draftId,
      ...(leadA.layerStacks?.melody?.map((ref) => ref.draftId) ?? []),
    ].filter((draftId): draftId is string => Boolean(draftId));
    expect(guitarRefs.filter((draftId) => draftId.startsWith("ren-"))).toEqual(["ren-fork-alt-2"]);
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
      refreshPlayingSceneAtBar: vi.fn(),
      releaseGuitarVoices: vi.fn(),
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

    (adapter as unknown as { commitPendingLaneLaunches: (duringTransport?: boolean) => void }).commitPendingLaneLaunches(true);
    expect(domain.getActiveLanes()).toEqual(new Set(["track-drums"]));
  });

  it("commits deferred lane launch on bar boundary before notes play", () => {
    const releaseGuitarVoices = vi.fn();
    const refreshPlayingSceneAtBar = vi.fn();
    (adapter as unknown as { engine: Record<string, unknown> }).engine = {
      setCurrentAct: vi.fn(),
      setMaterialBank: vi.fn(),
      setBaselineMix: vi.fn(),
      setArrangementSceneBoundaries: vi.fn(),
      activateSceneAtBoundary: vi.fn(),
      refreshPlayingSceneAtBar,
      releaseGuitarVoices,
      dispose: vi.fn(),
    };
    const stopped = createInitialShellState();
    const playing = { ...stopped, transportPlaying: true };
    adapter.handleCommand({ type: "LAUNCH_SLOT", slotId: "lane-5", draftId: "ren-fork-alt-2" }, stopped, playing);
    (adapter as unknown as { commitPendingLaneLaunches: (duringTransport?: boolean, boundaryTime?: number) => void })
      .commitPendingLaneLaunches(true, 42.5);
    expect(refreshPlayingSceneAtBar).toHaveBeenCalled();
    expect(releaseGuitarVoices).toHaveBeenCalledWith(42.5);
  });
  it("skips scene FX re-activation when committing lanes during transport", () => {
    const activateSceneAtBoundary = vi.fn();
    (adapter as unknown as { engine: Record<string, unknown> }).engine = {
      setCurrentAct: vi.fn(),
      setMaterialBank: vi.fn(),
      setBaselineMix: vi.fn(),
      setArrangementSceneBoundaries: vi.fn(),
      activateSceneAtBoundary,
      refreshPlayingSceneAtBar: vi.fn(),
      releaseGuitarVoices: vi.fn(),
      dispose: vi.fn(),
    };
    const stopped = createInitialShellState();
    const playing = { ...stopped, transportPlaying: true };
    adapter.handleCommand({ type: "LAUNCH_SLOT", slotId: "lane-5", draftId: "ren-fork-alt-2" }, stopped, playing);
    (adapter as unknown as { commitPendingLaneLaunches: (duringTransport?: boolean) => void }).commitPendingLaneLaunches(true);
    expect(activateSceneAtBoundary).not.toHaveBeenCalled();
  });

  it("marks launch slot queued then playing on commit", () => {
    const store = new ShellStore({
      ...createInitialShellState(),
      arrangementSlots: [
        { id: "lane-1", clipId: null, materialId: "kai-lh-sparse-4", state: "loaded", label: "kai-lh-sparse-4" },
        { id: "lane-2", clipId: null, materialId: null, state: "empty", label: "Bass" },
      ],
    });
    store.dispatch({ type: "LAUNCH_SLOT", slotId: "lane-1" });
    expect(store.getState().arrangementSlots[0]?.state).toBe("queued");
    store.dispatch({ type: "COMMIT_LANE_LAUNCH", slotId: "lane-1" });
    expect(store.getState().arrangementSlots[0]?.state).toBe("playing");
  });
});

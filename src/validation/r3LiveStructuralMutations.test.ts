import { describe, expect, it } from "vitest";
import { DemoRuntime } from "../demo/demoRuntime";
import {
  applyLiveStructuralBoundary,
  queueLiveStructuralOperation,
} from "../demo/liveStructuralMutations";
import { createCompletedProductionSession } from "../demo/productionMutations";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { materialRefForDraft } from "../domain/sessionMaterialBank";

function liveSession() {
  return createCompletedProductionSession(placeholderReconstructionPack);
}

describe("Live structural boundary mutations", () => {
  it("queues without changing music, then holds the active scene at the exact boundary", () => {
    const session = liveSession();
    const before = structuredClone(session.arrangement);
    queueLiveStructuralOperation(session, {
      id: "hold-opening",
      kind: "hold",
      executeAtBar: 8,
      sceneId: "opening",
      bars: 4,
    });

    expect(session.arrangement).toEqual(before);
    expect(applyLiveStructuralBoundary(session, 7).applied).toEqual([]);
    const result = applyLiveStructuralBoundary(session, 8);

    expect(result.applied).toEqual([
      expect.objectContaining({ operationId: "hold-opening", kind: "hold", appliedAtBar: 8 }),
    ]);
    expect(session.arrangement.scenes.find((ref) => ref.sceneId === "groove")!.startBar).toBe(12);
    expect(session.scenes.find((scene) => scene.id === "opening")!.bars).toBe(12);
    expect(session.scenes.find((scene) => scene.id === "groove")!.startBar).toBe(12);
    expect(session.arrangement.totalBars).toBe(before.totalBars + 4);
  });

  it("replaces a layer with the current exact draft revision", () => {
    const session = liveSession();
    const expected = materialRefForDraft(session.drafts["pulse-full"]!);
    queueLiveStructuralOperation(session, {
      id: "replace-groove-drums",
      kind: "replaceLayer",
      executeAtBar: 8,
      sceneId: "groove",
      layer: "drums",
      draftId: "pulse-full",
    });
    applyLiveStructuralBoundary(session, 8);
    expect(session.scenes.find((scene) => scene.id === "groove")!.layers.drums).toEqual(expected);
  });

  it("removes and later restores the same exact MaterialRef", () => {
    const session = liveSession();
    const scene = session.scenes.find((candidate) => candidate.id === "groove")!;
    const original = structuredClone(scene.layers.bass);
    queueLiveStructuralOperation(session, {
      id: "remove-bass",
      kind: "removeLayer",
      executeAtBar: 10,
      sceneId: "groove",
      layer: "bass",
    });
    queueLiveStructuralOperation(session, {
      id: "restore-bass",
      kind: "restoreLayer",
      executeAtBar: 12,
      sceneId: "groove",
      layer: "bass",
    });

    applyLiveStructuralBoundary(session, 10);
    expect(session.scenes.find((candidate) => candidate.id === "groove")!.layers.bass).toBeNull();
    applyLiveStructuralBoundary(session, 12);
    expect(session.scenes.find((candidate) => candidate.id === "groove")!.layers.bass).toEqual(original);
    expect(session.liveStructure.removedLayerRefs).toEqual({});
  });

  it("extends a scene and shifts only its successors", () => {
    const session = liveSession();
    queueLiveStructuralOperation(session, {
      id: "extend-groove",
      kind: "extendScene",
      executeAtBar: 12,
      sceneId: "groove",
      bars: 4,
    });
    applyLiveStructuralBoundary(session, 12);

    expect(session.scenes.find((scene) => scene.id === "groove")!.bars).toBe(12);
    expect(session.arrangement.scenes.find((ref) => ref.sceneId === "groove")!.startBar).toBe(8);
    expect(session.arrangement.scenes.find((ref) => ref.sceneId === "tease")!.startBar).toBe(20);
    expect(session.scenes.find((scene) => scene.id === "tease")!.startBar).toBe(20);
    expect(session.arrangement.totalBars).toBe(44);
  });

  it("selects alternate transition and ending scenes in the arrangement", () => {
    const session = liveSession();
    queueLiveStructuralOperation(session, {
      id: "alternate-transition",
      kind: "alternateTransition",
      executeAtBar: 16,
      replacementSceneId: "recompose",
    });
    queueLiveStructuralOperation(session, {
      id: "alternate-ending",
      kind: "alternateEnding",
      executeAtBar: 20,
      replacementSceneId: "opening",
    });

    applyLiveStructuralBoundary(session, 16);
    expect(session.arrangement.scenes.find((ref) => ref.startBar === 16)!.sceneId).toBe("recompose");
    applyLiveStructuralBoundary(session, 20);
    expect([...session.arrangement.scenes].sort((a, b) => b.startBar - a.startBar)[0]!.sceneId).toBe("opening");
  });

  it("orders same-boundary operations by stable ID", () => {
    const session = liveSession();
    queueLiveStructuralOperation(session, {
      id: "b-invalid-restore",
      kind: "restoreLayer",
      executeAtBar: 8,
      sceneId: "groove",
      layer: "bass",
    });
    queueLiveStructuralOperation(session, {
      id: "a-remove",
      kind: "removeLayer",
      executeAtBar: 8,
      sceneId: "groove",
      layer: "bass",
    });

    const result = applyLiveStructuralBoundary(session, 8);
    expect(result.applied.map((entry) => entry.operationId)).toEqual(["a-remove", "b-invalid-restore"]);
    expect(session.scenes.find((scene) => scene.id === "groove")!.layers.bass).not.toBeNull();
  });

  it("rolls back the whole boundary when one operation is invalid", () => {
    const session = liveSession();
    const before = structuredClone(session);
    queueLiveStructuralOperation(session, {
      id: "a-remove",
      kind: "removeLayer",
      executeAtBar: 8,
      sceneId: "groove",
      layer: "bass",
    });
    queueLiveStructuralOperation(session, {
      id: "b-bad-replacement",
      kind: "replaceLayer",
      executeAtBar: 8,
      sceneId: "groove",
      layer: "bass",
      draftId: "missing-draft",
    });
    before.liveStructure = structuredClone(session.liveStructure);

    expect(() => applyLiveStructuralBoundary(session, 8)).toThrow(/unknown draft/);
    expect(session).toEqual(before);
  });

  it("rejects missed boundaries without applying the overdue operation", () => {
    const session = liveSession();
    queueLiveStructuralOperation(session, {
      id: "remove-at-eight",
      kind: "removeLayer",
      executeAtBar: 8,
      sceneId: "groove",
      layer: "bass",
    });
    expect(() => applyLiveStructuralBoundary(session, 9)).toThrow(/missed Live structural boundary/);
    expect(session.scenes.find((scene) => scene.id === "groove")!.layers.bass).not.toBeNull();
    expect(session.liveStructure.pending).toHaveLength(1);
  });

  it("exposes the queue and boundary API through DemoRuntime and preserves canonical", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    const canonical = structuredClone(runtime.canonicalSnapshot);
    runtime.queueLiveStructuralOperation({
      id: "runtime-remove",
      kind: "removeLayer",
      executeAtBar: 8,
      sceneId: "groove",
      layer: "bass",
    });
    const result = runtime.applyLiveStructuralBoundary(8);

    expect(result.applied).toHaveLength(1);
    expect(runtime.session.scenes.find((scene) => scene.id === "groove")!.layers.bass).toBeNull();
    expect(runtime.canonicalSnapshot).toEqual(canonical);
    expect(runtime.validate()).toEqual([]);
    const comparison = runtime.previewComparison(["opening", "groove"], 0);
    expect(comparison.structuralChanges).toEqual(["Removed groove/bass"]);
    expect(comparison.canonicalTotalBars).toBe(40);
    expect(comparison.liveTotalBars).toBe(40);
  });
});

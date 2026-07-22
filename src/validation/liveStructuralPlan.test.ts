import { describe, expect, it } from "vitest";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { createCompletedProductionSession } from "../demo/productionMutations";
import { applyLiveStructuralBoundary } from "../demo/liveStructuralMutations";
import { prepareLiveStructuralPlan } from "../demo/liveStructuralPlan";

describe("deterministic Live structural plan", () => {
  it("turns the canonical clone into the audible held and alternate 44-bar take", () => {
    const canonical = createCompletedProductionSession(placeholderReconstructionPack);
    const live = structuredClone(canonical);
    const canonicalGrooveDrums = structuredClone(canonical.scenes.find((scene) => scene.id === "groove")!.layers.drums);

    prepareLiveStructuralPlan(live, placeholderReconstructionPack.livePerformanceChoreography, placeholderReconstructionPack.liveStructuralOperations);
    for (const bar of [14, 16, 18, 20, 24, 32, 38, 42]) {
      applyLiveStructuralBoundary(live, bar);
    }

    expect(live.arrangement.totalBars).toBe(44);
    expect(live.arrangement.scenes).toEqual([
      { sceneId: "opening", startBar: 6 },
      { sceneId: "groove", startBar: 16 },
      { sceneId: "tease", startBar: 24 },
      { sceneId: "opening", startBar: 32 },
      { sceneId: "recompose", startBar: 38 },
      { sceneId: "opening", startBar: 42 },
    ]);
    expect(live.scenes.find((scene) => scene.id === "opening")!.bars).toBe(10);
    expect(live.scenes.find((scene) => scene.id === "tease")!.bars).toBe(8);
    expect(live.scenes.find((scene) => scene.id === "groove")!.layers.drums).toEqual(canonicalGrooveDrums);
    expect(live.liveStructure.removedLayerRefs).toEqual({});
    expect(live.liveStructure.applied).toHaveLength(8);
    expect(canonical.arrangement.totalBars).toBe(40);
    expect(canonical.arrangement.scenes[0]).toEqual({ sceneId: "opening", startBar: 0 });
  });
});

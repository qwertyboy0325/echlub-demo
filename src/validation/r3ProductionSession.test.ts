import { describe, expect, it } from "vitest";
import { loadReconstructionPack } from "../domain/packLoader";
import { validatePack } from "../domain/reconstructionPack";
import {
  applyProductionAction,
  createCompletedProductionSession,
  createIncompleteSession,
  validateSessionRelationships,
} from "../demo/productionMutations";
import { DemoRuntime } from "../demo/demoRuntime";
import { DemoDirector } from "../demo/demoDirector";
import { placeholderReconstructionPack } from "../domain/placeholderPack";

describe("data-driven production session", () => {
  const pack = loadReconstructionPack();

  it("loads placeholder pack with data-driven participant and track counts", () => {
    expect(pack.participants.length).toBeGreaterThanOrEqual(6);
    expect(pack.participants.length).toBeLessThanOrEqual(8);
    expect(pack.tracks.length).toBeGreaterThanOrEqual(4);
    expect(validatePack(pack)).toEqual([]);
  });

  it("validates participant, workspace, and track relationships", () => {
    const session = createIncompleteSession(pack);
    expect(validateSessionRelationships(session)).toEqual([]);
    expect(session.participants.length).toBe(pack.participants.length);
    expect(session.tracks.length).toBe(pack.tracks.length);
  });
});

describe("production draft lifecycle", () => {
  const pack = placeholderReconstructionPack;

  it("mutates real draft data through production choreography", () => {
    const session = createIncompleteSession(pack);
    const before = session.drafts["memory-opening"]?.notes?.length ?? 0;
    const first = pack.productionChoreography[0]!;
    applyProductionAction(session, first, pack);
    const after = session.drafts["memory-opening"]?.notes?.length ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it("completed production equals canonical playback input", () => {
    const session = createCompletedProductionSession(pack);
    expect(session.productionComplete).toBe(true);
    expect(session.arrangement.scenes.length).toBe(pack.arrangement.scenes.length);
    for (const ref of session.arrangement.scenes) {
      expect(session.scenes.find((s) => s.id === ref.sceneId)).toBeDefined();
    }
  });
});

describe("demo runtime act skipping", () => {
  it("initializes deterministic state for each act", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("production");
    expect(runtime.session.productionComplete).toBe(false);
    runtime.skipToAct("canonicalPlayback");
    expect(runtime.session.productionComplete).toBe(true);
    runtime.skipToAct("livePerformance");
    expect(runtime.act).toBe("livePerformance");
    runtime.restartCurrentAct();
    expect(runtime.session.productionComplete).toBe(true);
  });
});

describe("presentation director ordering", () => {
  it("orders production actions deterministically", () => {
    const director = new DemoDirector();
    const ordered = director.getOrderedActions(placeholderReconstructionPack.productionChoreography);
    expect(ordered[0]?.id).toBe("prod-01");
    expect(ordered.at(-1)?.kind).toBe("assembleArrangement");
    director.onProductionAction(ordered[0]!, ["p-a", "p-b", "p-c"]);
    expect(director.getFocusState().focusedWorkspaceIds).toContain(ordered[0]!.workspaceId);
  });
});

describe("reconstruction pack boundary", () => {
  it("marks placeholder pack as prototype-only", () => {
    const pack = loadReconstructionPack();
    expect(pack.metadata.prototypeOnly).toBe(true);
    expect(pack.metadata.source).toBe("placeholder");
    expect(pack.metadata.title).not.toMatch(/四季/);
  });
});

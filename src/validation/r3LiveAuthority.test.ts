import { describe, expect, it } from "vitest";
import { buildCanonicalVsLiveComparison } from "../demo/canonicalPlayback";
import { DemoRuntime } from "../demo/demoRuntime";
import { applyProductionAction, createCompletedProductionSession } from "../demo/productionMutations";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import {
  compileSessionMaterialBank,
  materialRefForDraft,
  resolveMaterial,
} from "../domain/sessionMaterialBank";
import { performanceScript } from "../performanceScript";
import {
  applyCollaborationEvent,
  createInitialState,
  projectSessionMusicalState,
} from "../runtimeState";

function event(id: string) {
  return performanceScript.find((candidate) => candidate.id === id)!;
}

describe("ProductionSession Live musical authority", () => {
  it("applies addNote to ProductionSession before RuntimeState projection", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    const state = createInitialState();
    const stateBefore = state.drafts["memory-opening"]!.notes!.length;
    const sessionBefore = runtime.session.drafts["memory-opening"]!.notes!.length;

    runtime.applyLiveMusicalEvent(event("e03"));

    expect(runtime.session.drafts["memory-opening"]!.notes).toHaveLength(sessionBefore + 1);
    expect(state.drafts["memory-opening"]!.notes).toHaveLength(stateBefore);
    projectSessionMusicalState(state, runtime.session);
    expect(state.drafts["memory-opening"]!.notes).toEqual(
      runtime.session.drafts["memory-opening"]!.notes,
    );
  });

  it("increments revision exactly once for each actual move", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    runtime.applyLiveMusicalEvent(event("e03"));
    const before = runtime.session.drafts["memory-opening"]!.revision;
    const result = runtime.applyLiveMusicalEvent(event("e03b"));
    expect(result.contentChanged).toBe(true);
    expect(runtime.session.drafts["memory-opening"]!.revision).toBe(before + 1);
  });

  it("increments every actual scripted content mutation and never increments status-only events", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    const contentEvents = [event("e03"), event("e03b"), event("e10")];
    for (const contentEvent of contentEvents) {
      const draft = runtime.session.drafts[contentEvent.target!]!;
      const before = draft.revision;
      const result = runtime.applyLiveMusicalEvent(contentEvent);
      expect(result.contentChanged).toBe(true);
      expect(draft.revision).toBe(before + 1);
      expect(result.evidence!.afterFingerprint).not.toBe(result.evidence!.beforeFingerprint);
    }
    const opening = runtime.session.drafts["memory-opening"]!;
    const beforeStatusOnly = opening.revision;
    expect(runtime.applyLiveMusicalEvent(event("e06")).contentChanged).toBe(false);
    expect(opening.revision).toBe(beforeStatusOnly);
  });

  it("keeps RuntimeState collaboration changes out of Draft content and mix", () => {
    const state = createInitialState();
    const draftsBefore = structuredClone(state.drafts);
    const mixBefore = structuredClone(state.mix);
    applyCollaborationEvent(state, event("e03"));
    applyCollaborationEvent(state, event("e04"));
    expect(state.drafts).toEqual(draftsBefore);
    expect(state.mix).toEqual(mixBefore);
  });

  it("repins every matching Live Scene ref and leaves canonical immutable", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    const canonical = structuredClone(runtime.canonicalSnapshot!);
    const result = runtime.applyLiveMusicalEvent(event("e03"));
    const liveRef = materialRefForDraft(runtime.session.drafts["memory-opening"]!);

    expect(result.evidence!.repinnedSceneRefs.map((ref) => ref.sceneId)).toEqual(
      expect.arrayContaining(["opening", "groove", "return"]),
    );
    for (const scene of runtime.session.scenes) {
      for (const ref of Object.values(scene.layers)) {
        if (ref?.draftId === "memory-opening") expect(ref).toEqual(liveRef);
      }
    }
    expect(runtime.canonicalSnapshot).toEqual(canonical);
  });
});

describe("material revision semantics", () => {
  it("does not increment revision for a status-only production reviseDraft action", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const draft = session.drafts["memory-opening"]!;
    const beforeRevision = draft.revision;
    const beforeRef = materialRefForDraft(draft);
    const result = applyProductionAction(session, {
      id: "status-only-revise",
      atBeat: 0,
      participantId: "p-melody",
      workspaceId: "ws-melody",
      kind: "reviseDraft",
      target: "memory-opening",
      label: "Return to editing",
    }, placeholderReconstructionPack);
    expect(result.contentChanged).toBe(false);
    expect(draft.revision).toBe(beforeRevision);
    expect(materialRefForDraft(draft)).toEqual(beforeRef);
  });
});

describe("revisioned SessionMaterialBank history", () => {
  it("retains and resolves old and new revisions referenced by two Scenes", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    const oldRef = materialRefForDraft(runtime.session.drafts["memory-opening"]!);
    runtime.applyLiveMusicalEvent(event("e03"));
    const newRef = materialRefForDraft(runtime.session.drafts["memory-opening"]!);
    runtime.session.scenes.find((scene) => scene.id === "opening")!.layers.melody = oldRef;
    runtime.session.scenes.find((scene) => scene.id === "return")!.layers.melody = newRef;
    const bank = runtime.publishBank();

    expect(oldRef.revision).not.toBe(newRef.revision);
    expect(resolveMaterial(bank, oldRef)?.contentFingerprint).toBe(oldRef.fingerprint);
    expect(resolveMaterial(bank, newRef)?.contentFingerprint).toBe(newRef.fingerprint);
  });

  it("never substitutes latest material for an invalid old fingerprint", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    const ref = materialRefForDraft(session.drafts["memory-opening"]!);
    expect(resolveMaterial(bank, { ...ref, fingerprint: "fp-deadbeef" })).toBeUndefined();
  });

  it("rejects same-ID same-revision content collisions", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    session.drafts["memory-opening"]!.notes!.push({
      id: "illegal-same-revision-note",
      step: 15,
      pitch: 1,
      note: "C5",
      duration: "8n",
      velocity: 0.5,
    });
    expect(() => compileSessionMaterialBank(session, bank)).toThrow(/revision collision/);
  });
});

describe("authoritative Live mix", () => {
  it("updates session filter, delay and fader before projection", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    const state = createInitialState();
    runtime.applyLiveMusicalEvent(event("e04"));
    runtime.applyLiveMusicalEvent(event("e20"));
    runtime.applyLiveMusicalEvent(event("e25b"));
    projectSessionMusicalState(state, runtime.session);

    expect(runtime.session.mix.filter).toBe(780);
    expect(runtime.session.mix.delayWet).toBe(0.3);
    expect(runtime.session.mix.faders.melody).toBe(72);
    expect(state.mix).toEqual(runtime.session.mix);
  });

  it("uses launched Scene FX as the authoritative session mix", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    runtime.applyLiveMusicalEvent(event("e04"));
    runtime.applyLiveSceneMix("opening", "e08");
    const opening = runtime.session.scenes.find((scene) => scene.id === "opening")!;
    expect(runtime.session.mix).toEqual(opening.fx);
  });

  it("comparison detects filter, delay, reverb, master and fader differences", () => {
    const canonical = createCompletedProductionSession(placeholderReconstructionPack);
    const live = structuredClone(canonical);
    live.mix = structuredClone(live.scenes.find((scene) => scene.id === "return")!.fx);
    const canonicalBank = compileSessionMaterialBank(canonical);
    const liveBank = compileSessionMaterialBank(live);
    const comparison = buildCanonicalVsLiveComparison(
      canonical,
      canonicalBank,
      live,
      liveBank,
      [],
      0,
    );
    expect(comparison.changedFx).toEqual(expect.arrayContaining([
      "filter",
      "delayWet",
      "reverbWet",
      "masterGain",
      "faders.groove",
      "faders.harmony",
      "faders.melody",
      "faders.texture",
    ]));
  });
});

describe("real e03/e03b causal delta", () => {
  it("produces a resolvable same-ID comparison delta with no canonical mutation", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    const canonicalRef = runtime.canonicalSnapshot!.scenes.find(
      (scene) => scene.id === "opening",
    )!.layers.melody!;
    runtime.applyLiveMusicalEvent(event("e03"));
    runtime.applyLiveMusicalEvent(event("e03b"));
    const liveRef = runtime.session.scenes.find((scene) => scene.id === "opening")!.layers.melody!;
    const comparison = runtime.previewComparison(["opening"], 0);

    expect(liveRef.revision).toBeGreaterThan(canonicalRef.revision);
    expect(liveRef.fingerprint).not.toBe(canonicalRef.fingerprint);
    expect(resolveMaterial(runtime.materialBank, liveRef)).toBeDefined();
    expect(comparison.sameIdContentChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sceneId: "opening", layer: "melody", draftId: "memory-opening" }),
    ]));
  });
});

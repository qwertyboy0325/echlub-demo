import { describe, expect, it } from "vitest";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import {
  compileDraftMaterial,
  compileSessionMaterialBank,
  fingerprintContent,
  materialRefForDraft,
  resolveMaterial,
} from "../domain/sessionMaterialBank";
import {
  applyProductionAction,
  createCompletedProductionSession,
  createIncompleteSession,
  ALL_PRODUCTION_ACTION_KINDS,
  PRODUCTION_ROLE_IDS,
  validateSceneMaterialRefs,
} from "../demo/productionMutations";
import { DemoRuntime } from "../demo/demoRuntime";
import { buildCanonicalVsLiveComparison } from "../demo/canonicalPlayback";
import type { DrumMaterialContent } from "../domain/materialTypes";

describe("compiler determinism", () => {
  it("produces identical fingerprint for same content", () => {
    const session = createIncompleteSession(placeholderReconstructionPack);
    const bank1 = compileSessionMaterialBank(session);
    const bank2 = compileSessionMaterialBank(session);
    const draft = session.drafts["memory-opening"]!;
    const m1 = resolveMaterial(bank1, materialRefForDraft(draft))!;
    const m2 = resolveMaterial(bank2, materialRefForDraft(draft))!;
    expect(m1.contentFingerprint).toBe(m2.contentFingerprint);
  });
});

describe("content mutation changes revision and fingerprint", () => {
  it("increments revision and changes fingerprint on addNote", () => {
    const session = createIncompleteSession(placeholderReconstructionPack);
    const before = compileDraftMaterial(session.drafts["memory-opening"]!);
    applyProductionAction(session, placeholderReconstructionPack.productionChoreography[0]!, placeholderReconstructionPack);
    const after = compileDraftMaterial(session.drafts["memory-opening"]!);
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(after.contentFingerprint).not.toBe(before.contentFingerprint);
  });
});

describe("Scene pins exact MaterialRef", () => {
  it("placeInScene stores draftId revision and fingerprint", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const opening = session.scenes.find((s) => s.id === "opening")!;
    const melodyRef = opening.layers.melody;
    expect(melodyRef).toBeTruthy();
    expect(melodyRef!.draftId).toBe("memory-opening");
    expect(melodyRef!.revision).toBeGreaterThan(0);
    expect(melodyRef!.fingerprint).toMatch(/^fp-/);
  });
});

describe("missing material fails without fallback", () => {
  it("resolveMaterial returns undefined for wrong revision", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    const badRef = { draftId: "memory-opening", revision: 9999, fingerprint: "fp-deadbeef" };
    expect(resolveMaterial(bank, badRef)).toBeUndefined();
  });
});

describe("all Scene refs resolve", () => {
  it("validates all placed refs against bank", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    expect(validateSceneMaterialRefs(session, bank)).toEqual([]);
  });
});

describe("all eight roles perform meaningful actions", () => {
  it("covers every production role in choreography", () => {
    const roles = new Set(placeholderReconstructionPack.productionChoreography.map((a) => a.participantId));
    const expected = placeholderReconstructionPack.participants.map((p) => p.id);
    for (const id of expected) expect(roles.has(id)).toBe(true);
  });
});

describe("all retained action kinds have implementations", () => {
  it("choreography only uses known action kinds", () => {
    for (const action of placeholderReconstructionPack.productionChoreography) {
      expect(ALL_PRODUCTION_ACTION_KINDS).toContain(action.kind);
    }
  });

  it("lists all eight role ids", () => {
    expect(PRODUCTION_ROLE_IDS).toHaveLength(8);
  });
});

describe("act schedule isolation", () => {
  it("production act has no live schedule owner", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("production", () => {});
    expect(runtime.scheduleRegistry.owner).toBe("production");
    expect(runtime.scheduleRegistry.liveScriptIds).toEqual([]);
  });

  it("canonical act has no live schedules", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("canonicalPlayback", () => {});
    expect(runtime.scheduleRegistry.owner).toBe("canonical");
    expect(runtime.scheduleRegistry.liveScriptIds).toEqual([]);
  });
});

describe("live starts from canonical snapshot", () => {
  it("preserves canonical draft revisions at live entry", () => {
    const runtime = new DemoRuntime(placeholderReconstructionPack);
    runtime.skipToAct("livePerformance", () => {});
    expect(runtime.canonicalSnapshot).toBeTruthy();
    const canonMelody = runtime.canonicalSnapshot!.scenes.find((s) => s.id === "opening")?.layers.melody;
    const liveMelody = runtime.session.scenes.find((s) => s.id === "opening")?.layers.melody;
    expect(liveMelody?.draftId).toBe(canonMelody?.draftId);
    expect(liveMelody?.fingerprint).toBe(canonMelody?.fingerprint);
  });
});

describe("comparison detects same-ID content change", () => {
  it("detects fingerprint delta at same draftId", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    const live = structuredClone(session);
    const draft = live.drafts["memory-opening"]!;
    draft.notes = [...(draft.notes ?? []), {
      id: "unique-causal-note",
      step: 15,
      pitch: 4,
      note: "D5",
      duration: "8n",
      velocity: 0.9,
    }];
    draft.revision += 1;
    const liveRef = materialRefForDraft(draft);
    const opening = live.scenes.find((s) => s.id === "opening")!;
    opening.layers.melody = liveRef;
    const liveBank = compileSessionMaterialBank(live);
    const cmp = buildCanonicalVsLiveComparison(session, bank, live, liveBank, [], 0);
    expect(cmp.sameIdContentChanges.some((c) => c.draftId === "memory-opening")).toBe(true);
  });
});

describe("fingerprint stability", () => {
  it("drum content fingerprint is deterministic", () => {
    const content: DrumMaterialContent = { kind: "drums", patternBars: 1, hits: [{ bar: 0, step: 0, voice: "kick", velocity: 0.7 }] };
    expect(fingerprintContent(content)).toBe(fingerprintContent(structuredClone(content)));
  });

  it("preserves explicit drum voices instead of inferring them from step positions", () => {
    const draft = structuredClone(placeholderReconstructionPack.drafts.find((candidate) => candidate.id === "pulse-sparse")!);
    draft.patternBars = 2;
    draft.drumHits = [{ bar: 1, step: 3, voice: "snare", velocity: 0.51 }];
    const material = compileDraftMaterial(draft);
    expect(material.content).toEqual({
      kind: "drums",
      patternBars: 2,
      hits: [{ bar: 1, step: 3, voice: "snare", velocity: 0.51 }],
    });
  });

  it("preserves multi-bar note and syncopated chord timing in produced material", () => {
    const melody = structuredClone(placeholderReconstructionPack.drafts.find((candidate) => candidate.id === "memory-main")!);
    melody.patternBars = 4;
    melody.notes = [{ id: "bar-three-note", bar: 3, step: 11, pitch: 0, note: "Db5", duration: "16n", velocity: 0.61 }];
    const harmony = structuredClone(placeholderReconstructionPack.drafts.find((candidate) => candidate.id === "story-opening")!);
    harmony.patternBars = 4;
    harmony.harmonyChords = [{ bar: 2, step: 14, notes: ["Db3", "Ab3", "F4"], duration: "16n", velocity: 0.32, articulation: "muted" }];

    expect(compileDraftMaterial(melody).content).toMatchObject({ patternBars: 4, notes: [{ bar: 3, step: 11 }] });
    expect(compileDraftMaterial(harmony).content).toMatchObject({ patternBars: 4, chords: [{ bar: 2, step: 14, articulation: "muted" }] });
  });

  it("fingerprints slide, dead-note, and microtiming performance data", () => {
    const draft = structuredClone(placeholderReconstructionPack.drafts.find((candidate) => candidate.id === "bass-main")!);
    draft.notes = [{
      id: "expressive-bass", step: 6, pitch: 0, note: "F2", duration: "8n", velocity: 0.5,
      articulation: "slide", glideFrom: "Eb2", timingOffset: 0.14,
    }];
    const expressive = compileDraftMaterial(draft);
    draft.notes[0]!.articulation = "muted";
    const muted = compileDraftMaterial(draft);

    expect(expressive.content).toMatchObject({ notes: [{ articulation: "slide", glideFrom: "Eb2", timingOffset: 0.14 }] });
    expect(expressive.contentFingerprint).not.toBe(muted.contentFingerprint);
  });
});

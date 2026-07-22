import { describe, expect, it, beforeEach } from "vitest";
import { AudioEngine, shouldAudioEngineFinishAtStep } from "../audioEngine";
import { compileSessionMaterialBank, materialRefForDraft, resolveMaterial } from "../domain/sessionMaterialBank";
import { createCompletedProductionSession } from "../demo/productionMutations";
import { placeholderReconstructionPack } from "../domain/placeholderPack";

describe("AudioEngine material bank injection", () => {
  let engine: AudioEngine;

  beforeEach(() => {
    engine = new AudioEngine({ onStep: () => {}, onFinished: () => {} });
  });

  it("bank resolves exact MaterialRef for memory-opening", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    const draft = session.drafts["memory-opening"]!;
    const ref = materialRefForDraft(draft);
    const material = resolveMaterial(bank, ref);
    expect(material).toBeDefined();
    expect(material!.draftId).toBe("memory-opening");
    expect(material!.revision).toBe(ref.revision);
    expect(material!.contentFingerprint).toBe(ref.fingerprint);
  });

  it("emits missing material diagnostic without fallback", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    engine.setMaterialBank(bank);
    engine.startPrivateCue({ draftId: "nonexistent", revision: 0, fingerprint: "fp-00000000" });
    expect(engine.missingMaterialLog.length).toBeGreaterThan(0);
    expect(engine.missingMaterialLog[0]!.draftId).toBe("nonexistent");
    expect(engine.getCueNoteCount()).toBe(0);
  });

  it("accepts bank injection via setMaterialBank", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const bank = compileSessionMaterialBank(session);
    engine.setMaterialBank(bank);
    expect(engine.getMaterialBank()?.version).toBe(bank.version);
  });

  it("copies a pack-owned sound design preset before initialization", () => {
    const preset = structuredClone(placeholderReconstructionPack.soundDesign);
    preset.master.delayFeedback = 0.19;
    engine.setSoundDesign(preset);

    const snapshot = engine.getSoundDesignPreset();
    expect(snapshot).toEqual(preset);
    snapshot.master.delayFeedback = 0.9;
    expect(engine.getSoundDesignPreset().master.delayFeedback).toBe(0.19);
  });

  it("accepts and isolates a pack-owned tempo map", () => {
    const tempoMap = [{ bar: 0, bpm: 92.5 }, { bar: 20, bpm: 89.5 }];
    engine.setTempoMap(tempoMap);

    const snapshot = engine.getTempoMap();
    expect(snapshot).toEqual(tempoMap);
    snapshot[1]!.bpm = 120;
    expect(engine.getTempoMap()[1]!.bpm).toBe(89.5);
    expect(() => engine.setTempoMap([{ bar: 2, bpm: 90 }])).toThrow("must start at bar 0");
  });

  it("leaves canonical completion to the arrangement boundary", () => {
    expect(shouldAudioEngineFinishAtStep("canonicalPlayback", 114, 114, 0, 0)).toBe(false);
    expect(shouldAudioEngineFinishAtStep("livePerformance", 114, 114, 0, 0)).toBe(true);
    expect(shouldAudioEngineFinishAtStep("livePerformance", 113, 114, 0, 0)).toBe(false);
  });
});

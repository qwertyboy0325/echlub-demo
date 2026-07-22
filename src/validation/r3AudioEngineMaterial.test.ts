import { describe, expect, it, beforeEach } from "vitest";
import { AudioEngine } from "../audioEngine";
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
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCompletedProductionSession } from "../demo/productionMutations";
import { applyCapabilityLiveOperation } from "../demo/capabilityLiveOperations";
import { resolveCapabilityOperationContext } from "../domain/capabilityOperations";
import { parseReconstructionPackJson } from "../domain/packLoader";
import { placeholderReconstructionPack } from "../domain/placeholderPack";

describe("capability operations", () => {
  it("resolves bass draft from track assignment, not hard-coded bass-main", () => {
    const pack = parseReconstructionPackJson(
      readFileSync(join(process.cwd(), "public/shiki-no-uta.demo.pack.json"), "utf8"),
    );
    const session = createCompletedProductionSession(pack);
    const ctx = resolveCapabilityOperationContext(session, "cap-lowend");
    expect(ctx).toBeDefined();
    expect(ctx!.draftId).not.toBe("bass-main");
    expect(ctx!.draftId).toMatch(/^midi-.*bass$/);
    expect(ctx!.trackId).toMatch(/track-(bass|piano-lh)/);
    expect(ctx!.participantId).toBe("p-bass");
  });

  it("private cue produces preview state and material ref without legacy BrainId", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const evidence = applyCapabilityLiveOperation(
      session,
      placeholderReconstructionPack,
      "cap-lowend",
      "privateCue",
    );
    expect(evidence).toBeTruthy();
    expect(evidence!.operation).toBe("privateCue");
    expect(evidence!.cueStarted).toBe(true);
    expect(evidence!.context.capabilityId).toBe("cap-lowend");
    expect(session.drafts[evidence!.context.draftId].status).toBe("preview");
    expect(evidence!.materialRef.draftId).toBe(evidence!.context.draftId);
  });

  it("harmony revision bumps revision and repins scene layers", () => {
    const session = createCompletedProductionSession(placeholderReconstructionPack);
    const ctx = resolveCapabilityOperationContext(session, "cap-harmony")!;
    const before = session.drafts[ctx.draftId].revision;
    const evidence = applyCapabilityLiveOperation(
      session,
      placeholderReconstructionPack,
      "cap-harmony",
      "revision",
    );
    expect(evidence).toBeTruthy();
    expect(evidence!.afterRevision).toBeGreaterThan(before);
    expect(evidence!.afterFingerprint).not.toBe(evidence!.beforeFingerprint);
    expect(evidence!.draftStatus).toBe("offered");
    expect(evidence!.repinnedSceneRefs.length).toBeGreaterThan(0);
  });
});

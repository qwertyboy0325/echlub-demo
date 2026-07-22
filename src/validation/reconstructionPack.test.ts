import { describe, expect, it } from "vitest";
import {
  DEV_LOCAL_PACK_GLOBAL,
  importReconstructionPackFile,
  loadReconstructionPack,
  parseReconstructionPackJson,
} from "../domain/packLoader";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import {
  RECONSTRUCTION_PACK_SCHEMA_VERSION,
  ReconstructionPackValidationError,
  inspectReconstructionPack,
} from "../domain/reconstructionPack";
import { createCompletedProductionSession } from "../demo/productionMutations";

function privateFixture(): typeof placeholderReconstructionPack {
  const pack = structuredClone(placeholderReconstructionPack);
  pack.metadata.id = "owner-private-fixture";
  pack.metadata.title = "Owner private fixture";
  pack.metadata.source = "local-private";
  pack.provenance = {
    createdBy: "owner",
    sourceDescription: "Fixture standing in for an owner-local transcription.",
    rightsBasis: "owner-provided-private-reference",
    referenceAssetIds: ["owner-ref-01"],
  };
  pack.confidence = {
    overall: 0.8,
    rhythm: 0.9,
    harmony: 0.7,
    melody: 0.75,
    arrangement: 0.85,
    notes: ["Fixture confidence only."],
  };
  return pack;
}

describe("ReconstructionPack JSON boundary", () => {
  it("keeps the placeholder compliant with the versioned strict schema", () => {
    expect(placeholderReconstructionPack.schemaVersion).toBe(RECONSTRUCTION_PACK_SCHEMA_VERSION);
    expect(inspectReconstructionPack(placeholderReconstructionPack)).toEqual([]);
    expect(JSON.parse(JSON.stringify(placeholderReconstructionPack))).toEqual(placeholderReconstructionPack);
  });

  it("round-trips and clones a valid owner-private pack", () => {
    const fixture = privateFixture();
    const imported = parseReconstructionPackJson(JSON.stringify(fixture));

    expect(imported).toEqual(fixture);
    expect(imported).not.toBe(fixture);
    expect(imported.metadata.source).toBe("local-private");
    expect(imported.provenance.referenceAssetIds).toEqual(["owner-ref-01"]);
  });

  it("imports a browser-style local file without uploading it", async () => {
    const fixture = privateFixture();
    let reads = 0;
    const imported = await importReconstructionPackFile({
      name: "owner-pack.json",
      async text() {
        reads += 1;
        return JSON.stringify(fixture);
      },
    });

    expect(reads).toBe(1);
    expect(imported.metadata.id).toBe("owner-private-fixture");
  });

  it("supports a dev-local global injection and does not share mutable data", () => {
    const fixture = privateFixture();
    const globals = globalThis as typeof globalThis & Record<typeof DEV_LOCAL_PACK_GLOBAL, unknown>;
    globals[DEV_LOCAL_PACK_GLOBAL] = fixture;
    try {
      const loaded = loadReconstructionPack();
      loaded.metadata.title = "mutated loaded copy";
      expect(fixture.metadata.title).toBe("Owner private fixture");
    } finally {
      delete (globals as Partial<typeof globals>)[DEV_LOCAL_PACK_GLOBAL];
    }
  });

  it("rejects wrong versions, non-JSON values, invalid rights, and broken references", () => {
    const invalid = privateFixture() as typeof placeholderReconstructionPack & {
      helper?: () => void;
    };
    invalid.schemaVersion = 999 as typeof RECONSTRUCTION_PACK_SCHEMA_VERSION;
    invalid.provenance.rightsBasis = "original-placeholder";
    invalid.scenePlacements.opening!.melody = "missing-draft";
    invalid.helper = () => undefined;

    const issues = inspectReconstructionPack(invalid);
    expect(issues.some((issue) => issue.path === "schemaVersion")).toBe(true);
    expect(issues.some((issue) => issue.path === "provenance.rightsBasis")).toBe(true);
    expect(issues.some((issue) => issue.path === "scenePlacements.opening.melody")).toBe(true);
    expect(issues.some((issue) => issue.path === "$.helper")).toBe(true);
    expect(() => loadReconstructionPack(invalid)).toThrow(ReconstructionPackValidationError);
  });

  it("uses pack-owned placements when producing the canonical session", () => {
    const fixture = privateFixture();
    fixture.scenePlacements.opening!.melody = "memory-response";
    const session = createCompletedProductionSession(fixture);

    expect(session.scenes.find((scene) => scene.id === "opening")?.layers.melody?.draftId).toBe("memory-response");
  });

  it("reports incompatible placement kinds with a precise path", () => {
    const fixture = privateFixture();
    fixture.scenePlacements.opening!.melody = "pulse-sparse";

    expect(inspectReconstructionPack(fixture)).toContainEqual({
      path: "scenePlacements.opening.melody",
      message: "draft pulse-sparse has incompatible kind",
    });
  });

  it("keeps a compact production sequence while exercising concrete draft edit operations", () => {
    const kinds = new Set(placeholderReconstructionPack.productionChoreography.map((action) => action.kind));

    expect(placeholderReconstructionPack.productionChoreography).toHaveLength(31);
    for (const kind of ["createDraft", "moveNote", "setVelocity", "reviseDraft"] as const) {
      expect(kinds.has(kind), `missing production action ${kind}`).toBe(true);
    }
  });
});

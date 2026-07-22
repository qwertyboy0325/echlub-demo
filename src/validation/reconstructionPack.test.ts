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
import { compileDraftMaterial } from "../domain/sessionMaterialBank";
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

  it("accepts only explicitly owner-authorized public cover provenance", () => {
    const authorized = privateFixture();
    authorized.metadata.source = "public-demo";
    authorized.provenance.rightsBasis = "owner-authorized-public-cover";
    expect(inspectReconstructionPack(authorized)).toEqual([]);

    const unauthorized = structuredClone(authorized);
    unauthorized.provenance.rightsBasis = "owner-provided-private-reference";
    expect(inspectReconstructionPack(unauthorized)).toContainEqual({
      path: "provenance.rightsBasis",
      message: "public-demo packs require owner-authorized-public-cover",
    });
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

  it("pins pack-owned secondary voices into scene layer stacks", () => {
    const fixture = privateFixture();
    fixture.sceneLayerStacks = {
      opening: { harmony: ["story-opening"], melody: ["memory-opening", "memory-response"] },
    };

    const session = createCompletedProductionSession(fixture);
    const opening = session.scenes.find((scene) => scene.id === "opening");
    expect(opening?.layerStacks?.harmony?.map((ref) => ref.draftId)).toEqual(["story-opening"]);
    expect(opening?.layerStacks?.melody?.map((ref) => ref.draftId)).toEqual(["memory-opening", "memory-response"]);
    expect(opening?.layerStacks?.melody?.every((ref) => ref.fingerprint.length > 0)).toBe(true);
  });

  it("reports incompatible secondary voice kinds with a precise path", () => {
    const fixture = privateFixture();
    fixture.sceneLayerStacks = { opening: { melody: ["pulse-sparse"] } };

    expect(inspectReconstructionPack(fixture)).toContainEqual({
      path: "sceneLayerStacks.opening.melody[0]",
      message: "draft pulse-sparse has incompatible kind",
    });
  });

  it("retains a synthesized reed voice in validation and material fingerprints", () => {
    const fixture = privateFixture();
    const melody = fixture.drafts.find((draft) => draft.id === "memory-opening")!;
    melody.notes![0].instrument = "reed";
    melody.notes![1].instrument = "guitar";

    expect(inspectReconstructionPack(fixture)).toEqual([]);
    const reedMaterial = compileDraftMaterial(melody);
    expect(reedMaterial.content.kind).toBe("melody");
    if (reedMaterial.content.kind !== "melody") throw new Error("expected melody material");
    expect(reedMaterial.content.notes[0]).toMatchObject({ instrument: "reed" });
    expect(reedMaterial.content.notes[1]).toMatchObject({ instrument: "guitar" });

    melody.notes![0].instrument = "default";
    expect(compileDraftMaterial(melody).contentFingerprint).not.toBe(reedMaterial.contentFingerprint);
  });

  it("rejects unsafe sound-design values with precise paths", () => {
    const fixture = privateFixture();
    fixture.soundDesign.master.delayFeedback = 1;
    fixture.soundDesign.bass.envelope.sustain = -0.1;
    fixture.soundDesign.texture.noise = "violet" as typeof fixture.soundDesign.texture.noise;

    const issues = inspectReconstructionPack(fixture);
    expect(issues.some((issue) => issue.path === "soundDesign.master.delayFeedback")).toBe(true);
    expect(issues.some((issue) => issue.path === "soundDesign.bass.envelope.sustain")).toBe(true);
    expect(issues.some((issue) => issue.path === "soundDesign.texture.noise")).toBe(true);
  });

  it("requires an ordered tempo map beginning at bar zero", () => {
    const fixture = privateFixture();
    fixture.tempoMap = [{ bar: 1, bpm: 90 }, { bar: 1, bpm: -1 }];

    const issues = inspectReconstructionPack(fixture);
    expect(issues.some((issue) => issue.path === "tempoMap[0].bar")).toBe(true);
    expect(issues.some((issue) => issue.path === "tempoMap[1].bar")).toBe(true);
    expect(issues.some((issue) => issue.path === "tempoMap[1].bpm")).toBe(true);
  });

  it("rejects invalid multi-bar event coordinates and explicit drum voices", () => {
    const fixture = privateFixture();
    const drums = fixture.drafts.find((draft) => draft.id === "pulse-sparse")!;
    drums.patternBars = 0;
    drums.drumHits = [{ bar: -1, step: 16, voice: "clap" as "snare", velocity: 1.2 }];

    const issues = inspectReconstructionPack(fixture);
    expect(issues.some((issue) => issue.path.endsWith("patternBars"))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith("drumHits[0].bar"))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith("drumHits[0].step"))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith("drumHits[0].voice"))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith("drumHits[0].velocity"))).toBe(true);
  });

  it("validates expressive string articulations and microtiming", () => {
    const fixture = privateFixture();
    const bass = fixture.drafts.find((draft) => draft.id === "bass-main")!;
    bass.notes![0] = {
      ...bass.notes![0],
      articulation: "slide",
      glideFrom: "Eb2",
      timingOffset: 0.18,
    };
    expect(inspectReconstructionPack(fixture)).toEqual([]);

    bass.notes![0]!.articulation = "bend" as "slide";
    bass.notes![0]!.timingOffset = 0.75;
    const issues = inspectReconstructionPack(fixture);
    expect(issues.some((issue) => issue.path.endsWith("notes[0].articulation"))).toBe(true);
    expect(issues.some((issue) => issue.path.endsWith("notes[0].timingOffset"))).toBe(true);
  });

  it("keeps a compact production sequence while exercising concrete draft edit operations", () => {
    const kinds = new Set(placeholderReconstructionPack.productionChoreography.map((action) => action.kind));

    expect(placeholderReconstructionPack.productionChoreography).toHaveLength(31);
    for (const kind of ["createDraft", "moveNote", "setVelocity", "reviseDraft"] as const) {
      expect(kinds.has(kind), `missing production action ${kind}`).toBe(true);
    }
  });
});

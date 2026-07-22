import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DemoRuntime } from "../demo/demoRuntime";
import { parseReconstructionPackJson } from "../domain/packLoader";
import { resolveMaterial } from "../domain/sessionMaterialBank";

describe("public Shiki No Uta song form", () => {
  it("unfolds the full cover into materially distinct Ableton-style scenes", () => {
    const pack = parseReconstructionPackJson(readFileSync(
      resolve(process.cwd(), "public/shiki-no-uta.demo.pack.json"),
      "utf8",
    ));
    const runtime = new DemoRuntime(pack);

    runtime.completeProductionInstantly();

    expect(runtime.session.arrangement.totalBars).toBe(114);
    expect(runtime.session.arrangement.scenes).toHaveLength(16);
    expect(runtime.session.arrangement.scenes.map((scene) => scene.startBar)).toEqual([
      0, 4, 12, 20, 30, 38, 46, 54, 56, 64, 80, 88, 96, 100, 104, 110,
    ]);

    const arranged = runtime.session.arrangement.scenes.map(({ sceneId }) =>
      runtime.session.scenes.find((scene) => scene.id === sceneId),
    );
    expect(arranged.every(Boolean)).toBe(true);
    expect(arranged.every((scene) => scene
      && (Object.values(scene.layers).some(Boolean)
        || Object.values(scene.layerStacks ?? {}).some((refs) => refs?.length)))).toBe(true);

    const materialSignatures = arranged.map((scene) => JSON.stringify({
      layers: scene?.layers,
      stacks: scene?.layerStacks,
    }));
    expect(new Set(materialSignatures).size).toBeGreaterThanOrEqual(13);

    for (const scene of arranged) {
      const refs = [
        ...Object.values(scene?.layers ?? {}).filter((value) => value !== null),
        ...Object.values(scene?.layerStacks ?? {}).flatMap((values) => values ?? []),
      ];
      for (const ref of refs) {
        const material = resolveMaterial(runtime.materialBank, ref!);
        expect(material, `${scene?.id}/${ref!.draftId} should resolve`).toBeDefined();
        if (!material) continue;
        const content = material.content;
        const eventCount = content.kind === "drums" ? content.hits.length
          : content.kind === "harmony" ? content.chords.length
            : content.kind === "texture" ? Number(content.level > 0)
              : content.notes.length;
        expect(eventCount, `${scene?.id}/${ref!.draftId} should not be empty`).toBeGreaterThan(0);
      }
    }

    const openingHarmony = pack.drafts.find((draft) => draft.id === "story-opening");
    expect(openingHarmony?.harmonyChords?.filter((chord) => chord.notes.length >= 4).map((chord) => ({
      bar: chord.bar,
      step: chord.step,
      root: chord.notes[0],
    }))).toEqual([
      { bar: 0, step: 0, root: "Gb2" },
      { bar: 0, step: 8, root: "F2" },
      { bar: 1, step: 0, root: "Bb2" },
    ]);

    const openingBass = pack.drafts.find((draft) => draft.id === "bass-main");
    expect(openingBass?.notes?.filter((note) => note.bar === 0).map((note) => ({
      bar: note.bar,
      step: note.step,
      note: note.note,
    }))).toEqual([
      { bar: 0, step: 0, note: "Gb1" },
      { bar: 0, step: 2, note: "Db2" },
      { bar: 0, step: 4, note: "F2" },
      { bar: 0, step: 6, note: "Db2" },
      { bar: 0, step: 8, note: "F1" },
      { bar: 0, step: 10, note: "C2" },
      { bar: 0, step: 12, note: "Eb2" },
      { bar: 0, step: 14, note: "C2" },
    ]);
    expect(openingBass?.notes?.find((note) => note.bar === 1 && note.step === 0)?.note).toBe("Bb1");
    expect(pack.soundDesign.harmony.envelope.sustain).toBeGreaterThanOrEqual(0.4);

    const responseBass = pack.drafts.find((draft) => draft.id === "bass-response");
    const saxBass = pack.drafts.find((draft) => draft.id === "bass-sax");
    const saxHarmony = pack.drafts.find((draft) => draft.id === "story-sax");
    expect(responseBass?.notes?.length).toBeGreaterThanOrEqual(36);
    expect(saxBass?.notes?.length).toBeGreaterThanOrEqual(20);
    expect(saxHarmony?.harmonyChords?.length).toBeGreaterThanOrEqual(8);

    const sparseDrums = pack.drafts.find((draft) => draft.id === "pulse-sparse");
    const fullDrums = pack.drafts.find((draft) => draft.id === "pulse-full");
    const breakDrums = pack.drafts.find((draft) => draft.id === "pulse-break");
    expect(sparseDrums?.drumHits?.length).toBeGreaterThanOrEqual(24);
    expect(fullDrums?.drumHits?.length).toBeGreaterThanOrEqual(30);
    expect(breakDrums?.drumHits?.length).toBeGreaterThanOrEqual(16);

    const mainMelody = pack.drafts.find((draft) => draft.id === "memory-main");
    expect(Math.min(...(mainMelody?.notes?.map((note) => note.bar ?? 0) ?? []))).toBe(0);

    const openingMelody = pack.drafts.find((draft) => draft.id === "memory-opening");
    expect(openingMelody?.notes?.filter((note) => note.id.startsWith("signature-")).map((note) => ({
      bar: note.bar,
      step: note.step,
      note: note.note,
    }))).toEqual([
      { bar: 0, step: 7, note: "Bb4" },
      { bar: 0, step: 8, note: "Bb4" },
      { bar: 0, step: 10, note: "C5" },
      { bar: 0, step: 14, note: "F5" },
      { bar: 1, step: 0, note: "C5" },
      { bar: 1, step: 6, note: "Eb5" },
      { bar: 1, step: 7, note: "Db5" },
      { bar: 1, step: 10, note: "C5" },
      { bar: 1, step: 14, note: "Bb4" },
    ]);
    expect(Object.keys(pack.sceneLayerStacks ?? {})).toEqual([
      "chorus", "release", "refrain", "recompose", "return",
    ]);
    expect(pack.sceneLayerStacks?.chorus?.melody).toEqual(["memory-counter"]);
    expect(pack.sceneLayerStacks?.release?.harmony).toEqual(["story-comp"]);

    const drumSolo = arranged.find((scene) => scene?.id === "drum-solo");
    expect(drumSolo?.layers.drums?.draftId).toBe("pulse-full");
    expect(drumSolo?.layers.bass).toBeNull();
    expect(drumSolo?.layers.harmony).toBeNull();
    expect(drumSolo?.layers.melody).toBeNull();
  });
});

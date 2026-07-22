import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DemoRuntime } from "../demo/demoRuntime";
import { parseReconstructionPackJson } from "../domain/packLoader";

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
      0, 4, 12, 20, 30, 38, 46, 54, 56, 68, 80, 88, 96, 100, 104, 110,
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

    const openingHarmony = pack.drafts.find((draft) => draft.id === "story-opening");
    expect(openingHarmony?.harmonyChords?.map((chord) => ({
      bar: chord.bar,
      step: chord.step,
      root: chord.notes[0],
    }))).toEqual([
      { bar: 0, step: 0, root: "Gb2" },
      { bar: 0, step: 8, root: "F2" },
      { bar: 1, step: 0, root: "Bb2" },
    ]);

    const openingBass = pack.drafts.find((draft) => draft.id === "bass-main");
    expect(openingBass?.notes?.slice(0, 4).map((note) => ({
      bar: note.bar,
      step: note.step,
      note: note.note,
    }))).toEqual([
      { bar: 0, step: 0, note: "Gb1" },
      { bar: 0, step: 8, note: "F1" },
      { bar: 0, step: 14, note: "Ab1" },
      { bar: 1, step: 0, note: "Bb1" },
    ]);

    const mainMelody = pack.drafts.find((draft) => draft.id === "memory-main");
    expect(Math.min(...(mainMelody?.notes?.map((note) => note.bar ?? 0) ?? []))).toBe(0);
    expect(pack.sceneLayerStacks).toEqual({});

    const drumSolo = arranged.find((scene) => scene?.id === "drum-solo");
    expect(drumSolo?.layers.drums?.draftId).toBe("pulse-full");
    expect(drumSolo?.layers.bass).toBeNull();
    expect(drumSolo?.layers.harmony).toBeNull();
    expect(drumSolo?.layers.melody).toBeNull();
  });
});

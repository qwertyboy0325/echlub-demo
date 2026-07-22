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

    const drumSolo = arranged.find((scene) => scene?.id === "drum-solo");
    expect(drumSolo?.layers.drums?.draftId).toBe("pulse-full");
    expect(drumSolo?.layers.bass).toBeNull();
    expect(drumSolo?.layers.harmony).toBeNull();
    expect(drumSolo?.layers.melody).toBeNull();
  });
});

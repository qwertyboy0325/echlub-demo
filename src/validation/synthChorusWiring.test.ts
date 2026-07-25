import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLiveCollabPackJson } from "../domain/liveCollabPack";
import { SHIKI_LIVE_COLLAB_PACK_PATH } from "./shikiPackIntegrity";

const graphSource = readFileSync(join(process.cwd(), "src/audio/masterAudioGraph.ts"), "utf8");
const offlineSource = readFileSync(join(process.cwd(), "src/offline/canonicalOfflineRenderer.ts"), "utf8");
const livePack = parseLiveCollabPackJson(
  readFileSync(join(process.cwd(), SHIKI_LIVE_COLLAB_PACK_PATH), "utf8"),
);

describe("synth chorus wiring", () => {
  it("builds harmony and melody chorus from pack soundDesign", () => {
    expect(graphSource).toContain("createSynthChorus(sound.harmony)");
    expect(graphSource).toContain("createSynthChorus(sound.melody)");
    expect(graphSource).toContain("frequency: design.chorusFrequency");
    expect(graphSource).toContain("depth: design.chorusDepth");
    expect(graphSource).toContain("wet: design.chorusWet");
    expect(graphSource).not.toMatch(/harmonyChorus = new Tone\.Gain\(1\)/);
    expect(graphSource).not.toMatch(/melodyChorus = new Tone\.Gain\(1\)/);
    expect(graphSource).toContain("harmonyChorus: Tone.Chorus");
    expect(graphSource).toContain("melodyChorus: Tone.Chorus");
  });

  it("starts chorus LFOs during graph preparation", () => {
    expect(graphSource).toContain("graph.harmonyChorus.start()");
    expect(graphSource).toContain("graph.melodyChorus.start()");
    expect(offlineSource).toContain("prepareMasterAudioGraph(graph)");
  });

  it("declares non-zero chorus wet on the live-collab pack", () => {
    expect(livePack.soundDesign.harmony.chorusWet).toBeGreaterThan(0);
    expect(livePack.soundDesign.melody.chorusWet).toBeGreaterThan(0);
    expect(livePack.soundDesign.harmony.chorusFrequency).toBeGreaterThan(0);
    expect(livePack.soundDesign.melody.chorusDepth).toBeGreaterThan(0);
  });
});

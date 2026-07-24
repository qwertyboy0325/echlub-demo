import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import { parseReconstructionPackJson } from "../domain/packLoader";
import { createCompletedProductionSession } from "../demo/productionMutations";
import { filterMixAutomationEvents } from "../demo/mixAutomationSchedule";
import { resolveMixSubgroupTrims, resolveReedSoundDesign } from "../domain/reconstructionPack";
import {
  buildAutomationTimeline,
  buildCanonicalRenderPlan,
  buildSceneBoundaryPlans,
  offlineSchedulingStepCount,
  positionToSeconds,
} from "../offline/renderPlanning";
import { buildRenderTimeline, sha256Hex } from "../offline/renderEvidence";
import { analyzeInterleavedChannels, bufferPeakAbs } from "../offline/audioAnalysis";
import { encode24BitPcmWav, parseWavPcmLength } from "../offline/wavEncoder";
import { readFileSync as readSource } from "node:fs";

const PUBLIC_DEMO_PACK_PATH = join(process.cwd(), "public/shiki-no-uta.demo.pack.json");
const PRIVATE_PACK_PATH = join(process.cwd(), "local-reconstruction/shiki-no-uta.midi-only.pack.json");

function loadPublicDemoPack() {
  if (!existsSync(PUBLIC_DEMO_PACK_PATH)) return null;
  return parseReconstructionPackJson(readFileSync(PUBLIC_DEMO_PACK_PATH, "utf8"));
}

function loadPrivateShikiPack() {
  if (!existsSync(PRIVATE_PACK_PATH)) return null;
  return parseReconstructionPackJson(readFileSync(PRIVATE_PACK_PATH, "utf8"));
}

describe("offline render planning", () => {
  it("schedules all 104 bars for the public demo pack", () => {
    const pack = loadPublicDemoPack();
    if (!pack) return;
    const plan = buildCanonicalRenderPlan(pack);
    expect(plan.totalBars).toBe(104);
    expect(offlineSchedulingStepCount(plan)).toBe(104 * 16);
  });

  it("places scene transitions at arrangement start bars", () => {
    const pack = loadPublicDemoPack() ?? placeholderReconstructionPack;
    const session = createCompletedProductionSession(pack);
    const boundaries = buildSceneBoundaryPlans(session);
    expect(boundaries[0]?.startBar).toBe(session.arrangement.scenes[0]?.startBar);
    expect(boundaries.map((entry) => entry.startBar)).toEqual(
      session.arrangement.scenes.map((scene) => scene.startBar),
    );
  });

  it("keeps canonical mixAutomation in deterministic musical order", () => {
    const pack = loadPublicDemoPack() ?? placeholderReconstructionPack;
    const filtered = filterMixAutomationEvents(pack.mixAutomation ?? [], "canonicalPlayback");
    const timeline = buildAutomationTimeline(pack.mixAutomation, "canonicalPlayback");
    expect(timeline.map((entry) => entry.id)).toEqual(filtered.map((entry) => entry.id));
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i]!.atTicks).toBeGreaterThanOrEqual(timeline[i - 1]!.atTicks);
    }
  });

  it("includes reed and drum/bass unlock parameters in the offline graph builder", () => {
    const pack = loadPublicDemoPack() ?? placeholderReconstructionPack;
    const graphSource = readSource(join(process.cwd(), "src/audio/masterAudioGraph.ts"), "utf8");
    const reed = resolveReedSoundDesign(pack.soundDesign);
    const trims = resolveMixSubgroupTrims(pack.defaultMix);
    expect(graphSource).toContain("reedLead");
    expect(graphSource).toContain("drumTrim");
    expect(graphSource).toContain("bassTrim");
    expect(reed.attack).toBeGreaterThan(0);
    expect(trims.drumTrimDb).toBeTypeOf("number");
    expect(trims.bassTrimDb).toBeTypeOf("number");
  });

  it("includes configured tail duration in total render length", () => {
    const plan = buildCanonicalRenderPlan(placeholderReconstructionPack, { tailSeconds: 6 });
    expect(plan.totalDurationSeconds).toBeCloseTo(plan.musicalDurationSeconds + 6, 5);
  });
});

describe("offline render encoding and evidence", () => {
  it("encodes valid 24-bit PCM WAV headers and sample length", () => {
    const channels = [
      Float32Array.from({ length: 480 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000)),
      Float32Array.from({ length: 480 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 48000) * 0.5),
    ];
    const wav = encode24BitPcmWav(channels, { sampleRate: 48000, channels: 2 });
    const parsed = parseWavPcmLength(wav);
    expect(parsed.channels).toBe(2);
    expect(parsed.sampleRate).toBe(48000);
    expect(parsed.sampleCount).toBe(480);
    expect(wav[0]).toBe("R".charCodeAt(0));
    expect(bufferPeakAbs(channels)).toBeGreaterThan(0.01);
    expect(analyzeInterleavedChannels(channels, 48000).rmsDbfs).toBeGreaterThan(-40);
  });

  it("builds manifest and timeline that match the render plan", async () => {
    const pack = placeholderReconstructionPack;
    const plan = buildCanonicalRenderPlan(pack, { tailSeconds: 2 });
    const timeline = buildRenderTimeline(plan);
    expect(timeline.scenes.length).toBe(plan.sceneBoundaries.length);
    expect(timeline.automation.map((entry) => entry.id)).toEqual(plan.automationEvents.map((entry) => entry.id));
    const firstScene = timeline.scenes[0]!;
    expect(firstScene.startSeconds).toBe(0);
    expect(firstScene.endSeconds).toBeCloseTo(
      positionToSeconds(firstScene.endPosition, plan.tempoMap),
      5,
    );
    const hash = await sha256Hex(new Uint8Array([1, 2, 3]));
    expect(hash).toHaveLength(64);
  });

  it("uses rendered sample ranges for per-scene analysis boundaries", () => {
    const sampleRate = 48000;
    const channels = [
      Float32Array.from({ length: sampleRate * 2 }, (_, i) => (i < sampleRate ? 0.25 : 0.05)),
      Float32Array.from({ length: sampleRate * 2 }, () => 0),
    ];
    const whole = analyzeInterleavedChannels(channels, sampleRate);
    const firstHalf = analyzeInterleavedChannels([channels[0]!.subarray(0, sampleRate), channels[1]!.subarray(0, sampleRate)], sampleRate);
    const secondHalf = analyzeInterleavedChannels([channels[0]!.subarray(sampleRate), channels[1]!.subarray(sampleRate)], sampleRate);
    expect(bufferPeakAbs([channels[0]!.subarray(0, sampleRate)])).toBeGreaterThan(
      bufferPeakAbs([channels[0]!.subarray(sampleRate)]),
    );
    expect(firstHalf.peakDbfs).toBeGreaterThan(secondHalf.peakDbfs);
    expect(whole.peakDbfs).toBeGreaterThan(secondHalf.peakDbfs);
  });
});

describe("live playback isolation", () => {
  const audioEngineSource = readSource(join(process.cwd(), "src/audioEngine.ts"), "utf8");

  it("keeps cue-bus-only paths in AudioEngine instead of the shared master graph", () => {
    expect(audioEngineSource).toContain("cueGain");
    expect(audioEngineSource).toContain("startPrivateCue");
    expect(readSource(join(process.cwd(), "src/audio/masterAudioGraph.ts"), "utf8")).not.toContain("cueGain");
  });

  it("routes live playback through the shared master graph builder", () => {
    expect(audioEngineSource).toContain("createMasterAudioGraph");
    expect(audioEngineSource).toContain("playLayerOnGraph");
    expect(audioEngineSource).toContain("applyMixParamsToGraph");
  });
});

describe("bundle hygiene", () => {
  it("does not embed owner-local media paths in application sources", () => {
    const sources = [
      "src/main.tsx",
      "src/legacy/fourBrainMain.ts",
      "src/offline/canonicalOfflineRenderer.ts",
      "src/offline/exportController.ts",
      "src/audio/masterAudioGraph.ts",
    ];
    for (const file of sources) {
      const text = readSource(join(process.cwd(), file), "utf8");
      expect(text).not.toContain("local-reconstruction/");
      expect(text).not.toContain("reference-private/");
    }
  });
});

describe("private shiki offline scheduling", () => {
  it("matches 104-bar canonical arrangement when private pack is present", () => {
    const pack = loadPrivateShikiPack();
    if (!pack) return;
    const plan = buildCanonicalRenderPlan(pack);
    expect(plan.totalBars).toBe(104);
    expect(offlineSchedulingStepCount(plan)).toBe(1664);
  });
});

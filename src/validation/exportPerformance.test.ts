import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { placeholderReconstructionPack } from "../domain/placeholderPack";
import {
  DEFAULT_ANALYSIS_METHOD,
  analyzeRenderEvidence,
  type SceneAnalysisRange,
} from "../offline/audioAnalysis";
import {
  EXPORT_PHASE_KEYS,
  ExportPhaseTimer,
  createEmptyPhaseTimings,
  finalizePhaseTimingsTotal,
} from "../offline/exportPhaseTimings";
import {
  MASTER_EXPORT_PROFILE,
  QUICK_REVIEW_EXPORT_PROFILE,
} from "../offline/exportProfiles";
import { runExportPostProcess } from "../offline/exportPostProcessCore";
import {
  buildCanonicalRenderPlan,
} from "../offline/renderPlanning";
import {
  buildEvidenceBundleZip,
  buildRenderManifest,
  buildRenderTimeline,
  sha256Hex,
} from "../offline/renderEvidence";
import { readZipLocalCompressionMethods } from "../offline/zipUtils";
import {
  encodePcmWav,
  getWavEncodeCountForTests,
  parseWavPcmLength,
  resetWavEncodeCountForTests,
} from "../offline/wavEncoder";

describe("export phase timings", () => {
  it("tracks non-negative timings for every required phase", () => {
    const timer = new ExportPhaseTimer();
    timer.beginExport();
    timer.startPhase("planning");
    timer.recordPhase("offlineRendering", 12.5);
    const timings = timer.finalize();
    for (const key of EXPORT_PHASE_KEYS) {
      expect(timings[key]).toBeGreaterThanOrEqual(0);
    }
    expect(timings.total).toBeGreaterThan(0);
  });

  it("sums phase timings into total helper output", () => {
    const timings = finalizePhaseTimingsTotal({
      ...createEmptyPhaseTimings(),
      planning: 10,
      offlineRendering: 90,
      wavEncoding: 5,
    });
    expect(timings.total).toBe(105);
  });
});

describe("export profiles", () => {
  it("keeps master at 48 kHz / 24-bit / 6-second tail", () => {
    expect(MASTER_EXPORT_PROFILE.sampleRate).toBe(48000);
    expect(MASTER_EXPORT_PROFILE.bitDepth).toBe(24);
    expect(MASTER_EXPORT_PROFILE.tailSeconds).toBe(6);
  });

  it("keeps quick review at 32 kHz / 16-bit / 3-second tail", () => {
    expect(QUICK_REVIEW_EXPORT_PROFILE.sampleRate).toBe(32000);
    expect(QUICK_REVIEW_EXPORT_PROFILE.bitDepth).toBe(16);
    expect(QUICK_REVIEW_EXPORT_PROFILE.tailSeconds).toBe(3);
  });

  it("keeps timeline scheduling identical across quick and master plans", () => {
    const pack = placeholderReconstructionPack;
    const masterPlan = buildCanonicalRenderPlan(pack, {
      sampleRate: MASTER_EXPORT_PROFILE.sampleRate,
      tailSeconds: MASTER_EXPORT_PROFILE.tailSeconds,
    });
    const quickPlan = buildCanonicalRenderPlan(pack, {
      sampleRate: QUICK_REVIEW_EXPORT_PROFILE.sampleRate,
      tailSeconds: QUICK_REVIEW_EXPORT_PROFILE.tailSeconds,
    });
    expect(buildRenderTimeline(masterPlan)).toEqual(buildRenderTimeline(quickPlan));
    expect(quickPlan.totalBars).toBe(masterPlan.totalBars);
    expect(quickPlan.automationEvents).toEqual(masterPlan.automationEvents);
  });
});

describe("export post-process performance contract", () => {
  it("encodes WAV exactly once and reuses it for hash and ZIP", async () => {
    resetWavEncodeCountForTests();
    const pack = placeholderReconstructionPack;
    const plan = buildCanonicalRenderPlan(pack, { tailSeconds: 2, sampleRate: 48000 });
    const sampleCount = 4800;
    const channels = [
      Float32Array.from({ length: sampleCount }, (_, i) => Math.sin((2 * Math.PI * 220 * i) / 48000) * 0.2),
      Float32Array.from({ length: sampleCount }, (_, i) => Math.sin((2 * Math.PI * 220 * i) / 48000) * 0.1),
    ];
    const sceneRanges: SceneAnalysisRange[] = [{
      sceneId: "scene-a",
      startSample: 0,
      endSample: sampleCount,
    }];

    const result = await runExportPostProcess({
      channels,
      plan,
      profile: MASTER_EXPORT_PROFILE,
      renderId: "test-render",
      pack,
      sceneRanges,
      repositoryCommit: null,
      browserRuntime: "vitest",
      phaseTimingsMs: createEmptyPhaseTimings(),
      includeEvidenceBundle: true,
    });

    expect(getWavEncodeCountForTests()).toBe(1);
    expect(result.wavBytes.length).toBeGreaterThan(44);
    const hash = await sha256Hex(result.wavBytes);
    expect(result.manifest.outputWavSha256).toBe(hash);
    expect(result.bundleZip).toBeTruthy();
  });

  it("stores master.wav without deflate compression while JSON remains valid", async () => {
    const pack = placeholderReconstructionPack;
    const plan = buildCanonicalRenderPlan(pack, { tailSeconds: 1, sampleRate: 48000 });
    const channels = [
      Float32Array.from({ length: 480 }, () => 0.1),
      Float32Array.from({ length: 480 }, () => 0.05),
    ];
    const wavBytes = encodePcmWav(channels, {
      sampleRate: 48000,
      channels: 2,
      bitDepth: 24,
    });
    const manifest = buildRenderManifest({
      renderId: "zip-test",
      plan,
      packSha256: "abc",
      repositoryCommit: null,
      browserRuntime: "vitest",
      outputWavSha256: await sha256Hex(wavBytes),
      exportProfileId: "master",
      pcmBitDepth: 24,
      phaseTimingsMs: finalizePhaseTimingsTotal(createEmptyPhaseTimings()),
    });
    const timeline = buildRenderTimeline(plan);
    const analysis = analyzeRenderEvidence(channels, 48000, [{
      sceneId: plan.sceneBoundaries[0]!.sceneId,
      startSample: 0,
      endSample: 480,
    }]);
    const zip = buildEvidenceBundleZip({
      wavBytes,
      manifest,
      timeline,
      analysis,
      packSnapshot: pack,
    });
    const methods = readZipLocalCompressionMethods(zip);
    expect(methods["audio/master.wav"]).toBe(0);
    expect(methods["data/manifest.json"]).toBe(8);
    const files = unzipSync(zip);
    const manifestJson = JSON.parse(strFromU8(files["data/manifest.json"]!));
    expect(manifestJson.phaseTimingsMs).toBeTruthy();
    expect(manifestJson.exportProfileId).toBe("master");
  });

  it("accumulates whole and per-scene metrics in one analysis pass without scene PCM copies", () => {
    const sampleRate = 48000;
    const sampleCount = sampleRate;
    const channels = [
      Float32Array.from({ length: sampleCount }, (_, i) => (i < sampleRate / 2 ? 0.4 : 0.05)),
      Float32Array.from({ length: sampleCount }, () => 0),
    ];
    const ranges: SceneAnalysisRange[] = [
      { sceneId: "first", startSample: 0, endSample: sampleRate / 2 },
      { sceneId: "second", startSample: sampleRate / 2, endSample: sampleCount },
    ];
    const result = analyzeRenderEvidence(channels, sampleRate, ranges);
    expect(result.method.fftSize).toBe(DEFAULT_ANALYSIS_METHOD.fftSize);
    expect(result.method.transform).toBe("radix-2-fft");
    expect(result.perScene.first!.peakDbfs).toBeGreaterThan(result.perScene.second!.peakDbfs);
    expect(result.wholeRender.peakDbfs).toBeGreaterThan(result.perScene.second!.peakDbfs);
  });

  it("encodes quick review WAV at 32 kHz / 16-bit", () => {
    const channels = [
      Float32Array.from({ length: 3200 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 32000)),
      Float32Array.from({ length: 3200 }, () => 0),
    ];
    const wav = encodePcmWav(channels, {
      sampleRate: 32000,
      channels: 2,
      bitDepth: 16,
    });
    const parsed = parseWavPcmLength(wav);
    expect(parsed.sampleRate).toBe(32000);
    expect(parsed.bitDepth).toBe(16);
  });
});

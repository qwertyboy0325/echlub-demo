import type { ReconstructionPack } from "../domain/reconstructionPack";
import type { AnalysisMethodDocument, RenderAnalysisResult, SceneAnalysisRange } from "./audioAnalysis";
import { analyzeRenderEvidence } from "./audioAnalysis";
import type { ExportPhaseTimingsMs } from "./exportPhaseTimings";
import { finalizePhaseTimingsTotal } from "./exportPhaseTimings";
import type { ExportProfile } from "./exportProfiles";
import {
  buildEvidenceBundleZip,
  buildRenderManifest,
  buildRenderTimeline,
  sha256Hex,
  sha256HexFromJson,
  type RenderManifest,
  type RenderTimeline,
} from "./renderEvidence";
import type { CanonicalRenderPlan } from "./renderPlanning";
import { encodePcmWav } from "./wavEncoder";

export interface ExportPostProcessInput {
  channels: Float32Array[];
  plan: CanonicalRenderPlan;
  profile: ExportProfile;
  renderId: string;
  pack: ReconstructionPack;
  sceneRanges: SceneAnalysisRange[];
  repositoryCommit: string | null;
  browserRuntime: string;
  phaseTimingsMs: ExportPhaseTimingsMs;
  includeEvidenceBundle: boolean;
}

export interface ExportPostProcessResult {
  wavBytes: Uint8Array;
  manifest: RenderManifest;
  timeline: RenderTimeline;
  analysis: RenderAnalysisResult & { method: AnalysisMethodDocument };
  bundleZip: Uint8Array | null;
  packSha256: string;
  phaseTimingsMs: ExportPhaseTimingsMs;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Export post-process cancelled", "AbortError");
}

export async function runExportPostProcess(
  input: ExportPostProcessInput,
  signal?: AbortSignal,
): Promise<ExportPostProcessResult> {
  const timings = { ...input.phaseTimingsMs };

  assertNotAborted(signal);
  const encodeStart = performance.now();
  const wavBytes = encodePcmWav(input.channels, {
    sampleRate: input.plan.sampleRate,
    channels: input.plan.channels,
    bitDepth: input.profile.bitDepth,
  });
  timings.wavEncoding += performance.now() - encodeStart;

  assertNotAborted(signal);
  const analysisStart = performance.now();
  const analysisResult = analyzeRenderEvidence(
    input.channels,
    input.plan.sampleRate,
    input.sceneRanges,
  );
  timings.audioAnalysis += performance.now() - analysisStart;

  assertNotAborted(signal);
  const hashStart = performance.now();
  const [outputWavSha256, packSha256] = await Promise.all([
    sha256Hex(wavBytes),
    sha256HexFromJson(input.pack),
  ]);
  timings.hashing += performance.now() - hashStart;

  const timeline = buildRenderTimeline(input.plan);
  const analysis = {
    ...analysisResult,
    method: analysisResult.method,
  };

  let bundleZip: Uint8Array | null = null;
  let manifest: RenderManifest;
  if (input.includeEvidenceBundle) {
    assertNotAborted(signal);
    const zipStart = performance.now();
    const provisionalTimings = finalizePhaseTimingsTotal(timings);
    const provisionalManifest = buildRenderManifest({
      renderId: input.renderId,
      plan: input.plan,
      packSha256,
      repositoryCommit: input.repositoryCommit,
      browserRuntime: input.browserRuntime,
      outputWavSha256,
      exportProfileId: input.profile.id,
      phaseTimingsMs: provisionalTimings,
      pcmBitDepth: input.profile.bitDepth,
    });
    bundleZip = buildEvidenceBundleZip({
      wavBytes,
      manifest: provisionalManifest,
      timeline,
      analysis,
      packSnapshot: structuredClone(input.pack),
    });
    timings.zipPackaging += performance.now() - zipStart;
    manifest = buildRenderManifest({
      renderId: input.renderId,
      plan: input.plan,
      packSha256,
      repositoryCommit: input.repositoryCommit,
      browserRuntime: input.browserRuntime,
      outputWavSha256,
      exportProfileId: input.profile.id,
      phaseTimingsMs: finalizePhaseTimingsTotal(timings),
      pcmBitDepth: input.profile.bitDepth,
    });
  } else {
    manifest = buildRenderManifest({
      renderId: input.renderId,
      plan: input.plan,
      packSha256,
      repositoryCommit: input.repositoryCommit,
      browserRuntime: input.browserRuntime,
      outputWavSha256,
      exportProfileId: input.profile.id,
      phaseTimingsMs: finalizePhaseTimingsTotal(timings),
      pcmBitDepth: input.profile.bitDepth,
    });
  }

  return {
    wavBytes,
    manifest,
    timeline,
    analysis,
    bundleZip,
    packSha256,
    phaseTimingsMs: finalizePhaseTimingsTotal(timings),
  };
}

export async function runWavEncodeOnly(
  channels: Float32Array[],
  plan: CanonicalRenderPlan,
  profile: ExportProfile,
  phaseTimingsMs: ExportPhaseTimingsMs,
  signal?: AbortSignal,
): Promise<{ wavBytes: Uint8Array; phaseTimingsMs: ExportPhaseTimingsMs }> {
  const timings = { ...phaseTimingsMs };
  assertNotAborted(signal);
  const encodeStart = performance.now();
  const wavBytes = encodePcmWav(channels, {
    sampleRate: plan.sampleRate,
    channels: plan.channels,
    bitDepth: profile.bitDepth,
  });
  timings.wavEncoding += performance.now() - encodeStart;
  return { wavBytes, phaseTimingsMs: timings };
}

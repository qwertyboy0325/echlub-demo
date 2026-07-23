import * as Tone from "tone";
import { Offline } from "tone";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import type { ProductionSession } from "../domain/sessionTypes";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import { createMasterAudioGraph } from "../audio/masterAudioGraph";
import { bufferPeakAbs } from "./audioAnalysis";
import { scheduleCanonicalOfflinePlayback } from "./canonicalPlaybackScheduler";
import { ExportPhaseTimer, type ExportPhaseTimingsMs } from "./exportPhaseTimings";
import {
  MASTER_EXPORT_PROFILE,
  type ExportProfile,
} from "./exportProfiles";
import { postProcessEvidenceExport, postProcessWavOnly } from "./exportPostProcessClient";
import {
  buildCanonicalRenderPlan,
  type CanonicalRenderPlan,
  DEFAULT_RENDER_CHANNELS,
  DEFAULT_RENDER_SAMPLE_RATE,
  DEFAULT_RENDER_TAIL_SECONDS,
} from "./renderPlanning";
import {
  browserRuntimeIdentity,
  buildSceneSampleRanges,
  type RenderAnalysisDocument,
  type RenderManifest,
  type RenderTimeline,
} from "./renderEvidence";
import { audioBufferToChannelArrays } from "./wavEncoder";

export type OfflineExportMode = "wav" | "evidence";

export interface CanonicalOfflineRenderOptions {
  exportMode?: OfflineExportMode;
  exportProfile?: ExportProfile;
  session?: ProductionSession;
  materialBank?: SessionMaterialBank;
  tailSeconds?: number;
  sampleRate?: number;
  channels?: number;
  repositoryCommit?: string | null;
  onProgress?: (state: OfflineRenderProgress) => void;
  signal?: AbortSignal;
  phaseTimer?: ExportPhaseTimer;
}

export type OfflineRenderProgress = {
  phase:
    | "planning"
    | "graphInitialization"
    | "offlineRendering"
    | "wavEncoding"
    | "audioAnalysis"
    | "hashing"
    | "zipPackaging"
    | "downloadPreparation"
    | "complete";
  elapsedMs: number;
  phaseElapsedMs: number;
  offlineRenderNotCancellable?: boolean;
};

export interface CanonicalOfflineRenderResult {
  renderId: string;
  plan: CanonicalRenderPlan;
  audioBuffer: AudioBuffer;
  wavBytes: Uint8Array;
  manifest: RenderManifest;
  timeline: RenderTimeline;
  analysis: RenderAnalysisDocument;
  bundleZip: Uint8Array;
  packSha256: string;
  phaseTimingsMs: ExportPhaseTimingsMs;
}

function createRenderId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `render-${Date.now()}`;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Offline render cancelled", "AbortError");
}

const MIN_RENDER_PEAK = 1e-5;

function assertValidRenderOutput(
  plan: CanonicalRenderPlan,
  audioBuffer: AudioBuffer,
  channels: Float32Array[],
): void {
  const expectedSamples = Math.round(plan.totalDurationSeconds * plan.sampleRate);
  if (!Number.isFinite(plan.totalDurationSeconds) || plan.totalDurationSeconds <= 0) {
    throw new Error(`Invalid render duration: ${plan.totalDurationSeconds}`);
  }
  if (audioBuffer.length === 0) {
    throw new Error("Offline render produced an empty audio buffer.");
  }
  if (Math.abs(audioBuffer.length - expectedSamples) > plan.sampleRate) {
    throw new Error(
      `Offline render length mismatch: expected ~${expectedSamples} samples, got ${audioBuffer.length}.`,
    );
  }
  if (bufferPeakAbs(channels) < MIN_RENDER_PEAK) {
    throw new Error("Offline render produced silence; transport scheduling may have failed.");
  }
}

function emitProgress(
  timer: ExportPhaseTimer,
  options: CanonicalOfflineRenderOptions,
  phase: OfflineRenderProgress["phase"],
  offlineRenderNotCancellable = false,
): void {
  options.onProgress?.({
    phase,
    elapsedMs: timer.getElapsedMs(),
    phaseElapsedMs: timer.getPhaseElapsedMs(),
    offlineRenderNotCancellable,
  });
}

function resolveProfile(options: CanonicalOfflineRenderOptions): ExportProfile {
  if (options.exportProfile) return options.exportProfile;
  return {
    ...MASTER_EXPORT_PROFILE,
    tailSeconds: options.tailSeconds ?? MASTER_EXPORT_PROFILE.tailSeconds,
    sampleRate: options.sampleRate ?? MASTER_EXPORT_PROFILE.sampleRate,
    channels: options.channels ?? MASTER_EXPORT_PROFILE.channels,
  };
}

interface RenderedChannels {
  plan: CanonicalRenderPlan;
  audioBuffer: AudioBuffer;
  channels: Float32Array[];
  phaseTimingsMs: ExportPhaseTimingsMs;
}

async function renderCanonicalChannels(
  pack: ReconstructionPack,
  options: CanonicalOfflineRenderOptions,
): Promise<RenderedChannels> {
  const timer = options.phaseTimer ?? new ExportPhaseTimer();
  if (!options.phaseTimer) timer.beginExport();

  const profile = resolveProfile(options);

  assertNotAborted(options.signal);
  timer.startPhase("planning");
  emitProgress(timer, options, "planning");

  const plan = buildCanonicalRenderPlan(pack, {
    tailSeconds: profile.tailSeconds,
    sampleRate: profile.sampleRate,
    channels: profile.channels,
    session: options.session,
    materialBank: options.materialBank,
  });

  assertNotAborted(options.signal);
  timer.endActivePhase();

  const graphInitMs = { value: 0 };
  const offlineStartedAt = performance.now();
  emitProgress(timer, options, "offlineRendering", true);

  const toneBuffer = await Offline(async (offlineContext) => {
    const graphInitStart = performance.now();
    const graph = createMasterAudioGraph({
      soundDesign: pack.soundDesign,
      baselineMix: plan.session.mix,
      destination: offlineContext.destination,
    });
    await graph.reverb.ready;
    graphInitMs.value = performance.now() - graphInitStart;

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    scheduleCanonicalOfflinePlayback({
      transport,
      graph,
      materialBank: plan.materialBank,
      soundDesign: pack.soundDesign,
      plan,
    });
    transport.start(0);
  }, plan.totalDurationSeconds, plan.channels, plan.sampleRate);

  const offlineTotalMs = performance.now() - offlineStartedAt;
  timer.recordPhase("graphInitialization", graphInitMs.value);
  timer.recordPhase("offlineRendering", Math.max(0, offlineTotalMs - graphInitMs.value));

  assertNotAborted(options.signal);
  const audioBuffer = toneBuffer.get() as AudioBuffer;
  const channels = audioBufferToChannelArrays(audioBuffer);
  assertValidRenderOutput(plan, audioBuffer, channels);

  return {
    plan,
    audioBuffer,
    channels,
    phaseTimingsMs: timer.peek(),
  };
}

export async function renderCanonicalWavOnly(
  pack: ReconstructionPack,
  options: CanonicalOfflineRenderOptions = {},
): Promise<{ wavBytes: Uint8Array; plan: CanonicalRenderPlan; phaseTimingsMs: ExportPhaseTimingsMs }> {
  const timer = options.phaseTimer ?? new ExportPhaseTimer();
  const rendered = await renderCanonicalChannels(pack, { ...options, phaseTimer: timer });
  const profile = resolveProfile(options);

  timer.startPhase("wavEncoding");
  emitProgress(timer, options, "wavEncoding");
  const encoded = await postProcessWavOnly(
    rendered.channels,
    rendered.plan,
    profile,
    rendered.phaseTimingsMs,
    options.signal,
  );
  timer.recordPhase("wavEncoding", encoded.phaseTimingsMs.wavEncoding);

  emitProgress(timer, options, "complete");
  return {
    wavBytes: encoded.wavBytes,
    plan: rendered.plan,
    phaseTimingsMs: timer.finalize(),
  };
}

export async function renderCanonicalOfflineMaster(
  pack: ReconstructionPack,
  options: CanonicalOfflineRenderOptions = {},
): Promise<CanonicalOfflineRenderResult> {
  const timer = options.phaseTimer ?? new ExportPhaseTimer();
  const rendered = await renderCanonicalChannels(pack, { ...options, phaseTimer: timer });
  const profile = resolveProfile(options);
  const renderId = createRenderId();
  const sceneRanges = buildSceneSampleRanges(rendered.plan, rendered.plan.sampleRate);

  const reportPostPhase = (phase: OfflineRenderProgress["phase"]) => emitProgress(timer, options, phase);
  reportPostPhase("wavEncoding");

  const postProcessed = await postProcessEvidenceExport({
    channels: rendered.channels,
    plan: rendered.plan,
    profile,
    renderId,
    pack,
    sceneRanges,
    repositoryCommit: options.repositoryCommit ?? null,
    browserRuntime: browserRuntimeIdentity(),
    phaseTimingsMs: rendered.phaseTimingsMs,
    includeEvidenceBundle: true,
  }, options.signal);

  timer.recordPhase("wavEncoding", postProcessed.phaseTimingsMs.wavEncoding);
  timer.recordPhase("audioAnalysis", postProcessed.phaseTimingsMs.audioAnalysis);
  timer.recordPhase("hashing", postProcessed.phaseTimingsMs.hashing);
  timer.recordPhase("zipPackaging", postProcessed.phaseTimingsMs.zipPackaging);

  emitProgress(timer, options, "complete");

  return {
    renderId,
    plan: rendered.plan,
    audioBuffer: rendered.audioBuffer,
    wavBytes: postProcessed.wavBytes,
    manifest: postProcessed.manifest,
    timeline: postProcessed.timeline,
    analysis: postProcessed.analysis,
    bundleZip: postProcessed.bundleZip!,
    packSha256: postProcessed.packSha256,
    phaseTimingsMs: timer.finalize(),
  };
}

export {
  DEFAULT_RENDER_CHANNELS,
  DEFAULT_RENDER_SAMPLE_RATE,
  DEFAULT_RENDER_TAIL_SECONDS,
};

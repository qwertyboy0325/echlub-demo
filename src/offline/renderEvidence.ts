import { zipSync } from "fflate";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import type { AnalysisMethodDocument, AudioLevelMetrics } from "./audioAnalysis";
import type { ExportPhaseTimingsMs } from "./exportPhaseTimings";
import type { ExportProfileId } from "./exportProfiles";
import {
  activeMaterialIdsForScene,
  type CanonicalRenderPlan,
  positionToSeconds,
  RENDER_EVIDENCE_FORMAT_VERSION,
  resolveEffectiveSceneMix,
} from "./renderPlanning";

export interface RenderManifest {
  formatVersion: string;
  renderId: string;
  createdAtUtc: string;
  packId: string;
  packSha256: string;
  repositoryCommit: string | null;
  act: "canonicalPlayback";
  exportProfileId: ExportProfileId;
  sampleRate: number;
  channelCount: number;
  pcmBitDepth: 16 | 24;
  totalBars: number;
  musicalDurationSeconds: number;
  tailDurationSeconds: number;
  browserRuntime: string;
  outputWavSha256: string;
  phaseTimingsMs: ExportPhaseTimingsMs;
}

export interface TimelineSceneEntry {
  sceneId: string;
  startPosition: string;
  endPosition: string;
  startSeconds: number;
  endSeconds: number;
  effectiveMix: ReturnType<typeof resolveEffectiveSceneMix>;
  activeMaterialIds: string[];
}

export interface TimelineAutomationEntry {
  id: string;
  at: string;
  resolvedSeconds: number;
  rampSeconds: number;
  patch: CanonicalRenderPlan["automationEvents"][number]["patch"];
}

export interface RenderTimeline {
  scenes: TimelineSceneEntry[];
  automation: TimelineAutomationEntry[];
}

export interface RenderAnalysisDocument {
  wholeRender: AudioLevelMetrics;
  perScene: Record<string, AudioLevelMetrics>;
  method: AnalysisMethodDocument;
}

export function buildRenderManifest(input: {
  renderId: string;
  plan: CanonicalRenderPlan;
  packSha256: string;
  repositoryCommit: string | null;
  browserRuntime: string;
  outputWavSha256: string;
  exportProfileId: ExportProfileId;
  pcmBitDepth: 16 | 24;
  phaseTimingsMs: ExportPhaseTimingsMs;
}): RenderManifest {
  return {
    formatVersion: RENDER_EVIDENCE_FORMAT_VERSION,
    renderId: input.renderId,
    createdAtUtc: new Date().toISOString(),
    packId: input.plan.pack.metadata.id,
    packSha256: input.packSha256,
    repositoryCommit: input.repositoryCommit,
    act: "canonicalPlayback",
    exportProfileId: input.exportProfileId,
    sampleRate: input.plan.sampleRate,
    channelCount: input.plan.channels,
    pcmBitDepth: input.pcmBitDepth,
    totalBars: input.plan.totalBars,
    musicalDurationSeconds: input.plan.musicalDurationSeconds,
    tailDurationSeconds: input.plan.tailSeconds,
    browserRuntime: input.browserRuntime,
    outputWavSha256: input.outputWavSha256,
    phaseTimingsMs: input.phaseTimingsMs,
  };
}

export function buildRenderTimeline(plan: CanonicalRenderPlan): RenderTimeline {
  return {
    scenes: plan.sceneBoundaries.map((boundary) => ({
      sceneId: boundary.sceneId,
      startPosition: boundary.startPosition,
      endPosition: boundary.endPosition,
      startSeconds: positionToSeconds(boundary.startPosition, plan.tempoMap),
      endSeconds: positionToSeconds(boundary.endPosition, plan.tempoMap),
      effectiveMix: resolveEffectiveSceneMix(boundary.scene, plan.pack.soundDesign),
      activeMaterialIds: activeMaterialIdsForScene(boundary.scene),
    })),
    automation: plan.automationEvents.map((event) => ({
      id: event.id,
      at: event.at,
      resolvedSeconds: positionToSeconds(event.at, plan.tempoMap),
      rampSeconds: event.rampSeconds,
      patch: event.patch,
    })),
  };
}

export function buildSceneSampleRanges(
  plan: CanonicalRenderPlan,
  sampleRate: number,
): { sceneId: string; startSample: number; endSample: number }[] {
  return plan.sceneBoundaries.map((boundary) => ({
    sceneId: boundary.sceneId,
    startSample: Math.floor(positionToSeconds(boundary.startPosition, plan.tempoMap) * sampleRate),
    endSample: Math.floor(positionToSeconds(boundary.endPosition, plan.tempoMap) * sampleRate),
  }));
}

export function buildEvidenceBundleZip(input: {
  wavBytes: Uint8Array;
  manifest: RenderManifest;
  timeline: RenderTimeline;
  analysis: RenderAnalysisDocument;
  packSnapshot: ReconstructionPack;
}): Uint8Array {
  const manifestBytes = encodeJson(input.manifest);
  const timelineBytes = encodeJson(input.timeline);
  const analysisBytes = encodeJson(input.analysis);
  const packBytes = encodeJson(input.packSnapshot);
  return zipSync({
    "audio/master.wav": [input.wavBytes, { level: 0 }],
    "data/manifest.json": [manifestBytes, { level: 6 }],
    "data/timeline.json": [timelineBytes, { level: 6 }],
    "data/analysis.json": [analysisBytes, { level: 6 }],
    "data/pack.snapshot.json": [packBytes, { level: 6 }],
  });
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : data;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256HexFromJson(value: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(value));
}

export function browserRuntimeIdentity(): string {
  const nav = globalThis.navigator;
  if (!nav) return "unknown-runtime";
  return [
    nav.userAgent ?? "unknown-agent",
    nav.language ?? "unknown-language",
    `cores:${nav.hardwareConcurrency ?? "?"}`,
  ].join(" | ");
}

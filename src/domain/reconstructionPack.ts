/**
 * JSON-safe reconstruction-pack boundary.
 *
 * Owner-provided packs and reference media stay in gitignored local folders.
 * This module only defines the portable data contract and validation rules.
 */
import type { LayerId, MixParams, PatternDraft, PerformanceScriptEvent, SceneDefinition } from "../types";
import type {
  Arrangement,
  Participant,
  PerformanceViewPreset,
  ProductionAction,
  Workspace,
  TrackDefinition,
  LiveStructuralOperation,
} from "./sessionTypes";

export const RECONSTRUCTION_PACK_SCHEMA_VERSION = 3 as const;

export interface ReconstructionPackMetadata {
  id: string;
  title: string;
  bpm: number;
  /** Marks prototype assumptions; not final DAW semantics. */
  prototypeOnly: true;
  source: "placeholder" | "local-private" | "public-demo";
}

export interface ReconstructionPackProvenance {
  /** Human-readable authoring origin, without embedding local file paths. */
  createdBy: string;
  sourceDescription: string;
  rightsBasis: "original-placeholder" | "owner-provided-private-reference" | "owner-authorized-public-cover";
  /** Opaque owner-local identifiers only; never paths or bundled media. */
  referenceAssetIds: string[];
}

export interface ReconstructionPackConfidence {
  /** 0..1 estimate for the pack as a whole. */
  overall: number;
  rhythm: number;
  harmony: number;
  melody: number;
  arrangement: number;
  notes: string[];
}

export type ScenePlacementMap = Record<string, Partial<Record<LayerId, string>>>;
export type SceneLayerStackMap = Record<string, Partial<Record<LayerId, string[]>>>;

export interface SynthEnvelopePreset {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface SoundDesignPreset {
  master: {
    filterRolloff: -12 | -24 | -48 | -96;
    delayTime: string;
    delayFeedback: number;
    reverbDecay: number;
    reverbPreDelay: number;
    compressorThreshold: number;
    compressorRatio: number;
  };
  drums: {
    kickPitchDecay: number;
    kickOctaves: number;
    kickDecay: number;
    snareNoise: "white" | "pink" | "brown";
    snareDecay: number;
    hatDecay: number;
    hatResonance: number;
    drive: number;
    filterFrequency: number;
  };
  bass: {
    oscillator: "sine" | "triangle" | "fatsawtooth";
    volume: number;
    filterQ: number;
    filterBaseFrequency: number;
    filterOctaves: number;
    drive: number;
    envelope: SynthEnvelopePreset;
  };
  harmony: {
    generator: "synth" | "fm";
    oscillator: "sine" | "triangle" | "fatsine";
    volume: number;
    filterFrequency: number;
    chorusFrequency: number;
    chorusDepth: number;
    chorusWet: number;
    envelope: SynthEnvelopePreset;
  };
  melody: {
    generator: "synth" | "fm";
    oscillator: "sine" | "triangle" | "fatsine";
    volume: number;
    filterFrequency: number;
    chorusFrequency: number;
    chorusDepth: number;
    chorusWet: number;
    envelope: SynthEnvelopePreset;
  };
  texture: {
    noise: "white" | "pink" | "brown";
    volume: number;
    filterFrequency: number;
    envelope: SynthEnvelopePreset;
  };
}

export const DEFAULT_SOUND_DESIGN: SoundDesignPreset = {
  master: { filterRolloff: -24, delayTime: "8n.", delayFeedback: 0.26, reverbDecay: 3.2, reverbPreDelay: 0.03, compressorThreshold: -14, compressorRatio: 2.5 },
  drums: { kickPitchDecay: 0.03, kickOctaves: 5, kickDecay: 0.32, snareNoise: "pink", snareDecay: 0.12, hatDecay: 0.045, hatResonance: 4200, drive: 0.04, filterFrequency: 9200 },
  bass: { oscillator: "fatsawtooth", volume: -11, filterQ: 2, filterBaseFrequency: 100, filterOctaves: 2.3, drive: 0.03, envelope: { attack: 0.01, decay: 0.18, sustain: 0.32, release: 0.2 } },
  harmony: { generator: "synth", oscillator: "triangle", volume: -16, filterFrequency: 5200, chorusFrequency: 0.35, chorusDepth: 0.2, chorusWet: 0.12, envelope: { attack: 0.08, decay: 0.25, sustain: 0.45, release: 1.2 } },
  melody: { generator: "synth", oscillator: "fatsine", volume: -13, filterFrequency: 6200, chorusFrequency: 0.5, chorusDepth: 0.16, chorusWet: 0.1, envelope: { attack: 0.02, decay: 0.16, sustain: 0.25, release: 0.5 } },
  texture: { noise: "brown", volume: -31, filterFrequency: 2800, envelope: { attack: 0.2, decay: 0.8, sustain: 0.1, release: 1.8 } },
};

export interface ReconstructionPack {
  schemaVersion: typeof RECONSTRUCTION_PACK_SCHEMA_VERSION;
  metadata: ReconstructionPackMetadata;
  provenance: ReconstructionPackProvenance;
  confidence: ReconstructionPackConfidence;
  tempoMap: { bar: number; bpm: number }[];
  timeSignatures: { bar: number; numerator: number; denominator: number }[];
  sections: { id: string; label: string; startBar: number; bars: number }[];
  participants: Participant[];
  workspaces: Workspace[];
  tracks: TrackDefinition[];
  drafts: PatternDraft[];
  scenes: SceneDefinition[];
  /** Draft placement is pack-owned authoring input, not static runtime data. */
  scenePlacements: ScenePlacementMap;
  sceneLayerStacks?: SceneLayerStackMap;
  defaultMix: MixParams;
  soundDesign: SoundDesignPreset;
  arrangement: Arrangement;
  productionChoreography: ProductionAction[];
  livePerformanceChoreography: PerformanceScriptEvent[];
  liveStructuralOperations: LiveStructuralOperation[];
  performanceViews: PerformanceViewPreset[];
}

/** Gitignored locations for owner-provided reconstruction data. */
export const PRIVATE_PACK_PATHS = ["reference-private/", "local-reconstruction/"] as const;

export interface PackValidationIssue {
  path: string;
  message: string;
}

export class ReconstructionPackValidationError extends Error {
  readonly issues: PackValidationIssue[];

  constructor(issues: PackValidationIssue[]) {
    super(`Invalid reconstruction pack: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`);
    this.name = "ReconstructionPackValidationError";
    this.issues = issues;
  }
}

const LAYERS = ["drums", "bass", "harmony", "melody", "texture"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findNonJsonValue(value: unknown, path = "$", seen = new Set<object>()): string | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? undefined : path;
  if (typeof value !== "object") return path;
  if (seen.has(value as object)) return path;
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const invalid = findNonJsonValue(value[i], `${path}[${i}]`, seen);
      if (invalid) return invalid;
    }
  } else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return path;
    for (const [key, child] of Object.entries(value)) {
      const invalid = findNonJsonValue(child, `${path}.${key}`, seen);
      if (invalid) return invalid;
    }
  }
  seen.delete(value as object);
  return undefined;
}

function uniqueIds(
  issues: PackValidationIssue[],
  path: string,
  values: unknown,
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(values)) {
    issues.push({ path, message: "must be an array" });
    return ids;
  }
  values.forEach((value, index) => {
    if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
      issues.push({ path: `${path}[${index}].id`, message: "must be a non-empty string" });
      return;
    }
    if (ids.has(value.id)) issues.push({ path: `${path}[${index}].id`, message: `duplicate id ${value.id}` });
    ids.add(value.id);
  });
  return ids;
}

function checkConfidence(issues: PackValidationIssue[], value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    issues.push({ path, message: "must be a finite number from 0 to 1" });
  }
}

function checkFiniteNumber(
  issues: PackValidationIssue[],
  value: unknown,
  path: string,
  options: { min?: number; max?: number; maxExclusive?: boolean } = {},
): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ path, message: "must be a finite number" });
    return;
  }
  if (options.min !== undefined && value < options.min) issues.push({ path, message: `must be at least ${options.min}` });
  if (options.max !== undefined && (options.maxExclusive ? value >= options.max : value > options.max)) {
    issues.push({ path, message: options.maxExclusive ? `must be less than ${options.max}` : `must be at most ${options.max}` });
  }
}

function checkEnum(issues: PackValidationIssue[], value: unknown, path: string, allowed: readonly unknown[]): void {
  if (!allowed.includes(value)) issues.push({ path, message: `must be one of ${allowed.join(", ")}` });
}

function checkEnvelope(issues: PackValidationIssue[], value: unknown, path: string): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  checkFiniteNumber(issues, value.attack, `${path}.attack`, { min: 0 });
  checkFiniteNumber(issues, value.decay, `${path}.decay`, { min: 0 });
  checkFiniteNumber(issues, value.sustain, `${path}.sustain`, { min: 0, max: 1 });
  checkFiniteNumber(issues, value.release, `${path}.release`, { min: 0 });
}

function checkSoundDesign(issues: PackValidationIssue[], value: unknown): void {
  if (!isRecord(value)) {
    issues.push({ path: "soundDesign", message: "must be an object" });
    return;
  }

  const master = value.master;
  if (!isRecord(master)) issues.push({ path: "soundDesign.master", message: "must be an object" });
  else {
    checkEnum(issues, master.filterRolloff, "soundDesign.master.filterRolloff", [-12, -24, -48, -96]);
    if (typeof master.delayTime !== "string" || !master.delayTime.trim()) issues.push({ path: "soundDesign.master.delayTime", message: "must be a non-empty string" });
    checkFiniteNumber(issues, master.delayFeedback, "soundDesign.master.delayFeedback", { min: 0, max: 1, maxExclusive: true });
    checkFiniteNumber(issues, master.reverbDecay, "soundDesign.master.reverbDecay", { min: Number.EPSILON });
    checkFiniteNumber(issues, master.reverbPreDelay, "soundDesign.master.reverbPreDelay", { min: 0 });
    checkFiniteNumber(issues, master.compressorThreshold, "soundDesign.master.compressorThreshold");
    checkFiniteNumber(issues, master.compressorRatio, "soundDesign.master.compressorRatio", { min: 1 });
  }

  const drums = value.drums;
  if (!isRecord(drums)) issues.push({ path: "soundDesign.drums", message: "must be an object" });
  else {
    checkFiniteNumber(issues, drums.kickPitchDecay, "soundDesign.drums.kickPitchDecay", { min: 0 });
    checkFiniteNumber(issues, drums.kickOctaves, "soundDesign.drums.kickOctaves", { min: 0 });
    checkFiniteNumber(issues, drums.kickDecay, "soundDesign.drums.kickDecay", { min: 0 });
    checkEnum(issues, drums.snareNoise, "soundDesign.drums.snareNoise", ["white", "pink", "brown"]);
    checkFiniteNumber(issues, drums.snareDecay, "soundDesign.drums.snareDecay", { min: 0 });
    checkFiniteNumber(issues, drums.hatDecay, "soundDesign.drums.hatDecay", { min: 0 });
    checkFiniteNumber(issues, drums.hatResonance, "soundDesign.drums.hatResonance", { min: 0 });
    checkFiniteNumber(issues, drums.drive, "soundDesign.drums.drive", { min: 0, max: 1 });
    checkFiniteNumber(issues, drums.filterFrequency, "soundDesign.drums.filterFrequency", { min: Number.EPSILON });
  }

  const bass = value.bass;
  if (!isRecord(bass)) issues.push({ path: "soundDesign.bass", message: "must be an object" });
  else {
    checkEnum(issues, bass.oscillator, "soundDesign.bass.oscillator", ["sine", "triangle", "fatsawtooth"]);
    checkFiniteNumber(issues, bass.volume, "soundDesign.bass.volume");
    checkFiniteNumber(issues, bass.filterQ, "soundDesign.bass.filterQ", { min: 0 });
    checkFiniteNumber(issues, bass.filterBaseFrequency, "soundDesign.bass.filterBaseFrequency", { min: Number.EPSILON });
    checkFiniteNumber(issues, bass.filterOctaves, "soundDesign.bass.filterOctaves", { min: 0 });
    checkFiniteNumber(issues, bass.drive, "soundDesign.bass.drive", { min: 0, max: 1 });
    checkEnvelope(issues, bass.envelope, "soundDesign.bass.envelope");
  }

  for (const section of ["harmony", "melody"] as const) {
    const synth = value[section];
    if (!isRecord(synth)) issues.push({ path: `soundDesign.${section}`, message: "must be an object" });
    else {
      checkEnum(issues, synth.generator, `soundDesign.${section}.generator`, ["synth", "fm"]);
      checkEnum(issues, synth.oscillator, `soundDesign.${section}.oscillator`, ["sine", "triangle", "fatsine"]);
      checkFiniteNumber(issues, synth.volume, `soundDesign.${section}.volume`);
      checkFiniteNumber(issues, synth.filterFrequency, `soundDesign.${section}.filterFrequency`, { min: Number.EPSILON });
      checkFiniteNumber(issues, synth.chorusFrequency, `soundDesign.${section}.chorusFrequency`, { min: 0 });
      checkFiniteNumber(issues, synth.chorusDepth, `soundDesign.${section}.chorusDepth`, { min: 0, max: 1 });
      checkFiniteNumber(issues, synth.chorusWet, `soundDesign.${section}.chorusWet`, { min: 0, max: 1 });
      checkEnvelope(issues, synth.envelope, `soundDesign.${section}.envelope`);
    }
  }

  const texture = value.texture;
  if (!isRecord(texture)) issues.push({ path: "soundDesign.texture", message: "must be an object" });
  else {
    checkEnum(issues, texture.noise, "soundDesign.texture.noise", ["white", "pink", "brown"]);
    checkFiniteNumber(issues, texture.volume, "soundDesign.texture.volume");
    checkFiniteNumber(issues, texture.filterFrequency, "soundDesign.texture.filterFrequency", { min: Number.EPSILON });
    checkEnvelope(issues, texture.envelope, "soundDesign.texture.envelope");
  }
}

/** Strict structural and cross-reference validation for untrusted JSON input. */
export function inspectReconstructionPack(input: unknown): PackValidationIssue[] {
  const issues: PackValidationIssue[] = [];
  const invalidJsonPath = findNonJsonValue(input);
  if (invalidJsonPath) issues.push({ path: invalidJsonPath, message: "contains a non-JSON-safe value or cycle" });
  if (!isRecord(input)) return [...issues, { path: "$", message: "must be an object" }];

  if (input.schemaVersion !== RECONSTRUCTION_PACK_SCHEMA_VERSION) {
    issues.push({ path: "schemaVersion", message: `must equal ${RECONSTRUCTION_PACK_SCHEMA_VERSION}` });
  }
  const metadata = input.metadata;
  if (!isRecord(metadata)) {
    issues.push({ path: "metadata", message: "must be an object" });
  } else {
    if (typeof metadata.id !== "string" || !metadata.id.trim()) issues.push({ path: "metadata.id", message: "must be a non-empty string" });
    if (typeof metadata.title !== "string" || !metadata.title.trim()) issues.push({ path: "metadata.title", message: "must be a non-empty string" });
    if (typeof metadata.bpm !== "number" || !Number.isFinite(metadata.bpm) || metadata.bpm <= 0) issues.push({ path: "metadata.bpm", message: "must be positive" });
    if (metadata.prototypeOnly !== true) issues.push({ path: "metadata.prototypeOnly", message: "must be true" });
    if (metadata.source !== "placeholder" && metadata.source !== "local-private" && metadata.source !== "public-demo") issues.push({ path: "metadata.source", message: "must be placeholder, local-private or public-demo" });
  }

  const provenance = input.provenance;
  if (!isRecord(provenance)) {
    issues.push({ path: "provenance", message: "must be an object" });
  } else {
    if (typeof provenance.createdBy !== "string" || !provenance.createdBy.trim()) issues.push({ path: "provenance.createdBy", message: "must be a non-empty string" });
    if (typeof provenance.sourceDescription !== "string" || !provenance.sourceDescription.trim()) issues.push({ path: "provenance.sourceDescription", message: "must be a non-empty string" });
    if (provenance.rightsBasis !== "original-placeholder" && provenance.rightsBasis !== "owner-provided-private-reference" && provenance.rightsBasis !== "owner-authorized-public-cover") issues.push({ path: "provenance.rightsBasis", message: "has unsupported value" });
    if (!Array.isArray(provenance.referenceAssetIds) || provenance.referenceAssetIds.some((id) => typeof id !== "string")) issues.push({ path: "provenance.referenceAssetIds", message: "must be a string array" });
    if (metadata && isRecord(metadata) && metadata.source === "local-private" && provenance.rightsBasis !== "owner-provided-private-reference") {
      issues.push({ path: "provenance.rightsBasis", message: "local-private packs require owner-provided-private-reference" });
    }
    if (metadata && isRecord(metadata) && metadata.source === "public-demo" && provenance.rightsBasis !== "owner-authorized-public-cover") {
      issues.push({ path: "provenance.rightsBasis", message: "public-demo packs require owner-authorized-public-cover" });
    }
  }

  const confidence = input.confidence;
  if (!isRecord(confidence)) {
    issues.push({ path: "confidence", message: "must be an object" });
  } else {
    for (const field of ["overall", "rhythm", "harmony", "melody", "arrangement"] as const) {
      checkConfidence(issues, confidence[field], `confidence.${field}`);
    }
    if (!Array.isArray(confidence.notes) || confidence.notes.some((note) => typeof note !== "string")) issues.push({ path: "confidence.notes", message: "must be a string array" });
  }

  const participantIds = uniqueIds(issues, "participants", input.participants);
  const workspaceIds = uniqueIds(issues, "workspaces", input.workspaces);
  const trackIds = uniqueIds(issues, "tracks", input.tracks);
  const draftIds = uniqueIds(issues, "drafts", input.drafts);
  const sceneIds = uniqueIds(issues, "scenes", input.scenes);
  uniqueIds(issues, "sections", input.sections);
  uniqueIds(issues, "productionChoreography", input.productionChoreography);
  uniqueIds(issues, "livePerformanceChoreography", input.livePerformanceChoreography);
  uniqueIds(issues, "liveStructuralOperations", input.liveStructuralOperations);
  uniqueIds(issues, "performanceViews", input.performanceViews);

  if (participantIds.size === 0) issues.push({ path: "participants", message: "must not be empty" });
  if (trackIds.size === 0) issues.push({ path: "tracks", message: "must not be empty" });
  if (draftIds.size === 0) issues.push({ path: "drafts", message: "must not be empty" });
  if (sceneIds.size === 0) issues.push({ path: "scenes", message: "must not be empty" });

  const tempoMap = input.tempoMap;
  if (!Array.isArray(tempoMap) || tempoMap.length === 0) issues.push({ path: "tempoMap", message: "must be a non-empty array" });
  else tempoMap.forEach((raw, index) => {
    if (!isRecord(raw)) {
      issues.push({ path: `tempoMap[${index}]`, message: "must be an object" });
      return;
    }
    if (!Number.isInteger(raw.bar) || (raw.bar as number) < 0) issues.push({ path: `tempoMap[${index}].bar`, message: "must be a non-negative integer" });
    if (typeof raw.bpm !== "number" || !Number.isFinite(raw.bpm) || raw.bpm <= 0) issues.push({ path: `tempoMap[${index}].bpm`, message: "must be positive" });
    if (index === 0 && raw.bar !== 0) issues.push({ path: "tempoMap[0].bar", message: "must start at bar 0" });
    const previous = tempoMap[index - 1];
    if (index > 0 && isRecord(previous) && typeof previous.bar === "number" && typeof raw.bar === "number" && raw.bar <= previous.bar) {
      issues.push({ path: `tempoMap[${index}].bar`, message: "must be strictly increasing" });
    }
  });
  if (!Array.isArray(input.timeSignatures) || input.timeSignatures.length === 0) issues.push({ path: "timeSignatures", message: "must be a non-empty array" });

  checkSoundDesign(issues, input.soundDesign);

  if (Array.isArray(input.workspaces)) input.workspaces.forEach((raw, i) => {
    if (!isRecord(raw)) return;
    if (typeof raw.participantId !== "string" || !participantIds.has(raw.participantId)) issues.push({ path: `workspaces[${i}].participantId`, message: "references unknown participant" });
    if (!Array.isArray(raw.trackIds)) issues.push({ path: `workspaces[${i}].trackIds`, message: "must be an array" });
    else raw.trackIds.forEach((id, j) => { if (typeof id !== "string" || !trackIds.has(id)) issues.push({ path: `workspaces[${i}].trackIds[${j}]`, message: "references unknown track" }); });
  });

  if (Array.isArray(input.tracks)) input.tracks.forEach((raw, i) => {
    if (!isRecord(raw)) return;
    if (!LAYERS.includes(raw.layerKind as LayerId)) issues.push({ path: `tracks[${i}].layerKind`, message: "has unsupported layer kind" });
    if (!Array.isArray(raw.draftIds)) issues.push({ path: `tracks[${i}].draftIds`, message: "must be an array" });
    else raw.draftIds.forEach((id, j) => { if (typeof id !== "string" || !draftIds.has(id)) issues.push({ path: `tracks[${i}].draftIds[${j}]`, message: "references unknown draft" }); });
  });

  const draftKinds = new Map<string, unknown>();
  if (Array.isArray(input.drafts)) input.drafts.forEach((raw, i) => {
    if (!isRecord(raw) || typeof raw.id !== "string") return;
    draftKinds.set(raw.id, raw.kind);
    if (!LAYERS.includes(raw.kind as LayerId)) issues.push({ path: `drafts[${i}].kind`, message: "has unsupported layer kind" });
    if (!Number.isInteger(raw.revision) || (raw.revision as number) < 0) issues.push({ path: `drafts[${i}].revision`, message: "must be a non-negative integer" });
    if (raw.patternBars !== undefined && (!Number.isInteger(raw.patternBars) || (raw.patternBars as number) <= 0)) issues.push({ path: `drafts[${i}].patternBars`, message: "must be a positive integer" });
    if (raw.kind === "drums" && raw.drumHits !== undefined) {
      if (!Array.isArray(raw.drumHits)) issues.push({ path: `drafts[${i}].drumHits`, message: "must be an array" });
      else raw.drumHits.forEach((hit, hitIndex) => {
        if (!isRecord(hit)) return issues.push({ path: `drafts[${i}].drumHits[${hitIndex}]`, message: "must be an object" });
        if (!Number.isInteger(hit.bar) || (hit.bar as number) < 0) issues.push({ path: `drafts[${i}].drumHits[${hitIndex}].bar`, message: "must be a non-negative integer" });
        if (!Number.isInteger(hit.step) || (hit.step as number) < 0 || (hit.step as number) > 15) issues.push({ path: `drafts[${i}].drumHits[${hitIndex}].step`, message: "must be an integer from 0 to 15" });
        checkEnum(issues, hit.voice, `drafts[${i}].drumHits[${hitIndex}].voice`, [
          "kick", "snare", "hat", "rim", "tomLow", "tomMid", "tomHigh", "crash", "ride",
        ]);
        checkFiniteNumber(issues, hit.velocity, `drafts[${i}].drumHits[${hitIndex}].velocity`, { min: 0, max: 1 });
        if (hit.timingOffset !== undefined) checkFiniteNumber(issues, hit.timingOffset, `drafts[${i}].drumHits[${hitIndex}].timingOffset`, { min: -0.49, max: 0.99 });
      });
    }
    if ((raw.kind === "bass" || raw.kind === "melody") && Array.isArray(raw.notes)) raw.notes.forEach((note, noteIndex) => {
      if (!isRecord(note)) return;
      if (note.bar !== undefined && (!Number.isInteger(note.bar) || (note.bar as number) < 0)) issues.push({ path: `drafts[${i}].notes[${noteIndex}].bar`, message: "must be a non-negative integer" });
      if (!Number.isInteger(note.step) || (note.step as number) < 0 || (note.step as number) > 15) issues.push({ path: `drafts[${i}].notes[${noteIndex}].step`, message: "must be an integer from 0 to 15" });
      if (note.articulation !== undefined) checkEnum(issues, note.articulation, `drafts[${i}].notes[${noteIndex}].articulation`, ["normal", "legato", "slide", "muted", "ghost", "accent"]);
      if (note.instrument !== undefined) checkEnum(issues, note.instrument, `drafts[${i}].notes[${noteIndex}].instrument`, ["default", "reed", "reed-alto", "reed-tenor", "guitar"]);
      if (note.glideFrom !== undefined && (typeof note.glideFrom !== "string" || !note.glideFrom.trim())) issues.push({ path: `drafts[${i}].notes[${noteIndex}].glideFrom`, message: "must be a non-empty string" });
      if (note.timingOffset !== undefined) checkFiniteNumber(issues, note.timingOffset, `drafts[${i}].notes[${noteIndex}].timingOffset`, { min: -0.49, max: 0.99 });
    });
    if (raw.kind === "harmony" && Array.isArray(raw.harmonyChords)) raw.harmonyChords.forEach((chord, chordIndex) => {
      if (!isRecord(chord)) return;
      if (!Number.isInteger(chord.bar) || (chord.bar as number) < 0) issues.push({ path: `drafts[${i}].harmonyChords[${chordIndex}].bar`, message: "must be a non-negative integer" });
      if (chord.step !== undefined && (!Number.isInteger(chord.step) || (chord.step as number) < 0 || (chord.step as number) > 15)) issues.push({ path: `drafts[${i}].harmonyChords[${chordIndex}].step`, message: "must be an integer from 0 to 15" });
      if (chord.velocity !== undefined) checkFiniteNumber(issues, chord.velocity, `drafts[${i}].harmonyChords[${chordIndex}].velocity`, { min: 0, max: 1 });
      if (chord.articulation !== undefined) checkEnum(issues, chord.articulation, `drafts[${i}].harmonyChords[${chordIndex}].articulation`, ["held", "pluck", "muted", "accent"]);
      if (chord.timingOffset !== undefined) checkFiniteNumber(issues, chord.timingOffset, `drafts[${i}].harmonyChords[${chordIndex}].timingOffset`, { min: -0.49, max: 0.99 });
    });
  });

  if (!isRecord(input.scenePlacements)) {
    issues.push({ path: "scenePlacements", message: "must be an object" });
  } else {
    for (const [sceneId, rawPlacement] of Object.entries(input.scenePlacements)) {
      if (!sceneIds.has(sceneId)) issues.push({ path: `scenePlacements.${sceneId}`, message: "references unknown scene" });
      if (!isRecord(rawPlacement)) {
        issues.push({ path: `scenePlacements.${sceneId}`, message: "must be an object" });
        continue;
      }
      for (const [layer, draftId] of Object.entries(rawPlacement)) {
        if (!LAYERS.includes(layer as LayerId)) issues.push({ path: `scenePlacements.${sceneId}.${layer}`, message: "has unsupported layer" });
        if (typeof draftId !== "string" || !draftIds.has(draftId)) issues.push({ path: `scenePlacements.${sceneId}.${layer}`, message: "references unknown draft" });
        else if (draftKinds.get(draftId) !== layer) issues.push({ path: `scenePlacements.${sceneId}.${layer}`, message: `draft ${draftId} has incompatible kind` });
      }
    }
  }

  if (input.sceneLayerStacks !== undefined) {
    if (!isRecord(input.sceneLayerStacks)) issues.push({ path: "sceneLayerStacks", message: "must be an object" });
    else for (const [sceneId, rawStacks] of Object.entries(input.sceneLayerStacks)) {
      if (!sceneIds.has(sceneId)) issues.push({ path: `sceneLayerStacks.${sceneId}`, message: "references unknown scene" });
      if (!isRecord(rawStacks)) {
        issues.push({ path: `sceneLayerStacks.${sceneId}`, message: "must be an object" });
        continue;
      }
      for (const [layer, rawDraftIds] of Object.entries(rawStacks)) {
        if (!LAYERS.includes(layer as LayerId)) issues.push({ path: `sceneLayerStacks.${sceneId}.${layer}`, message: "has unsupported layer" });
        if (!Array.isArray(rawDraftIds)) {
          issues.push({ path: `sceneLayerStacks.${sceneId}.${layer}`, message: "must be an array" });
          continue;
        }
        rawDraftIds.forEach((draftId, index) => {
          const path = `sceneLayerStacks.${sceneId}.${layer}[${index}]`;
          if (typeof draftId !== "string" || !draftIds.has(draftId)) issues.push({ path, message: "references unknown draft" });
          else if (draftKinds.get(draftId) !== layer) issues.push({ path, message: `draft ${draftId} has incompatible kind` });
        });
      }
    }
  }

  const arrangement = input.arrangement;
  if (!isRecord(arrangement)) {
    issues.push({ path: "arrangement", message: "must be an object" });
  } else {
    if (!Number.isInteger(arrangement.totalBars) || (arrangement.totalBars as number) <= 0) issues.push({ path: "arrangement.totalBars", message: "must be a positive integer" });
    if (!Array.isArray(arrangement.scenes)) issues.push({ path: "arrangement.scenes", message: "must be an array" });
    else arrangement.scenes.forEach((raw, i) => {
      if (!isRecord(raw) || typeof raw.sceneId !== "string" || !sceneIds.has(raw.sceneId)) issues.push({ path: `arrangement.scenes[${i}].sceneId`, message: "references unknown scene" });
      if (!isRecord(raw) || !Number.isInteger(raw.startBar) || (raw.startBar as number) < 0) issues.push({ path: `arrangement.scenes[${i}].startBar`, message: "must be a non-negative integer" });
    });
  }

  if (Array.isArray(input.productionChoreography)) input.productionChoreography.forEach((raw, i) => {
    if (!isRecord(raw)) return;
    if (typeof raw.participantId !== "string" || !participantIds.has(raw.participantId)) issues.push({ path: `productionChoreography[${i}].participantId`, message: "references unknown participant" });
    if (typeof raw.workspaceId !== "string" || !workspaceIds.has(raw.workspaceId)) issues.push({ path: `productionChoreography[${i}].workspaceId`, message: "references unknown workspace" });
  });

  if (Array.isArray(input.liveStructuralOperations)) input.liveStructuralOperations.forEach((raw, i) => {
    if (!isRecord(raw)) return;
    if (!Number.isInteger(raw.executeAtBar) || (raw.executeAtBar as number) < 0) issues.push({ path: `liveStructuralOperations[${i}].executeAtBar`, message: "must be a non-negative integer" });
    if (typeof raw.sceneId === "string" && !sceneIds.has(raw.sceneId)) issues.push({ path: `liveStructuralOperations[${i}].sceneId`, message: "references unknown scene" });
    if (typeof raw.replacementSceneId === "string" && !sceneIds.has(raw.replacementSceneId)) issues.push({ path: `liveStructuralOperations[${i}].replacementSceneId`, message: "references unknown scene" });
    if (typeof raw.draftId === "string" && !draftIds.has(raw.draftId)) issues.push({ path: `liveStructuralOperations[${i}].draftId`, message: "references unknown draft" });
  });

  if (Array.isArray(input.performanceViews)) input.performanceViews.forEach((raw, i) => {
    if (!isRecord(raw) || !Array.isArray(raw.participantIds)) return;
    raw.participantIds.forEach((id, j) => { if (typeof id !== "string" || !participantIds.has(id)) issues.push({ path: `performanceViews[${i}].participantIds[${j}]`, message: "references unknown participant" }); });
  });

  return issues;
}

/** Backward-compatible string diagnostics for existing callers. */
export function validatePack(input: unknown): string[] {
  return inspectReconstructionPack(input).map((issue) => `${issue.path}: ${issue.message}`);
}

export function assertValidReconstructionPack(input: unknown): asserts input is ReconstructionPack {
  const issues = inspectReconstructionPack(input);
  if (issues.length) throw new ReconstructionPackValidationError(issues);
}

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

export const RECONSTRUCTION_PACK_SCHEMA_VERSION = 1 as const;

export interface ReconstructionPackMetadata {
  id: string;
  title: string;
  bpm: number;
  /** Marks prototype assumptions; not final DAW semantics. */
  prototypeOnly: true;
  source: "placeholder" | "local-private";
}

export interface ReconstructionPackProvenance {
  /** Human-readable authoring origin, without embedding local file paths. */
  createdBy: string;
  sourceDescription: string;
  rightsBasis: "original-placeholder" | "owner-provided-private-reference";
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
  defaultMix: MixParams;
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
    if (metadata.source !== "placeholder" && metadata.source !== "local-private") issues.push({ path: "metadata.source", message: "must be placeholder or local-private" });
  }

  const provenance = input.provenance;
  if (!isRecord(provenance)) {
    issues.push({ path: "provenance", message: "must be an object" });
  } else {
    if (typeof provenance.createdBy !== "string" || !provenance.createdBy.trim()) issues.push({ path: "provenance.createdBy", message: "must be a non-empty string" });
    if (typeof provenance.sourceDescription !== "string" || !provenance.sourceDescription.trim()) issues.push({ path: "provenance.sourceDescription", message: "must be a non-empty string" });
    if (provenance.rightsBasis !== "original-placeholder" && provenance.rightsBasis !== "owner-provided-private-reference") issues.push({ path: "provenance.rightsBasis", message: "has unsupported value" });
    if (!Array.isArray(provenance.referenceAssetIds) || provenance.referenceAssetIds.some((id) => typeof id !== "string")) issues.push({ path: "provenance.referenceAssetIds", message: "must be a string array" });
    if (metadata && isRecord(metadata) && metadata.source === "local-private" && provenance.rightsBasis !== "owner-provided-private-reference") {
      issues.push({ path: "provenance.rightsBasis", message: "local-private packs require owner-provided-private-reference" });
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

  if (!Array.isArray(input.tempoMap) || input.tempoMap.length === 0) issues.push({ path: "tempoMap", message: "must be a non-empty array" });
  if (!Array.isArray(input.timeSignatures) || input.timeSignatures.length === 0) issues.push({ path: "timeSignatures", message: "must be a non-empty array" });

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

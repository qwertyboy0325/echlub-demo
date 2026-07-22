/**
 * ReconstructionPack boundary — loads built-in placeholder or a private local pack.
 * Private packs live in gitignored dirs and must never be committed.
 */
import type { MixParams, PatternDraft, PerformanceScriptEvent, SceneDefinition } from "../types";
import type {
  Arrangement,
  Participant,
  PerformanceViewPreset,
  ProductionAction,
  Workspace,
  TrackDefinition,
} from "./sessionTypes";

export interface ReconstructionPackMetadata {
  id: string;
  title: string;
  bpm: number;
  /** Marks prototype assumptions; not final DAW semantics. */
  prototypeOnly: true;
  source: "placeholder" | "local-private";
}

export interface ReconstructionPack {
  metadata: ReconstructionPackMetadata;
  tempoMap: { bar: number; bpm: number }[];
  timeSignatures: { bar: number; numerator: number; denominator: number }[];
  sections: { id: string; label: string; startBar: number; bars: number }[];
  participants: Participant[];
  workspaces: Workspace[];
  tracks: TrackDefinition[];
  drafts: PatternDraft[];
  scenes: SceneDefinition[];
  defaultMix: MixParams;
  arrangement: Arrangement;
  productionChoreography: ProductionAction[];
  livePerformanceChoreography: PerformanceScriptEvent[];
  performanceViews: PerformanceViewPreset[];
}

/** Gitignored locations for owner-provided reconstruction data. */
export const PRIVATE_PACK_PATHS = ["reference-private/", "local-reconstruction/"] as const;

export function validatePack(pack: ReconstructionPack): string[] {
  const errors: string[] = [];
  if (!pack.participants.length) errors.push("pack has no participants");
  if (!pack.tracks.length) errors.push("pack has no tracks");
  for (const scene of pack.arrangement.scenes) {
    if (!pack.scenes.find((s) => s.id === scene.sceneId)) {
      errors.push(`arrangement references unknown scene ${scene.sceneId}`);
    }
  }
  for (const ws of pack.workspaces) {
    if (!pack.participants.find((p) => p.id === ws.participantId)) {
      errors.push(`workspace ${ws.id} references unknown participant`);
    }
  }
  return errors;
}

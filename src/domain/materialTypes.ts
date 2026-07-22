import type { LayerId, NoteEvent } from "../types";

export interface MaterialRef {
  draftId: string;
  revision: number;
  fingerprint: string;
}

export interface DrumHit {
  step: number;
  voice: "kick" | "snare" | "hat";
  velocity: number;
}

export interface DrumMaterialContent {
  kind: "drums";
  hits: DrumHit[];
}

export interface NoteMaterialContent {
  kind: "bass" | "melody";
  notes: NoteEvent[];
}

export interface HarmonyChordEvent {
  bar: number;
  notes: string[];
}

export interface HarmonyMaterialContent {
  kind: "harmony";
  chords: HarmonyChordEvent[];
}

export interface TextureMaterialContent {
  kind: "texture";
  noise: "brown" | "pink" | "white";
  level: number;
  duration: string;
  patchId: string;
}

export type MaterialContent =
  | DrumMaterialContent
  | NoteMaterialContent
  | HarmonyMaterialContent
  | TextureMaterialContent;

export interface ProducedMaterial {
  draftId: string;
  revision: number;
  kind: LayerId;
  contentFingerprint: string;
  content: MaterialContent;
}

export interface SessionMaterialBank {
  version: number;
  materials: Map<string, ProducedMaterial>;
  latestRevision: Record<string, number>;
}

export function materialKey(draftId: string, revision: number): string {
  return `${draftId}@${revision}`;
}

export interface MaterialResolutionEvidence {
  act: "production" | "canonicalPlayback" | "livePerformance";
  consumer: "cue" | "canonical" | "live";
  sceneId: string;
  layer: string;
  draftId: string;
  revision: number;
  fingerprint: string;
  bankVersion: number;
}

export interface MissingMaterialDiagnostic {
  act: string;
  sceneId: string;
  layer: string;
  draftId: string;
  revision: number;
  fingerprint?: string;
  message: string;
}

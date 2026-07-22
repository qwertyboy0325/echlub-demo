/**
 * PROTOTYPE-ONLY domain model for Round 3 concept film.
 * Not the canonical EchLub DAW model. Participant count is data-driven;
 * Four-Brain layout is one performance-view preset.
 */
import type { BrainId, MaterialRef, MixParams, PatternDraft, PerformanceScriptEvent, SceneDefinition } from "../types";

export type { MaterialRef };

export type DemoAct = "production" | "canonicalPlayback" | "livePerformance" | "comparison";

export type ProductionRoleId =
  | "rhythm"
  | "percussion"
  | "bass"
  | "harmony"
  | "melody"
  | "texture"
  | "mix"
  | "arrangement";

export interface Participant {
  id: string;
  roleId: ProductionRoleId;
  displayName: string;
  /** Maps to BrainId when using Four-Brain performance preset. */
  performanceBrain?: BrainId;
  workspaceIds: string[];
}

export interface Workspace {
  id: string;
  participantId: string;
  label: string;
  /** Tracks this workspace can mutate. */
  trackIds: string[];
  focusPriority: number;
}

export interface TrackDefinition {
  id: string;
  label: string;
  layerKind: string;
  draftIds: string[];
  gain: number;
}

export interface ArrangementSceneRef {
  sceneId: string;
  startBar: number;
}

export interface Arrangement {
  id: string;
  title: string;
  totalBars: number;
  scenes: ArrangementSceneRef[];
}

export interface PerformanceViewPreset {
  id: string;
  label: string;
  brainOrder: BrainId[];
  participantIds: string[];
}

export interface ProductionSession {
  packId: string;
  participants: Participant[];
  workspaces: Workspace[];
  tracks: TrackDefinition[];
  drafts: Record<string, PatternDraft>;
  scenes: SceneDefinition[];
  arrangement: Arrangement;
  performanceViews: PerformanceViewPreset[];
  mix: MixParams;
  productionComplete: boolean;
  canonicalPlaybackComplete: boolean;
  liveTakeComplete: boolean;
}

export interface ProductionAction {
  id: string;
  atBeat: number;
  participantId: string;
  workspaceId: string;
  kind:
    | "addNote"
    | "moveNote"
    | "setVelocity"
    | "toggleStep"
    | "createVariation"
    | "editBass"
    | "editHarmony"
    | "editTexture"
    | "adjustGain"
    | "adjustFilter"
    | "adjustDelay"
    | "captureFx"
    | "createDraft"
    | "previewDraft"
    | "offerDraft"
    | "acceptDraft"
    | "reviseDraft"
    | "placeInScene"
    | "createTransition"
    | "assembleArrangement";
  target?: string;
  layerId?: string;
  value?: string | number;
  label: string;
}

export interface ProductionMutationResult {
  bankVersion: number;
  materialRef?: MaterialRef;
  contentChanged: boolean;
}

export interface LayerContentChange {
  sceneId: string;
  layer: string;
  draftId: string;
  canonicalRevision: number;
  liveRevision: number;
  canonicalFingerprint: string;
  liveFingerprint: string;
}

export interface CanonicalVsLiveComparison {
  canonicalSceneIds: string[];
  liveSceneIds: string[];
  changedScenes: string[];
  changedDrafts: string[];
  sameIdContentChanges: LayerContentChange[];
  changedFx: string[];
  jamMemoryCount: number;
}

export interface DemoRuntimeConfig {
  act: DemoAct;
  speedMultiplier: number;
  recordingMode: boolean;
}

export type LivePerformanceChoreography = PerformanceScriptEvent[];

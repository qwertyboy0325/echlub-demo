import type { MusicalPosition } from "./musicalPosition";

export type BrainId = "memory" | "pulse" | "blend" | "story";
export type DraftStatus = "editing" | "preview" | "ready" | "offered" | "queued" | "playing" | "archived";
export type LayerId = "drums" | "bass" | "harmony" | "melody" | "texture";
export type BoundaryType = "beat" | "bar" | "phrase";
export type CursorGesture = "move" | "hover" | "click" | "doubleClick" | "drag" | "scrub" | "idle" | "wait" | "cut";

export type ScriptAction =
  | "focus"
  | "edit"
  | "preview"
  | "ready"
  | "offer"
  | "queue"
  | "launch"
  | "filter"
  | "delay"
  | "scene"
  | "thought"
  | "memory"
  | "quantize"
  | "fader"
  | "toggleStep"
  | "addNote"
  | "moveNote"
  | "dragToQueue";

export interface NoteEvent {
  id: string;
  step: number;
  pitch: number;
  note: string;
  duration: string;
  velocity: number;
  width?: number;
}

export interface HarmonyChordEvent {
  bar: number;
  notes: string[];
}

export interface TextureParams {
  noise: "brown" | "pink" | "white";
  level: number;
  duration: string;
  patchId: string;
}

export interface PatternDraft {
  id: string;
  owner: BrainId;
  title: string;
  kind: LayerId;
  status: DraftStatus;
  revision: number;
  notes?: NoteEvent[];
  steps?: number[];
  stepVelocities?: Record<number, number>;
  harmonyChords?: HarmonyChordEvent[];
  textureParams?: TextureParams;
}

export interface MaterialRef {
  draftId: string;
  revision: number;
  fingerprint: string;
}

export interface SceneDefinition {
  id: string;
  title: string;
  bars: number;
  startBar: number;
  description: string;
  layers: Record<LayerId, MaterialRef | null>;
  fx: MixParams;
}

export interface MixParams {
  filter: number;
  delayWet: number;
  reverbWet: number;
  masterGain: number;
  faders: Record<string, number>;
}

export interface PerformanceScriptEvent {
  id: string;
  at: string;
  brain: BrainId;
  action: ScriptAction;
  target?: string;
  value?: string | number;
  label: string;
  detail: string;
  boundary?: { type: BoundaryType; bar: number };
}

export interface ChoreographyStep {
  actor: BrainId;
  gesture: CursorGesture;
  target: string;
  destination?: string;
  duration?: number;
  anticipation?: number;
  dwell?: number;
  concurrentGroup?: string;
  eventId: string;
}

export interface QueuedOperation {
  id: string;
  draftId?: string;
  sceneId?: string;
  label: string;
  queuedAt: MusicalPosition;
  executeAt: MusicalPosition;
  executeAtBar: number;
  boundary: BoundaryType;
  boundaryId?: string;
  status: "queued" | "executing" | "playing" | "executed" | "archived";
}

export interface CapturedJamMemory extends JamMemory {
  boundaryId: string;
  sceneExecutionId: string;
  sceneId: string;
}

export interface JamMemory {
  id: string;
  at: string;
  title: string;
  description: string;
}

export interface RuntimeState {
  activeSceneId: string;
  currentBar: number;
  currentBeat: number;
  currentSixteenth: number;
  activeBrains: Set<BrainId>;
  thoughts: Record<BrainId, string>;
  drafts: Record<string, PatternDraft>;
  queue: QueuedOperation[];
  offeredDrafts: string[];
  history: JamMemory[];
  lastAction: PerformanceScriptEvent | null;
  mix: MixParams;
  activePatternId: string;
  activeDraftId: string;
  previewBrain: BrainId | null;
  boundaryCountdown: { label: string; boundaryId: string; barsRemaining: number; beatsRemaining: number } | null;
  recordingMode: boolean;
}

export const DRAFT_TRANSITIONS: Record<DraftStatus, DraftStatus[]> = {
  editing: ["preview", "ready", "offered"],
  preview: ["editing", "ready", "offered"],
  ready: ["offered", "editing", "queued"],
  offered: ["queued", "ready"],
  queued: ["playing", "offered"],
  playing: ["archived"],
  archived: ["queued"],
};

import type { MusicalPosition } from "./musicalPosition";

export type BrainId = "memory" | "pulse" | "blend" | "story";
export type DraftStatus = "editing" | "preview" | "ready" | "offered" | "queued" | "playing" | "archived";
export type LayerId = "drums" | "bass" | "harmony" | "melody" | "texture";
export type BoundaryType = "beat" | "bar" | "phrase";
export type CursorGesture = "move" | "hover" | "click" | "doubleClick" | "drag" | "scrub" | "idle" | "wait" | "cut";

export type CapabilityLiveOperation = "privateCue" | "revision";

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
  | "dragToQueue"
  | "capability";

export interface NoteEvent {
  id: string;
  /** Zero-based bar within the draft pattern. Defaults to 0 for legacy packs. */
  bar?: number;
  step: number;
  pitch: number;
  note: string;
  duration: string;
  velocity: number;
  width?: number;
  /** Performance articulation retained through the material-bank fingerprint. */
  articulation?: "normal" | "legato" | "slide" | "muted" | "ghost" | "accent";
  /** Optional synthesized performance voice; source audio is never required at runtime. */
  instrument?: "default" | "reed" | "reed-alto" | "reed-tenor" | "guitar";
  /** Optional source pitch for a monophonic hammer-on, pull-off, or slide. */
  glideFrom?: string;
  /** Deterministic microtiming in sixteenth-note units, constrained to -0.49..0.99. */
  timingOffset?: number;
}

export interface HarmonyChordEvent {
  bar: number;
  step?: number;
  notes: string[];
  duration?: string;
  velocity?: number;
  articulation?: "held" | "pluck" | "muted" | "accent";
  /** Deterministic microtiming in sixteenth-note units, constrained to -0.49..0.99. */
  timingOffset?: number;
}

export interface DrumPatternHit {
  bar: number;
  step: number;
  voice: "kick" | "snare" | "hat" | "rim" | "tomLow" | "tomMid" | "tomHigh" | "crash" | "ride";
  velocity: number;
  duration?: string;
  /** Deterministic microtiming in sixteenth-note units, constrained to -0.49..0.99. */
  timingOffset?: number;
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
  /** Pattern length used for multi-bar looping. Defaults to inferred content length. */
  patternBars?: number;
  notes?: NoteEvent[];
  drumHits?: DrumPatternHit[];
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
  /** Additional independently resolved materials routed through the same broad layer bus. */
  layerStacks?: Partial<Record<LayerId, MaterialRef[]>>;
  fx: MixParams;
}

export interface MixParams {
  filter: number;
  delayWet: number;
  reverbWet: number;
  masterGain: number;
  faders: Record<string, number>;
  /** Per-scene drum tone; defaults to pack soundDesign.drums.filterFrequency. */
  drumFilter?: number;
  /** Independent drum room send; defaults to 0. */
  drumReverbWet?: number;
  /** Post-bus drum subgroup trim in dB; defaults to 0. */
  drumTrimDb?: number;
  /** Post-drive bass subgroup trim in dB; defaults to 0. */
  bassTrimDb?: number;
}

export interface PerformanceScriptEvent {
  id: string;
  at: string;
  brain?: BrainId;
  action: ScriptAction;
  capabilityId?: string;
  capabilityOperation?: CapabilityLiveOperation;
  target?: string;
  value?: string | number;
  label: string;
  detail: string;
  boundary?: { type: BoundaryType; bar: number };
}

export interface ChoreographyStep {
  actor?: BrainId;
  capabilityId?: string;
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

export type BrainId = "memory" | "pulse" | "blend" | "story";
export type DraftStatus = "editing" | "preview" | "ready" | "offered" | "queued" | "playing" | "archived";
export type LayerId = "drums" | "bass" | "harmony" | "melody" | "texture";
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
  | "memory";

export interface NoteEvent {
  step: number;
  note: string;
  duration: string;
  velocity: number;
}

export interface PatternDraft {
  id: string;
  owner: BrainId;
  title: string;
  kind: LayerId;
  status: DraftStatus;
  notes?: NoteEvent[];
  steps?: number[];
}

export interface SceneDefinition {
  id: string;
  title: string;
  bars: number;
  startBar: number;
  description: string;
  layers: Record<LayerId, string | null>;
  fx: {
    filter: number;
    delayWet: number;
    reverbWet: number;
    masterGain: number;
  };
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
  focusedBrain: BrainId | null;
  thoughts: Record<BrainId, string>;
  drafts: Record<string, PatternDraft>;
  queue: string[];
  history: JamMemory[];
  lastAction: PerformanceScriptEvent | null;
}

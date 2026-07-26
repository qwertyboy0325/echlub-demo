import type { V3UiTargetKey } from "./v3UiTargets";

export type V3ActionInvocation =
  | "dom-click"
  | "dom-input"
  | "dom-keydown"
  | "projection-dispatch"
  | "hold";

export interface V3ActionTraceEntry {
  beatId: string;
  participantId: string;
  room: string;
  participantTab: string;
  exchangeOpen: boolean;
  actionKind: "click" | "scrub" | "knob" | "projection" | "hold";
  targetKey?: V3UiTargetKey;
  selector?: string;
  resolution?: {
    visible: boolean;
    enabled: boolean;
    inViewport: boolean;
    elementTag: string;
  };
  gestureStartMs: number;
  cursorArrivalMs?: number;
  gestureEndMs: number;
  invocation: V3ActionInvocation;
  domainEvent?: string | null;
  visibleConsequence?: string | null;
  audioConsequence?: string | null;
}

export interface V3BeatTraceEntry {
  beatId: string;
  label: string;
  participantId: string;
  startMs: number;
  endMs: number;
  actions: V3ActionTraceEntry[];
}

export interface V3FollowLockTraceEntry {
  label: string;
  atMs: number;
  room: string;
  followActive: boolean;
  followLocked: boolean;
  selectedParticipantId: string;
  workspaceDraftId: string | null;
  transportBar: number;
  invocation: V3ActionInvocation;
}

const actionTrace: V3ActionTraceEntry[] = [];
const beatTrace: V3BeatTraceEntry[] = [];
const followLockTrace: V3FollowLockTraceEntry[] = [];
let runStartMs = 0;
let currentBeat: V3BeatTraceEntry | null = null;

export function v3TraceElapsedMs(): number {
  return Date.now() - runStartMs;
}

export function resetV3ActionTrace(): void {
  actionTrace.length = 0;
  beatTrace.length = 0;
  followLockTrace.length = 0;
  runStartMs = Date.now();
  currentBeat = null;
}

export function startV3BeatTrace(
  beatId: string,
  label: string,
  participantId: string,
): void {
  currentBeat = {
    beatId,
    label,
    participantId,
    startMs: Date.now() - runStartMs,
    endMs: 0,
    actions: [],
  };
}

export function endV3BeatTrace(): void {
  if (!currentBeat) return;
  currentBeat.endMs = Date.now() - runStartMs;
  beatTrace.push(currentBeat);
  currentBeat = null;
}

export function recordV3ActionTrace(entry: Omit<V3ActionTraceEntry, "gestureStartMs" | "gestureEndMs"> & {
  gestureStartMs?: number;
  gestureEndMs?: number;
}): void {
  const full: V3ActionTraceEntry = {
    ...entry,
    gestureStartMs: entry.gestureStartMs ?? Date.now() - runStartMs,
    gestureEndMs: entry.gestureEndMs ?? Date.now() - runStartMs,
  };
  actionTrace.push(full);
  if (currentBeat) currentBeat.actions.push(full);
}

export function recordV3FollowLockTrace(
  label: string,
  invocation: V3ActionInvocation,
  snapshot: {
    room: string;
    followActive: boolean;
    followLocked: boolean;
    selectedParticipantId: string;
    workspaceDraftId: string | null;
    transportBar: number;
  },
): void {
  followLockTrace.push({
    label,
    atMs: Date.now() - runStartMs,
    invocation,
    ...snapshot,
  });
}

export function getV3ActionTrace(): {
  runStartMs: number;
  actionTrace: V3ActionTraceEntry[];
  beatTrace: V3BeatTraceEntry[];
  followLockTrace: V3FollowLockTraceEntry[];
} {
  return {
    runStartMs,
    actionTrace: [...actionTrace],
    beatTrace: [...beatTrace],
    followLockTrace: [...followLockTrace],
  };
}

export function readLatestDomainEvent(): string | null {
  if (typeof window === "undefined") return null;
  const ev = (window as unknown as { __shellAudioEvidence?: () => { domainEventTrace?: Array<{ type: string; detail: string }> } }).__shellAudioEvidence?.();
  const tail = ev?.domainEventTrace?.[ev.domainEventTrace.length - 1];
  return tail ? `${tail.type}: ${tail.detail}` : null;
}

export function readAudioConsequence(): string | null {
  if (typeof window === "undefined") return null;
  const ev = (window as unknown as {
    __shellAudioEvidence?: () => {
      cueActive?: boolean;
      transportPlaying?: boolean;
      activeSlots?: unknown[];
    };
  }).__shellAudioEvidence?.();
  if (!ev) return null;
  if (ev.cueActive) return "cue-active";
  if (ev.transportPlaying) return `transport-playing · ${ev.activeSlots?.length ?? 0} lanes`;
  return "silent";
}

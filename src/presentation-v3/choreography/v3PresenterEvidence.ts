import type { ShellCommand } from "../../shell/domain/shellTypes";
import type { V3TargetFailure } from "./v3TargetResolver";
import type { V3UiTargetKey } from "./v3UiTargets";

export type V3RunnerState = "idle" | "running" | "paused" | "stopped";

export interface V3PresenterEvidenceSnapshot {
  runnerState: V3RunnerState;
  runnerEpoch: number;
  restartEpoch: number;
  currentBeatId: string | null;
  currentBeatLabel: string | null;
  currentParticipantId: string | null;
  currentTargetKey: V3UiTargetKey | null;
  currentRoom: string;
  followActive: boolean;
  followLocked: boolean;
  caption: string | null;
  lastSuccessfulAction: string | null;
  lastVisibleConsequence: string | null;
  lastDomainConsequence: string | null;
  lastAudioConsequence: string | null;
  targetFailures: V3TargetFailure[];
  formalMode: boolean;
  capturedAt: string;
}

let snapshot: V3PresenterEvidenceSnapshot = emptySnapshot();

function emptySnapshot(): V3PresenterEvidenceSnapshot {
  return {
    runnerState: "idle",
    runnerEpoch: 0,
    restartEpoch: 0,
    currentBeatId: null,
    currentBeatLabel: null,
    currentParticipantId: null,
    currentTargetKey: null,
    currentRoom: "global",
    followActive: false,
    followLocked: false,
    caption: null,
    lastSuccessfulAction: null,
    lastVisibleConsequence: null,
    lastDomainConsequence: null,
    lastAudioConsequence: null,
    targetFailures: [],
    formalMode: true,
    capturedAt: new Date().toISOString(),
  };
}

export function getV3PresenterEvidence(): V3PresenterEvidenceSnapshot {
  return { ...snapshot, targetFailures: [...snapshot.targetFailures] };
}

export function resetV3PresenterEvidence(): void {
  snapshot = emptySnapshot();
}

export function patchV3PresenterEvidence(
  patch: Partial<V3PresenterEvidenceSnapshot>,
): void {
  snapshot = { ...snapshot, ...patch, capturedAt: new Date().toISOString() };
}

export function recordV3TargetFailure(failure: V3TargetFailure): void {
  snapshot.targetFailures = [...snapshot.targetFailures, failure];
}

export function recordV3ActionSuccess(
  label: string,
  visible?: string,
  domain?: string,
  audio?: string,
): void {
  snapshot.lastSuccessfulAction = label;
  if (visible) snapshot.lastVisibleConsequence = visible;
  if (domain) snapshot.lastDomainConsequence = domain;
  if (audio) snapshot.lastAudioConsequence = audio;
  snapshot.capturedAt = new Date().toISOString();
}

export function projectionCommandLabel(command: ShellCommand): string {
  switch (command.type) {
    case "SET_PARTICIPANT_PROJECTION":
      return `Follow → ${command.participantId} · ${command.room}`;
    case "ENABLE_FOLLOW":
      return "Follow enabled";
    case "RESUME_FOLLOW":
      return "Follow resumed";
    default:
      return command.type;
  }
}

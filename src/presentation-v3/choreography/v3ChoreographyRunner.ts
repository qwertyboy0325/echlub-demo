import type { ShellChoreographyEngine } from "../../shell/choreographyEngine";
import { musicalDomain } from "../../shell/domain/musicalDomain";
import { shellStore } from "../../shell/domain/shellStore";
import {
  endV3BeatTrace,
  getV3ActionTrace,
  recordV3FollowLockTrace,
  resetV3ActionTrace,
  startV3BeatTrace,
} from "./v3ActionTrace";
import {
  executeV3Click,
  executeV3KnobSteps,
  executeV3Projection,
  executeV3Scrub,
  recordFollowLockFromClick,
  recordV3HoldTrace,
  type V3ActionMode,
  waitAfterBars,
  waitUntilTransportBar,
  V3ActionExecutionError,
} from "./v3ActionAdapter";
import { V3_PRESENTATION_BEATS, type V3DemoBeat } from "./v3DemoSequence";
import {
  getV3PresenterEvidence,
  patchV3PresenterEvidence,
  resetV3PresenterEvidence,
  type V3RunnerState,
} from "./v3PresenterEvidence";

export interface V3ChoreographyRunOptions {
  engine?: ShellChoreographyEngine | null;
  /** Prefer live engine ref — shell participant copies recreate engines on dispatch. */
  resolveEngine?: () => ShellChoreographyEngine | null;
  mode?: V3ActionMode;
  onBeat?: (beat: V3DemoBeat) => void;
  maxBeatId?: string;
}

function liveEngine(options: V3ChoreographyRunOptions): ShellChoreographyEngine | null {
  const engine = options.resolveEngine?.() ?? options.engine ?? null;
  if (engine) engine.show();
  return engine;
}

let runnerFlight: Promise<string[]> | null = null;
let runnerEpoch = 0;
let runnerPaused = false;
let runnerState: V3RunnerState = "idle";

const FOLLOW_LOCK_TARGETS = new Set([
  "room-global",
  "room-participant",
  "room-mixer",
  "participant-p1",
  "participant-p2",
  "participant-p3",
  "participant-p4",
  "presenter-resume-follow",
]);

export function getV3RunnerState(): V3RunnerState {
  return runnerState;
}

export function bumpV3RunnerEpoch(): void {
  runnerEpoch += 1;
  runnerPaused = false;
  runnerState = "stopped";
}

export function setV3RunnerPaused(paused: boolean): void {
  runnerPaused = paused;
  runnerState = paused ? "paused" : runnerFlight ? "running" : runnerState;
  patchV3PresenterEvidence({ runnerState });
}

export function stopV3Runner(): void {
  bumpV3RunnerEpoch();
  runnerState = "stopped";
  patchV3PresenterEvidence({ runnerState, currentBeatId: null, currentBeatLabel: null });
}

async function waitWhilePaused(epoch: number): Promise<void> {
  while (runnerPaused && epoch === runnerEpoch) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function runBeatActions(
  beat: V3DemoBeat,
  getEngine: () => ShellChoreographyEngine | null,
  mode: V3ActionMode,
  epoch: number,
): Promise<void> {
  for (const action of beat.actions) {
    if (epoch !== runnerEpoch) return;
    await waitWhilePaused(epoch);
    const engine = getEngine();
    switch (action.type) {
      case "click":
        await executeV3Click(engine, beat.participantId, action.target, beat.id, mode);
        if (FOLLOW_LOCK_TARGETS.has(action.target)) {
          recordFollowLockFromClick(action.target);
        }
        break;
      case "scrub":
        await executeV3Scrub(
          engine,
          beat.participantId,
          action.target,
          action.percent,
          beat.id,
          mode,
        );
        break;
      case "knob":
        await executeV3KnobSteps(
          engine,
          beat.participantId,
          action.target,
          action.steps,
          action.direction,
          beat.id,
          mode,
        );
        break;
      case "projection":
        await executeV3Projection(action.command, beat.id, mode);
        break;
      case "open-exchange":
        if (!shellStore.getState().exchangeOpen) {
          await executeV3Click(engine, beat.participantId, "exchange-toggle", beat.id, mode);
        } else {
          recordV3HoldTrace(beat.id, beat.participantId, 0);
        }
        break;
      case "hold":
        recordV3HoldTrace(beat.id, beat.participantId, action.ms);
        await new Promise((r) => setTimeout(r, action.ms));
        break;
    }
  }
}

export async function runV3PresentationDemo(
  options: V3ChoreographyRunOptions = {},
): Promise<string[]> {
  if (runnerFlight) {
    throw new Error("V3 choreography runner already active");
  }
  const epoch = runnerEpoch;
  const mode = options.mode ?? "formal";
  const getEngine = () => liveEngine(options);
  resetV3PresenterEvidence();
  resetV3ActionTrace();
  runnerState = "running";
  patchV3PresenterEvidence({
    runnerState,
    runnerEpoch: epoch,
    restartEpoch: musicalDomain.getRestartEpoch(),
    formalMode: mode === "formal",
  });

  runnerFlight = (async () => {
    const labels: string[] = [];
    const completedBeatIds: string[] = [];
    try {
      getEngine();
      for (const beat of V3_PRESENTATION_BEATS) {
        if (options.maxBeatId && beat.id > options.maxBeatId) break;
        if (epoch !== runnerEpoch) break;
        await waitWhilePaused(epoch);
        labels.push(beat.label);
        options.onBeat?.(beat);
        startV3BeatTrace(beat.id, beat.label, beat.participantId);
        const state = shellStore.getState();
        patchV3PresenterEvidence({
          currentBeatId: beat.id,
          currentBeatLabel: beat.label,
          currentParticipantId: beat.participantId,
          caption: beat.caption,
          currentRoom: state.room,
          followActive: state.followActive,
          followLocked: state.followLocked,
          runnerEpoch: epoch,
          restartEpoch: musicalDomain.getRestartEpoch(),
        });
        await runBeatActions(beat, getEngine, mode, epoch);
        if (beat.waitUntilBar != null) {
          await waitUntilTransportBar(beat.waitUntilBar, musicalDomain.getRestartEpoch());
        }
        if (beat.afterBar) {
          await waitAfterBars(beat.afterBar, musicalDomain.getRestartEpoch());
        }
        endV3BeatTrace();
        completedBeatIds.push(beat.id);
      }
      patchV3PresenterEvidence({
        completedBeatIds,
        runnerState: "idle",
      });
    } catch (error) {
      runnerState = "stopped";
      patchV3PresenterEvidence({ runnerState });
      endV3BeatTrace();
      if (error instanceof V3ActionExecutionError && mode === "formal") {
        throw error;
      }
      throw error;
    } finally {
      getEngine()?.hide();
      runnerFlight = null;
      runnerPaused = false;
      if (runnerState !== "stopped") runnerState = "idle";
      patchV3PresenterEvidence({
        runnerState,
        currentBeatId: null,
        currentBeatLabel: null,
        completedBeatIds,
      });
    }
    return labels;
  })();

  return runnerFlight;
}

export async function restartV3PresentationDemo(
  engine: ShellChoreographyEngine | null,
  mode: V3ActionMode = "formal",
): Promise<string[]> {
  stopV3Runner();
  bumpV3RunnerEpoch();
  await executeV3Click(engine, "p2", "transport-restart", "restart-demo", mode);
  patchV3PresenterEvidence({ restartEpoch: musicalDomain.getRestartEpoch() });
  return runV3PresentationDemo({ engine, mode });
}

export function runV3FollowLockProbe(): Promise<ReturnType<typeof getV3ActionTrace>> {
  resetV3ActionTrace();
  shellStore.dispatch({ type: "ENABLE_FOLLOW" });
  return executeV3Projection(
    { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" },
    "follow-probe",
    "formal",
  ).then(async () => {
    const snap = {
      room: shellStore.getState().room,
      followActive: shellStore.getState().followActive,
      followLocked: shellStore.getState().followLocked,
      selectedParticipantId: shellStore.getState().selectedParticipantId,
      workspaceDraftId: shellStore.getState().workspaceDraftId,
      transportBar: shellStore.getState().transportBar,
    };
    recordV3FollowLockTrace("projection-only", "projection-dispatch", snap);
    await executeV3Click(null, "p2", "room-mixer", "follow-probe-lock", "formal");
    recordV3FollowLockTrace("manual-room-mixer", "dom-click", {
      ...snap,
      room: shellStore.getState().room,
      followActive: shellStore.getState().followActive,
      followLocked: shellStore.getState().followLocked,
    });
    shellStore.dispatch({ type: "RESUME_FOLLOW" });
    await executeV3Projection(
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "global", tab: "Create" },
      "follow-probe-resume",
      "formal",
    );
    return getV3ActionTrace();
  });
}

export function exposeV3PresenterEvidence(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __v3PresenterEvidence?: () => ReturnType<typeof getV3PresenterEvidence> }).__v3PresenterEvidence =
    () => getV3PresenterEvidence();
  (window as unknown as { __v3ActionTrace?: () => ReturnType<typeof getV3ActionTrace> }).__v3ActionTrace =
    () => getV3ActionTrace();
}

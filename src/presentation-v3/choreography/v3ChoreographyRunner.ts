import type { ShellChoreographyEngine } from "../../shell/choreographyEngine";
import { musicalDomain } from "../../shell/domain/musicalDomain";
import { shellStore } from "../../shell/domain/shellStore";
import {
  executeV3Click,
  executeV3KnobSteps,
  executeV3Projection,
  executeV3Scrub,
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
  mode?: V3ActionMode;
  onBeat?: (beat: V3DemoBeat) => void;
  maxBeatId?: string;
}

let runnerFlight: Promise<string[]> | null = null;
let runnerEpoch = 0;
let runnerPaused = false;
let runnerState: V3RunnerState = "idle";

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
  engine: ShellChoreographyEngine | null,
  mode: V3ActionMode,
  epoch: number,
): Promise<void> {
  for (const action of beat.actions) {
    if (epoch !== runnerEpoch) return;
    await waitWhilePaused(epoch);
    switch (action.type) {
      case "click":
        await executeV3Click(engine, beat.participantId, action.target, beat.id, mode);
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
      case "hold":
        await new Promise((r) => setTimeout(r, action.ms));
        break;
    }
  }
}

export async function runV3PresentationDemo(
  options: V3ChoreographyRunOptions = {},
): Promise<string[]> {
  if (runnerFlight) return runnerFlight;
  const epoch = runnerEpoch;
  const mode = options.mode ?? "formal";
  const engine = options.engine ?? null;
  resetV3PresenterEvidence();
  runnerState = "running";
  patchV3PresenterEvidence({
    runnerState,
    runnerEpoch: epoch,
    restartEpoch: musicalDomain.getRestartEpoch(),
    formalMode: mode === "formal",
  });

  runnerFlight = (async () => {
    const labels: string[] = [];
    try {
      engine?.show();
      for (const beat of V3_PRESENTATION_BEATS) {
        if (options.maxBeatId && beat.id > options.maxBeatId) break;
        if (epoch !== runnerEpoch) break;
        await waitWhilePaused(epoch);
        labels.push(beat.label);
        options.onBeat?.(beat);
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
        await runBeatActions(beat, engine, mode, epoch);
        if (beat.waitUntilBar != null) {
          await waitUntilTransportBar(beat.waitUntilBar, musicalDomain.getRestartEpoch());
        }
        if (beat.afterBar) {
          await waitAfterBars(beat.afterBar, musicalDomain.getRestartEpoch());
        }
      }
    } catch (error) {
      runnerState = "stopped";
      patchV3PresenterEvidence({ runnerState });
      if (error instanceof V3ActionExecutionError && mode === "formal") {
        throw error;
      }
      throw error;
    } finally {
      engine?.hide();
      runnerFlight = null;
      runnerPaused = false;
      if (runnerState !== "stopped") runnerState = "idle";
      patchV3PresenterEvidence({ runnerState, currentBeatId: null, currentBeatLabel: null });
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

export function exposeV3PresenterEvidence(): void {
  if (typeof window === "undefined") return;
  (window as unknown as { __v3PresenterEvidence?: () => ReturnType<typeof getV3PresenterEvidence> }).__v3PresenterEvidence =
    () => getV3PresenterEvidence();
}

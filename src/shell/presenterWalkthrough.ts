/**
 * Bounded Phase 4 presenter walkthrough — 17 beats from owner storyboard.
 * Dispatches shell commands only; audio handled by shellAudioAdapter.
 */
import type { ShellCommand } from "./domain/shellTypes";
import { shellStore } from "./domain/shellStore";

export interface WalkthroughStep {
  beat: number;
  label: string;
  commands: ShellCommand[];
  delayMs?: number;
}

export const PHASE4_WALKTHROUGH: WalkthroughStep[] = [
  { beat: 1, label: "Sparse global session", commands: [{ type: "SET_ROOM", room: "global" }] },
  { beat: 2, label: "Alex MIDI edit", commands: [{ type: "SELECT_PARTICIPANT", participantId: "p1" }, { type: "SET_ROOM", room: "participant" }, { type: "SET_PARTICIPANT_TAB", tab: "Create" }, { type: "TOGGLE_STEP", draftId: "midi-opening-bass", step: 0 }] },
  { beat: 3, label: "Velocity restraint", commands: [{ type: "SET_NOTE_VELOCITY", draftId: "midi-opening-bass", noteId: "midi-opening-bass-0", velocity: 0.62 }] },
  { beat: 4, label: "Share pulse-r1", commands: [{ type: "SHARE_CLIP" }] },
  { beat: 5, label: "Exchange visible", commands: [{ type: "SET_ROOM", room: "global" }, { type: "TOGGLE_EXCHANGE" }] },
  { beat: 6, label: "Jordan fork", commands: [{ type: "SELECT_PARTICIPANT", participantId: "p2" }, { type: "FORK_CLIP", clipId: "c1" }, { type: "CLAIM_CLIP", clipId: "c2" }] },
  { beat: 7, label: "Devices preview", commands: [{ type: "SET_PARTICIPANT_TAB", tab: "Devices" }, { type: "SET_DEVICE_PARAM", deviceId: "filter", value: 0.55 }] },
  { beat: 8, label: "Dock map filter", commands: [{ type: "SET_ROOM", room: "mixer" }, { type: "PIN_DOCK", slotIndex: 0, label: "Filter", sourceTrack: "Devices", sourceClip: "chain", sourceParam: "Filter · Cutoff" }] },
  { beat: 9, label: "Dock sweep", commands: [{ type: "SET_DOCK_VALUE", slotIndex: 0, value: 0.72 }] },
  { beat: 10, label: "Submit review", commands: [{ type: "SET_ROOM", room: "participant" }, { type: "SUBMIT_REVIEW", clipId: "c2" }] },
  { beat: 11, label: "Alex revise", commands: [{ type: "SELECT_PARTICIPANT", participantId: "p1" }, { type: "REVISE_CLIP", clipId: "c2" }] },
  { beat: 12, label: "Stage ready clip", commands: [{ type: "SET_ROOM", room: "global" }, { type: "MARK_READY", clipId: "c2" }, { type: "SELECT_EXCHANGE_CLIP", clipId: "c2" }, { type: "STAGE_CLIP", clipId: "c2", slotId: "s1" }] },
  { beat: 13, label: "Activate Shared Master", commands: [{ type: "ACTIVATE_SLOT", slotId: "s1" }, { type: "TOGGLE_TRANSPORT" }] },
  { beat: 14, label: "Sam melodic overlay", commands: [{ type: "SELECT_PARTICIPANT", participantId: "p3" }, { type: "SET_ROOM", room: "participant" }, { type: "PREVIEW_WORKSPACE", draftId: "midi-opening-guitar" }] },
  { beat: 15, label: "Second fork cycle", commands: [{ type: "SHARE_CLIP" }] },
  { beat: 16, label: "Capture delay", commands: [{ type: "SET_ROOM", room: "mixer" }, { type: "SET_DOCK_MODE", mode: "capture" }, { type: "SET_DOCK_VALUE", slotIndex: 1, value: 0.4 }] },
  { beat: 17, label: "Restart clean idle", commands: [{ type: "SET_ROOM", room: "global" }, { type: "RESTART_SESSION" }] },
];

export async function runPhase4Walkthrough(
  dispatch: (command: ShellCommand) => void = shellStore.dispatch.bind(shellStore),
  onStep?: (step: WalkthroughStep) => void,
): Promise<void> {
  for (const step of PHASE4_WALKTHROUGH) {
    onStep?.(step);
    for (const command of step.commands) dispatch(command);
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
  }
}

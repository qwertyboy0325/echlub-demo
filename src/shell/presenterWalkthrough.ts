/**
 * Phase 5 presenter walkthrough — projection-driven Follow camera, progressive lane launch.
 * Uses SET_PARTICIPANT_PROJECTION instead of SET_ROOM so Follow stays enabled.
 */
import type { ShellCommand } from "./domain/shellTypes";
import { shellStore } from "./domain/shellStore";
import type { ShellChoreographyEngine } from "./choreographyEngine";
import { dispatchNavigationCommand, runCommandChoreography } from "./choreographyRunner";
import { isNavigationCommand } from "./choreographyForCommand";

export interface WalkthroughStep {
  beat: number;
  label: string;
  commands: ShellCommand[];
  delayMs?: number;
  afterBar?: number;
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

/** Bounded Phase 5 arc — sparse → seven lanes → restart. Full cursor beats deferred to WP5.3. */
export const PHASE5_WALKTHROUGH: WalkthroughStep[] = [
  {
    beat: 1,
    label: "Sparse global · Follow on",
    commands: [{ type: "SET_ROOM", room: "global" }, { type: "ENABLE_FOLLOW" }],
  },
  {
    beat: 2,
    label: "Kai · piano LH edit",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" },
      { type: "TOGGLE_STEP", draftId: "kai-lh-sparse-4", step: 2 },
    ],
  },
  {
    beat: 3,
    label: "Launch Piano LH",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "LAUNCH_SLOT", slotId: "lane-1" },
    ],
  },
  {
    beat: 4,
    label: "Ryo · bass sparse",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p1", room: "participant", tab: "Create" },
      { type: "PREVIEW_WORKSPACE", draftId: "ryo-bass-sparse-4" },
    ],
    delayMs: 400,
  },
  {
    beat: 5,
    label: "Launch Bass",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p1", room: "global", tab: "Create" },
      { type: "LAUNCH_SLOT", slotId: "lane-2" },
    ],
  },
  {
    beat: 6,
    label: "Launch Drums",
    commands: [{ type: "LAUNCH_SLOT", slotId: "lane-3" }],
  },
  {
    beat: 7,
    label: "Kai · RH pad",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" },
      { type: "PREVIEW_WORKSPACE", draftId: "kai-rh-pad-4" },
    ],
    delayMs: 400,
  },
  {
    beat: 8,
    label: "Launch Piano RH",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "LAUNCH_SLOT", slotId: "lane-4" },
    ],
  },
  {
    beat: 9,
    label: "Ren · guitar comp",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "participant", tab: "Devices" },
      { type: "SET_DEVICE_PARAM", deviceId: "filter", value: 0.48 },
    ],
    delayMs: 400,
  },
  {
    beat: 10,
    label: "Launch Guitar",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Devices" },
      { type: "LAUNCH_SLOT", slotId: "lane-5" },
    ],
  },
  {
    beat: 11,
    label: "Mei · alto theme",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "participant", tab: "Create" },
      { type: "PREVIEW_WORKSPACE", draftId: "mei-alto-themeA-8" },
    ],
    delayMs: 400,
  },
  {
    beat: 12,
    label: "Launch Alto",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "global", tab: "Create" },
      { type: "LAUNCH_SLOT", slotId: "lane-6" },
    ],
  },
  {
    beat: 13,
    label: "Launch Tenor",
    commands: [{ type: "LAUNCH_SLOT", slotId: "lane-7" }],
  },
  {
    beat: 14,
    label: "Seven-lane payoff · transport on",
    commands: [{ type: "TOGGLE_TRANSPORT" }],
    delayMs: 800,
  },
  {
    beat: 15,
    label: "Restart sparse",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p1", room: "participant", tab: "Create" },
      { type: "RESTART_SESSION" },
      { type: "ENABLE_FOLLOW" },
    ],
  },
];

let walkthroughFlight: Promise<string[]> | null = null;
let walkthroughEpoch = 0;

export function bumpWalkthroughEpoch(): void {
  walkthroughEpoch += 1;
}

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

export interface Phase5WalkthroughOptions {
  choreographyEngine?: ShellChoreographyEngine | null;
  onMissingTarget?: (selector: string, step: WalkthroughStep) => void;
}

export async function runPhase5Walkthrough(
  dispatch: (command: ShellCommand) => void = shellStore.dispatch.bind(shellStore),
  onStep?: (step: WalkthroughStep) => void,
  options: Phase5WalkthroughOptions = {},
): Promise<string[]> {
  if (walkthroughFlight) return walkthroughFlight;
  const epoch = walkthroughEpoch;
  const { choreographyEngine = null, onMissingTarget } = options;
  walkthroughFlight = (async () => {
    const labels: string[] = [];
    try {
      choreographyEngine?.show();
      for (const step of PHASE5_WALKTHROUGH) {
        if (epoch !== walkthroughEpoch) break;
        labels.push(step.label);
        onStep?.(step);
        for (let commandIndex = 0; commandIndex < step.commands.length; commandIndex += 1) {
          const command = step.commands[commandIndex]!;
          if (epoch !== walkthroughEpoch) break;
          if (isNavigationCommand(command)) {
            await dispatchNavigationCommand(command, dispatch);
            continue;
          }
          const { missingTargets } = await runCommandChoreography(
            command,
            step,
            commandIndex,
            choreographyEngine,
          );
          for (const selector of missingTargets) {
            onMissingTarget?.(selector, step);
          }
          dispatch(command);
          if (command.type === "RESTART_SESSION") bumpWalkthroughEpoch();
        }
        if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
      }
    } finally {
      choreographyEngine?.hide();
      walkthroughFlight = null;
    }
    return labels;
  })();
  return walkthroughFlight;
}

export async function runPhase5WalkthroughRange(
  fromBeat: number,
  toBeat: number,
  dispatch: (command: ShellCommand) => void = shellStore.dispatch.bind(shellStore),
): Promise<string[]> {
  const labels: string[] = [];
  for (const step of PHASE5_WALKTHROUGH.filter((entry) => entry.beat >= fromBeat && entry.beat <= toBeat)) {
    labels.push(step.label);
    for (const command of step.commands) dispatch(command);
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
  }
  return labels;
}

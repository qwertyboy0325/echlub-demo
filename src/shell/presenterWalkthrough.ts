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
  /** After step commands, wait until transport advances this many bars. */
  afterBar?: number;
  /** Wait until transport reaches this absolute bar (continuous payoff). */
  waitUntilBar?: number;
}

export const PHASE4_WALKTHROUGH: WalkthroughStep[] = [
  { beat: 1, label: "Sparse global session", commands: [{ type: "SET_ROOM", room: "global" }] },
  { beat: 2, label: "Alex MIDI edit", commands: [{ type: "SELECT_PARTICIPANT", participantId: "p1" }, { type: "SET_ROOM", room: "participant" }, { type: "SET_PARTICIPANT_TAB", tab: "Create" }, { type: "TOGGLE_STEP", draftId: "midi-opening-bass", step: 0 }] },
  { beat: 3, label: "Velocity restraint", commands: [{ type: "SET_NOTE_VELOCITY", draftId: "midi-opening-bass", noteId: "midi-opening-bass-0", velocity: 0.62 }] },
  { beat: 4, label: "Share midi-opening-bass", commands: [{ type: "SHARE_CLIP" }] },
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

/** Phase 5 arc — transport first, authored lanes, fork before 2nd launch, Ren fork before payoff. */
export const PHASE5_WALKTHROUGH: WalkthroughStep[] = [
  {
    beat: 1,
    label: "Sparse global reset",
    commands: [{ type: "SET_ROOM", room: "global" }],
  },
  {
    beat: 2,
    label: "Start transport",
    commands: [{ type: "TOGGLE_TRANSPORT" }],
    afterBar: 1,
  },
  {
    beat: 3,
    label: "Kai · Keys Desk · creating LH",
    commands: [
      { type: "ENABLE_FOLLOW" },
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" },
      { type: "SET_CREATE_SUBMODE", mode: "piano" },
      { type: "SELECT_PIANO_NOTE", draftId: "kai-lh-sparse-4", noteId: "kai-lh-sparse-4-n0" },
    ],
    afterBar: 1,
  },
  {
    beat: 4,
    label: "Kai · velocity restraint",
    commands: [
      { type: "SET_NOTE_VELOCITY", draftId: "kai-lh-sparse-4", noteId: "kai-lh-sparse-4-n0", velocity: 0.68 },
    ],
    afterBar: 1,
  },
  {
    beat: 5,
    label: "Kai · shaping LH phrase",
    commands: [
      { type: "EDIT_NOTE_STEP", draftId: "kai-lh-sparse-4", noteId: "kai-lh-sparse-4-n1", step: 3 },
      { type: "PREVIEW_WORKSPACE", draftId: "kai-lh-sparse-4" },
    ],
    afterBar: 1,
  },
  {
    beat: 6,
    label: "Kai · share LH",
    commands: [{ type: "SHARE_CLIP" }, { type: "SET_EXCHANGE_OPEN", open: true }],
    delayMs: 500,
  },
  {
    beat: 7,
    label: "Kai → Shared Master · stage LH",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "MARK_READY", clipId: "c1" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c1" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "STAGE_CLIP", clipId: "c1", slotId: "lane-1" },
    ],
    delayMs: 400,
  },
  {
    beat: 8,
    label: "Launch Piano LH",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c1" },
      { type: "LAUNCH_SLOT", slotId: "lane-1" },
    ],
    afterBar: 2,
  },
  {
    beat: 9,
    label: "Ryo · Rhythm Desk · creating bass",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p1", room: "participant", tab: "Create" },
      { type: "SET_CREATE_SUBMODE", mode: "step" },
      { type: "TOGGLE_STEP", draftId: "ryo-bass-sparse-4", step: 2 },
    ],
    afterBar: 1,
  },
  {
    beat: 10,
    label: "Ryo · preview + share bass",
    commands: [
      { type: "PREVIEW_WORKSPACE", draftId: "ryo-bass-sparse-4" },
      { type: "SHARE_CLIP" },
      { type: "SET_EXCHANGE_OPEN", open: true },
    ],
    delayMs: 500,
  },
  {
    beat: 11,
    label: "Kai · fork Ryo bass",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" },
      { type: "FORK_CLIP", clipId: "c2" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c3" },
      { type: "SET_EXCHANGE_OPEN", open: true },
    ],
    delayMs: 400,
  },
  {
    beat: 12,
    label: "Kai · submit bass fork",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "SUBMIT_REVIEW", clipId: "c3" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c3" },
      { type: "SET_EXCHANGE_OPEN", open: true },
    ],
    delayMs: 400,
  },
  {
    beat: 13,
    label: "Kai · revise bass fork",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" },
      { type: "REVISE_CLIP", clipId: "c3" },
      { type: "SET_CREATE_SUBMODE", mode: "step" },
      { type: "TOGGLE_STEP", draftId: "ryo-bass-sparse-4-fork-3", step: 4 },
      { type: "SUBMIT_REVIEW", clipId: "c3" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c3" },
      { type: "SET_EXCHANGE_OPEN", open: true },
    ],
    delayMs: 450,
  },
  {
    beat: 14,
    label: "Kai · compare bass fork",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c3" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "PREVIEW_WORKSPACE", draftId: "ryo-bass-sparse-4" },
      { type: "PREVIEW_WORKSPACE", draftId: "ryo-bass-sparse-4-fork-3" },
    ],
    delayMs: 450,
  },
  {
    beat: 15,
    label: "Kai · accept bass fork",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "MARK_READY", clipId: "c3" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c3" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "STAGE_CLIP", clipId: "c3", slotId: "lane-2" },
    ],
    delayMs: 400,
  },
  {
    beat: 16,
    label: "Launch Bass",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c3" },
      { type: "LAUNCH_SLOT", slotId: "lane-2" },
    ],
    afterBar: 2,
  },
  {
    beat: 17,
    label: "Exchange: ryo-entry-4 · Launch Drums",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p1", room: "global", tab: "Create" },
      { type: "NOTE_PRELOAD_PROVENANCE", materialId: "ryo-entry-4" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c3" },
      { type: "LAUNCH_SLOT", slotId: "lane-3" },
    ],
    afterBar: 2,
  },
  {
    beat: 18,
    label: "At Kai · Keys Desk · RH pad + filter",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Devices" },
      { type: "PREVIEW_WORKSPACE", draftId: "kai-rh-pad-4" },
      { type: "SET_DEVICE_PARAM", deviceId: "filter", value: 0.52 },
    ],
    delayMs: 500,
  },
  {
    beat: 19,
    label: "Exchange: kai-rh-pad-4 · Launch Piano RH",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "NOTE_PRELOAD_PROVENANCE", materialId: "kai-rh-pad-4" },
      { type: "LAUNCH_SLOT", slotId: "lane-4" },
    ],
    afterBar: 2,
  },
  {
    beat: 20,
    label: "Ren · Guitar Desk · creating guitar",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "participant", tab: "Create" },
      { type: "SET_CREATE_SUBMODE", mode: "clip" },
      { type: "PREVIEW_WORKSPACE", draftId: "ren-comp-2" },
      { type: "SET_DEVICE_PARAM", deviceId: "filter", value: 0.58 },
      { type: "SHARE_CLIP" },
      { type: "SET_EXCHANGE_OPEN", open: true },
    ],
    delayMs: 550,
  },
  {
    beat: 21,
    label: "Ren · fork guitar",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "participant", tab: "Devices" },
      { type: "FORK_CLIP", clipId: "c4" },
    ],
    delayMs: 400,
  },
  {
    beat: 22,
    label: "Ren → Shared Master · stage guitar",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Devices" },
      { type: "MARK_READY", clipId: "c4" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c4" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "STAGE_CLIP", clipId: "c4", slotId: "lane-5" },
    ],
    delayMs: 450,
  },
  {
    beat: 23,
    label: "Launch Guitar",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Devices" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c4" },
      { type: "LAUNCH_SLOT", slotId: "lane-5" },
    ],
    afterBar: 2,
  },
  {
    beat: 24,
    label: "Ren → Shared Master · queue alt guitar",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Devices" },
      { type: "MARK_READY", clipId: "c5" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c5" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "LAUNCH_SLOT", slotId: "lane-5", draftId: "ren-fork-alt-2" },
    ],
    afterBar: 4,
  },
  {
    beat: 25,
    label: "Mei · Horns Desk · creating alto",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "participant", tab: "Create" },
      { type: "SET_CREATE_SUBMODE", mode: "piano" },
      { type: "SELECT_PIANO_NOTE", draftId: "mei-alto-themeA-8", noteId: "mei-alto-themeA-8-n0" },
      { type: "SET_NOTE_VELOCITY", draftId: "mei-alto-themeA-8", noteId: "mei-alto-themeA-8-n0", velocity: 0.72 },
      { type: "PREVIEW_WORKSPACE", draftId: "mei-alto-themeA-8" },
    ],
    afterBar: 1,
  },
  {
    beat: 26,
    label: "Mei · share + stage alto",
    commands: [
      { type: "SHARE_CLIP" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "global", tab: "Create" },
      { type: "MARK_READY", clipId: "c6" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c6" },
      { type: "STAGE_CLIP", clipId: "c6", slotId: "lane-6" },
    ],
    delayMs: 500,
  },
  {
    beat: 27,
    label: "Launch Alto",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "global", tab: "Create" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c6" },
      { type: "LAUNCH_SLOT", slotId: "lane-6" },
    ],
    afterBar: 2,
  },
  {
    beat: 28,
    label: "Exchange: mei-tenor-entry-8 · Launch Tenor",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "global", tab: "Create" },
      { type: "NOTE_PRELOAD_PROVENANCE", materialId: "mei-tenor-entry-8" },
      { type: "LAUNCH_SLOT", slotId: "lane-7" },
    ],
    afterBar: 2,
  },
  {
    beat: 29,
    label: "Shared Mixer · Ren at Guitar desk",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "mixer", tab: "Mix" },
      { type: "PIN_DOCK", slotIndex: 0, label: "Filter", sourceTrack: "Devices", sourceClip: "chain", sourceParam: "Filter · Cutoff" },
      { type: "SET_DOCK_VALUE", slotIndex: 0, value: 0.72 },
    ],
    delayMs: 500,
  },
  {
    beat: 30,
    label: "Mei · Horns desk delay throw",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "mixer", tab: "Mix" },
      { type: "SET_DESK_BUS", desk: "horns", params: { delaySend: 0.45, reverbSend: 0.22 } },
    ],
    afterBar: 2,
  },
  {
    beat: 31,
    label: "Hold lead-a payoff",
    commands: [],
    waitUntilBar: 12,
    afterBar: 1,
  },
  {
    beat: 32,
    label: "Hold trade section · 7/7",
    commands: [],
    waitUntilBar: 20,
    afterBar: 1,
  },
  {
    beat: 33,
    label: "Perform · Shared Master · 7/7",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "SET_SESSION_PHASE", phase: "performing" },
    ],
    afterBar: 2,
  },
  {
    beat: 34,
    label: "Recall · kai-lh-sparse-4 → closing pad",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" },
      { type: "SET_WORKSPACE_DRAFT", draftId: "kai-lh-sparse-4", recallRole: "closing pad" },
      { type: "PREVIEW_WORKSPACE", draftId: "kai-lh-sparse-4" },
    ],
    delayMs: 500,
  },
  {
    beat: 35,
    label: "Audition then Promote · ren-fork-alt-2 ← ren-comp-2",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Devices" },
      { type: "SET_SESSION_PHASE", phase: "building" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c5" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "PREVIEW_WORKSPACE", draftId: "ren-comp-2" },
      { type: "PREVIEW_WORKSPACE", draftId: "ren-fork-alt-2" },
      { type: "PROMOTE_CLIP", clipId: "c5", slotId: "lane-5" },
    ],
    delayMs: 450,
    afterBar: 1,
  },
  {
    beat: 36,
    label: "Launch promoted fork · ren-fork-alt-2",
    commands: [
      { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Devices" },
      { type: "SELECT_EXCHANGE_CLIP", clipId: "c5" },
      { type: "SET_EXCHANGE_OPEN", open: true },
      { type: "LAUNCH_SLOT", slotId: "lane-5", draftId: "ren-fork-alt-2" },
    ],
    afterBar: 2,
  },
  {
    beat: 37,
    label: "Restart sparse global",
    commands: [{ type: "RESTART_SESSION" }],
  },
];

let walkthroughFlight: Promise<string[]> | null = null;
let walkthroughEpoch = 0;
let walkthroughPaused = false;

export function bumpWalkthroughEpoch(): void {
  walkthroughEpoch += 1;
}

export function setWalkthroughPaused(paused: boolean): void {
  walkthroughPaused = paused;
}

export function isWalkthroughPaused(): boolean {
  return walkthroughPaused;
}

async function waitWhilePaused(epoch: number): Promise<void> {
  while (walkthroughPaused && epoch === walkthroughEpoch) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function waitAfterBars(bars: number, epoch: number): Promise<void> {
  if (bars <= 0) return;
  const startBar = shellStore.getState().transportBar;
  const targetBar = startBar + bars;
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (epoch !== walkthroughEpoch) {
        resolve();
        return;
      }
      void waitWhilePaused(epoch).then(() => {
        if (shellStore.getState().transportBar >= targetBar) {
          resolve();
          return;
        }
        window.setTimeout(tick, 50);
      });
    };
    tick();
  });
}

async function waitUntilTransportBar(targetBar: number, epoch: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (epoch !== walkthroughEpoch) {
        resolve();
        return;
      }
      void waitWhilePaused(epoch).then(() => {
        if (shellStore.getState().transportBar >= targetBar) {
          resolve();
          return;
        }
        window.setTimeout(tick, 50);
      });
    };
    tick();
  });
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
  /** Capture-only: stop after this beat (default runs all beats). */
  maxBeat?: number;
}

export async function runPhase5Walkthrough(
  dispatch: (command: ShellCommand) => void = shellStore.dispatch.bind(shellStore),
  onStep?: (step: WalkthroughStep) => void,
  options: Phase5WalkthroughOptions = {},
): Promise<string[]> {
  if (walkthroughFlight) return walkthroughFlight;
  const epoch = walkthroughEpoch;
  walkthroughPaused = false;
  const { choreographyEngine = null, onMissingTarget, maxBeat } = options;
  walkthroughFlight = (async () => {
    const labels: string[] = [];
    try {
      choreographyEngine?.show();
      for (const step of PHASE5_WALKTHROUGH) {
        if (maxBeat != null && step.beat > maxBeat) break;
        if (epoch !== walkthroughEpoch) break;
        await waitWhilePaused(epoch);
        labels.push(step.label);
        onStep?.(step);
        for (let commandIndex = 0; commandIndex < step.commands.length; commandIndex += 1) {
          const command = step.commands[commandIndex]!;
          if (epoch !== walkthroughEpoch) break;
          await waitWhilePaused(epoch);
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
        }
        if (step.commands.some((command) => command.type === "RESTART_SESSION")) {
          bumpWalkthroughEpoch();
        }
        if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
        if (step.waitUntilBar != null) await waitUntilTransportBar(step.waitUntilBar, epoch);
        if (step.afterBar) await waitAfterBars(step.afterBar, epoch);
      }
    } finally {
      choreographyEngine?.hide();
      walkthroughFlight = null;
      walkthroughPaused = false;
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
    if (step.waitUntilBar != null) await waitUntilTransportBar(step.waitUntilBar, walkthroughEpoch);
    if (step.afterBar) await waitAfterBars(step.afterBar, walkthroughEpoch);
  }
  return labels;
}

export function getPhase5WalkthroughBeatCount(): number {
  return PHASE5_WALKTHROUGH.length;
}

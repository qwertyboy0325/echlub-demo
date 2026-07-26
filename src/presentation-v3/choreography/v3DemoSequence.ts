import type { ShellCommand } from "../../shell/domain/shellTypes";
import type { V3UiTargetKey } from "./v3UiTargets";

export type V3DemoAction =
  | { type: "click"; target: V3UiTargetKey }
  | { type: "scrub"; target: V3UiTargetKey; percent: number }
  | { type: "knob"; target: V3UiTargetKey; steps: number; direction: "up" | "down" }
  | { type: "projection"; command: ShellCommand }
  | { type: "open-exchange" }
  | { type: "hold"; ms: number };

export interface V3DemoBeat {
  id: string;
  label: string;
  caption: string;
  participantId: string;
  actions: V3DemoAction[];
  afterBar?: number;
  waitUntilBar?: number;
}

/** Bounded ~4–5 minute primary sequence for cold-viewer comprehension. */
export const V3_PRESENTATION_BEATS: V3DemoBeat[] = [
  {
    id: "b01-sparse-global",
    label: "Sparse global opening",
    caption: "Sparse Shared Master",
    participantId: "p2",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" } },
      { type: "hold", ms: 3000 },
    ],
  },
  {
    id: "b02-transport-start",
    label: "Transport begins",
    caption: "Transport rolling",
    participantId: "p2",
    actions: [{ type: "click", target: "transport-play" }],
    afterBar: 1,
  },
  {
    id: "b03-kai-piano-edit",
    label: "Kai shapes Piano LH",
    caption: "Kai shapes Piano LH",
    participantId: "p2",
    actions: [
      { type: "projection", command: { type: "ENABLE_FOLLOW" } },
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "participant", tab: "Create" } },
      { type: "click", target: "create-mode-piano" },
      { type: "click", target: "piano-note-kai-lh-sparse-4-n0" },
      { type: "scrub", target: "velocity-kai-lh-sparse-4-n0", percent: 68 },
    ],
    afterBar: 2,
  },
  {
    id: "b04-kai-preview",
    label: "Audible local Preview",
    caption: "Kai previews LH phrase",
    participantId: "p2",
    actions: [
      { type: "click", target: "preview-clip" },
      { type: "hold", ms: 9000 },
    ],
  },
  {
    id: "b05-kai-save-share",
    label: "Save and Share",
    caption: "Bass revision shared",
    participantId: "p2",
    actions: [
      { type: "click", target: "save-library" },
      { type: "hold", ms: 400 },
      { type: "click", target: "share-clip" },
      { type: "click", target: "exchange-toggle" },
      { type: "hold", ms: 600 },
    ],
  },
  {
    id: "b06-ryo-fork",
    label: "Ryo claims fork",
    caption: "Ryo forks Kai LH",
    participantId: "p1",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p1", room: "participant", tab: "Create" } },
      { type: "click", target: "exchange-toggle" },
      { type: "click", target: "exchange-clip-c1" },
      { type: "click", target: "exchange-primary-c1" },
      { type: "hold", ms: 800 },
    ],
  },
  {
    id: "b07-ryo-step-revision",
    label: "Ryo bounded revision",
    caption: "Ryo edits step pattern",
    participantId: "p1",
    actions: [
      { type: "click", target: "create-mode-step" },
      { type: "click", target: "step-cell-2" },
      { type: "click", target: "step-cell-5" },
      { type: "click", target: "preview-clip" },
      { type: "hold", ms: 5000 },
      { type: "click", target: "save-library" },
      { type: "click", target: "exchange-clip-c2" },
      { type: "click", target: "exchange-submit-c2" },
      { type: "hold", ms: 500 },
    ],
  },
  {
    id: "b08-ryo-ready",
    label: "Mark Ready",
    caption: "Drums revision ready",
    participantId: "p1",
    actions: [
      { type: "open-exchange" },
      { type: "click", target: "exchange-clip-c2" },
      { type: "click", target: "exchange-ready-c2" },
      { type: "hold", ms: 800 },
    ],
  },
  {
    id: "b09-stage-lanes",
    label: "Stage for Global",
    caption: "Staged for Shared Master",
    participantId: "p2",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" } },
      { type: "open-exchange" },
      { type: "click", target: "exchange-clip-c1" },
      { type: "click", target: "exchange-ready-c1" },
      { type: "click", target: "stage-clip-lane-1" },
      { type: "open-exchange" },
      { type: "click", target: "exchange-clip-c2" },
      { type: "click", target: "stage-clip-lane-2" },
      { type: "hold", ms: 400 },
    ],
  },
  {
    id: "b10-launch-piano",
    label: "Launch piano lane",
    caption: "Piano LH enters master",
    participantId: "p2",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" } },
      { type: "click", target: "launch-lane-1" },
    ],
    afterBar: 2,
  },
  {
    id: "b11-launch-drums",
    label: "Launch drums lane",
    caption: "Drums launch next bar",
    participantId: "p1",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p1", room: "global", tab: "Create" } },
      { type: "click", target: "launch-lane-3" },
    ],
    afterBar: 2,
  },
  {
    id: "b12-launch-pad",
    label: "Launch pad lane",
    caption: "Pad layer accumulates",
    participantId: "p2",
    actions: [{ type: "click", target: "launch-lane-4" }],
    afterBar: 2,
  },
  {
    id: "b13-launch-horns",
    label: "Launch tenor lane",
    caption: "Tenor joins payoff",
    participantId: "p3",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "global", tab: "Create" } },
      { type: "click", target: "launch-lane-7" },
    ],
    afterBar: 2,
  },
  {
    id: "b14-launch-guitar",
    label: "Ren enters payoff",
    caption: "Ren watches lane buildup",
    participantId: "p4",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Create" } },
      { type: "hold", ms: 2000 },
    ],
    afterBar: 2,
  },
  {
    id: "b15-payoff-hold",
    label: "Multi-lane payoff",
    caption: "Lanes accumulate on Shared Master",
    participantId: "p4",
    actions: [      { type: "hold", ms: 12000 },
    ],
    afterBar: 3,
  },
  {
    id: "b16-mixer-map",
    label: "Map Horns Delay to Dock",
    caption: "Horns Delay mapped to Dock",
    participantId: "p3",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p3", room: "mixer", tab: "Create" } },
      { type: "click", target: "room-mixer" },
      { type: "click", target: "mixer-select-horns" },
      { type: "click", target: "mixer-pin-horns-delay" },
      { type: "hold", ms: 600 },
    ],
  },
  {
    id: "b17-mixer-to-dock",
    label: "Mixer to Dock sync",
    caption: "Mixer drives Dock slot",
    participantId: "p3",
    actions: [
      { type: "scrub", target: "mixer-horns-delay", percent: 78 },
      { type: "hold", ms: 1200 },
    ],
  },
  {
    id: "b18-dock-to-mixer",
    label: "Dock to Mixer sync",
    caption: "Dock returns to Mixer",
    participantId: "p3",
    actions: [
      { type: "knob", target: "dock-slot-0", steps: 9, direction: "down" },
      { type: "hold", ms: 1200 },
    ],
  },
  {
    id: "b19-promote-revision",
    label: "Promoted guitar revision",
    caption: "Promoted fork replaces comp",
    participantId: "p4",
    actions: [
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "participant", tab: "Create" } },
      { type: "click", target: "participant-p4" },
      { type: "click", target: "share-clip" },
      { type: "open-exchange" },
      { type: "click", target: "exchange-clip-c3" },
      { type: "click", target: "exchange-ready-c3" },
      { type: "click", target: "stage-clip-lane-5" },
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p4", room: "global", tab: "Create" } },
      { type: "click", target: "room-global" },
      { type: "click", target: "launch-lane-5" },
    ],
    afterBar: 0,
  },
  {
    id: "b20-payoff-final",
    label: "Final payoff hold",
    caption: "Collaborative payoff",
    participantId: "p4",
    actions: [      { type: "hold", ms: 8000 }],
  },
  {
    id: "b21-restart",
    label: "Restart sparse baseline",
    caption: "Sparse session restored",
    participantId: "p2",
    actions: [
      { type: "click", target: "transport-restart" },
      { type: "projection", command: { type: "ENABLE_FOLLOW" } },
      { type: "projection", command: { type: "SET_PARTICIPANT_PROJECTION", participantId: "p2", room: "global", tab: "Create" } },
      { type: "hold", ms: 5000 },
    ],
  },
  {
    id: "b22-second-start",
    label: "Clean second start",
    caption: "Second run begins",
    participantId: "p2",
    actions: [
      { type: "click", target: "transport-play" },
      { type: "hold", ms: 8000 },
    ],
  },
];

export function allV3DemoActionTargets(): V3UiTargetKey[] {
  const keys = new Set<V3UiTargetKey>();
  for (const beat of V3_PRESENTATION_BEATS) {
    for (const action of beat.actions) {
      if (action.type === "click" || action.type === "scrub" || action.type === "knob") {
        keys.add(action.target);
      }
    }
  }
  return [...keys];
}

import { scenes, defaultMix, initialDrafts, BPM, TOTAL_BARS, scenePlacementHints } from "../musicData";
import { performanceScript } from "../performanceScript";
import type { ReconstructionPack } from "./reconstructionPack";
import type { Participant, ProductionAction, TrackDefinition, Workspace } from "./sessionTypes";
import type { BrainId, PatternDraft } from "../types";

const PRODUCTION_PARTICIPANTS: Participant[] = [
  { id: "p-rhythm", roleId: "rhythm", displayName: "Rhythm Producer", performanceBrain: "pulse", workspaceIds: ["ws-rhythm"] },
  { id: "p-perc", roleId: "percussion", displayName: "Percussion Producer", performanceBrain: "pulse", workspaceIds: ["ws-perc"] },
  { id: "p-bass", roleId: "bass", displayName: "Bass Producer", workspaceIds: ["ws-bass"] },
  { id: "p-harmony", roleId: "harmony", displayName: "Harmony / Keys Producer", performanceBrain: "blend", workspaceIds: ["ws-harmony"] },
  { id: "p-melody", roleId: "melody", displayName: "Melody Arranger", performanceBrain: "memory", workspaceIds: ["ws-melody"] },
  { id: "p-texture", roleId: "texture", displayName: "Texture / Sound Designer", performanceBrain: "blend", workspaceIds: ["ws-texture"] },
  { id: "p-mix", roleId: "mix", displayName: "Mix / FX Engineer", performanceBrain: "blend", workspaceIds: ["ws-mix"] },
  { id: "p-arrange", roleId: "arrangement", displayName: "Arrangement Director", performanceBrain: "story", workspaceIds: ["ws-arrange"] },
];

const BASS_SEED_NOTES: PatternDraft[] = [
  {
    id: "bass-main",
    owner: "pulse",
    title: "Main bass",
    kind: "bass",
    status: "editing",
    revision: 0,
    notes: [
      { id: "bass-main-0", step: 0, pitch: 0, note: "A2", duration: "8n", velocity: 0.48 },
      { id: "bass-main-1", step: 2, pitch: 0, note: "A2", duration: "8n", velocity: 0.48 },
      { id: "bass-main-2", step: 4, pitch: 0, note: "F2", duration: "8n", velocity: 0.48 },
      { id: "bass-main-3", step: 6, pitch: 0, note: "F2", duration: "8n", velocity: 0.48 },
      { id: "bass-main-4", step: 8, pitch: 0, note: "C3", duration: "8n", velocity: 0.48 },
      { id: "bass-main-5", step: 10, pitch: 0, note: "C3", duration: "8n", velocity: 0.48 },
      { id: "bass-main-6", step: 12, pitch: 0, note: "G2", duration: "8n", velocity: 0.48 },
      { id: "bass-main-7", step: 14, pitch: 0, note: "G2", duration: "8n", velocity: 0.48 },
    ],
  },
  {
    id: "bass-alt",
    owner: "pulse",
    title: "Alt bass",
    kind: "bass",
    status: "editing",
    revision: 0,
    notes: [
      { id: "bass-alt-0", step: 0, pitch: 0, note: "A2", duration: "8n", velocity: 0.48 },
      { id: "bass-alt-1", step: 2, pitch: 0, note: "C3", duration: "8n", velocity: 0.48 },
      { id: "bass-alt-2", step: 4, pitch: 0, note: "F2", duration: "8n", velocity: 0.48 },
      { id: "bass-alt-3", step: 6, pitch: 0, note: "A2", duration: "8n", velocity: 0.48 },
    ],
  },
];

const TRACKS: TrackDefinition[] = [
  { id: "track-drums", label: "Drums", layerKind: "drums", draftIds: ["pulse-sparse", "pulse-full", "pulse-break"], gain: 0.78 },
  { id: "track-bass", label: "Bass", layerKind: "bass", draftIds: ["bass-main", "bass-alt"], gain: 0.7 },
  { id: "track-harmony", label: "Harmony", layerKind: "harmony", draftIds: ["story-opening", "story-release"], gain: 0.62 },
  { id: "track-melody", label: "Melody", layerKind: "melody", draftIds: ["memory-opening", "memory-main", "memory-response"], gain: 0.72 },
  { id: "track-texture", label: "Texture", layerKind: "texture", draftIds: ["blend-warm", "blend-filtered", "blend-release"], gain: 0.58 },
];

const WORKSPACES: Workspace[] = [
  { id: "ws-rhythm", participantId: "p-rhythm", label: "Groove grid", trackIds: ["track-drums"], focusPriority: 1 },
  { id: "ws-perc", participantId: "p-perc", label: "Percussion lane", trackIds: ["track-drums"], focusPriority: 2 },
  { id: "ws-bass", participantId: "p-bass", label: "Bass editor", trackIds: ["track-bass"], focusPriority: 3 },
  { id: "ws-harmony", participantId: "p-harmony", label: "Harmony keys", trackIds: ["track-harmony"], focusPriority: 4 },
  { id: "ws-melody", participantId: "p-melody", label: "Melody roll", trackIds: ["track-melody"], focusPriority: 5 },
  { id: "ws-texture", participantId: "p-texture", label: "Texture design", trackIds: ["track-texture"], focusPriority: 6 },
  { id: "ws-mix", participantId: "p-mix", label: "Mix console", trackIds: TRACKS.map((t) => t.id), focusPriority: 7 },
  { id: "ws-arrange", participantId: "p-arrange", label: "Arrangement timeline", trackIds: TRACKS.map((t) => t.id), focusPriority: 8 },
];

/** 28-action production choreography covering all eight roles. */
const PRODUCTION_CHOREOGRAPHY: ProductionAction[] = [
  { id: "prod-01", atBeat: 0, participantId: "p-melody", workspaceId: "ws-melody", kind: "addNote", target: "memory-opening", value: 0, label: "Sketch opening fragment" },
  { id: "prod-02", atBeat: 4, participantId: "p-rhythm", workspaceId: "ws-rhythm", kind: "toggleStep", target: "pulse-sparse", value: 0, label: "Lay sparse kick pattern" },
  { id: "prod-03", atBeat: 8, participantId: "p-perc", workspaceId: "ws-perc", kind: "toggleStep", target: "pulse-sparse", value: 6, label: "Add percussion accent" },
  { id: "prod-04", atBeat: 12, participantId: "p-melody", workspaceId: "ws-melody", kind: "addNote", target: "memory-opening", value: 3, label: "Extend melody phrase" },
  { id: "prod-05", atBeat: 16, participantId: "p-bass", workspaceId: "ws-bass", kind: "editBass", target: "bass-main", value: 0, label: "Write main bass line" },
  { id: "prod-06", atBeat: 20, participantId: "p-harmony", workspaceId: "ws-harmony", kind: "editHarmony", target: "story-opening", value: 0, label: "Voice opening harmony" },
  { id: "prod-07", atBeat: 24, participantId: "p-texture", workspaceId: "ws-texture", kind: "editTexture", target: "blend-warm", value: 0.1, label: "Design warm texture" },
  { id: "prod-08", atBeat: 28, participantId: "p-melody", workspaceId: "ws-melody", kind: "previewDraft", target: "memory-opening", label: "Private preview fragment" },
  { id: "prod-09", atBeat: 32, participantId: "p-melody", workspaceId: "ws-melody", kind: "offerDraft", target: "memory-opening", label: "Offer opening to collaborators" },
  { id: "prod-10", atBeat: 36, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "acceptDraft", target: "memory-opening", label: "Accept opening draft" },
  { id: "prod-11", atBeat: 40, participantId: "p-rhythm", workspaceId: "ws-rhythm", kind: "toggleStep", target: "pulse-full", value: 0, label: "Build full groove" },
  { id: "prod-12", atBeat: 44, participantId: "p-perc", workspaceId: "ws-perc", kind: "createVariation", target: "pulse-full", value: 11, label: "Percussion variation" },
  { id: "prod-13", atBeat: 48, participantId: "p-melody", workspaceId: "ws-melody", kind: "addNote", target: "memory-main", value: 0, label: "Write main phrase" },
  { id: "prod-14", atBeat: 52, participantId: "p-melody", workspaceId: "ws-melody", kind: "addNote", target: "memory-main", value: 2, label: "Extend main phrase" },
  { id: "prod-15", atBeat: 56, participantId: "p-mix", workspaceId: "ws-mix", kind: "adjustFilter", target: "filter", value: 1450, label: "Shape filter for groove" },
  { id: "prod-16", atBeat: 60, participantId: "p-mix", workspaceId: "ws-mix", kind: "adjustDelay", target: "delayWet", value: 0.22, label: "Set delay send" },
  { id: "prod-17", atBeat: 64, participantId: "p-mix", workspaceId: "ws-mix", kind: "adjustGain", target: "groove", value: 64, label: "Balance groove fader" },
  { id: "prod-18", atBeat: 68, participantId: "p-mix", workspaceId: "ws-mix", kind: "captureFx", label: "Capture FX snapshot" },
  { id: "prod-19", atBeat: 72, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "placeInScene", target: "opening", label: "Place drafts in Opening scene" },
  { id: "prod-20", atBeat: 76, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "placeInScene", target: "groove", label: "Assemble Groove scene" },
  { id: "prod-21", atBeat: 80, participantId: "p-melody", workspaceId: "ws-melody", kind: "addNote", target: "memory-response", value: 1, label: "Sketch response fragment" },
  { id: "prod-22", atBeat: 84, participantId: "p-harmony", workspaceId: "ws-harmony", kind: "editHarmony", target: "story-release", value: 0, label: "Voice release harmony" },
  { id: "prod-23", atBeat: 88, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "placeInScene", target: "tease", label: "Wire Tease scene" },
  { id: "prod-24", atBeat: 92, participantId: "p-rhythm", workspaceId: "ws-rhythm", kind: "toggleStep", target: "pulse-break", value: 4, label: "Create release break" },
  { id: "prod-25", atBeat: 96, participantId: "p-bass", workspaceId: "ws-bass", kind: "editBass", target: "bass-alt", value: 0, label: "Write alt bass for recompose" },
  { id: "prod-26", atBeat: 100, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "placeInScene", target: "release", label: "Assemble Main Release" },
  { id: "prod-27", atBeat: 104, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "createTransition", target: "recompose", label: "Bridge to recomposition" },
  { id: "prod-28", atBeat: 108, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "placeInScene", target: "recompose", label: "Add recomposition scene" },
  { id: "prod-29", atBeat: 112, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "placeInScene", target: "return", label: "Close with return scene" },
  { id: "prod-30", atBeat: 116, participantId: "p-arrange", workspaceId: "ws-arrange", kind: "assembleArrangement", label: "Lock canonical arrangement" },
];

const FOUR_BRAIN_PRESET = {
  id: "four-brain-performance",
  label: "Four-Brain performance view",
  brainOrder: ["memory", "pulse", "blend", "story"] as BrainId[],
  participantIds: ["p-melody", "p-rhythm", "p-mix", "p-arrange"],
};

export const placeholderReconstructionPack: ReconstructionPack = {
  metadata: {
    id: "placeholder-round3",
    title: "Original placeholder arrangement",
    bpm: BPM,
    prototypeOnly: true,
    source: "placeholder",
  },
  tempoMap: [{ bar: 0, bpm: BPM }],
  timeSignatures: [{ bar: 0, numerator: 4, denominator: 4 }],
  sections: scenes.map((s) => ({ id: s.id, label: s.title, startBar: s.startBar, bars: s.bars })),
  participants: PRODUCTION_PARTICIPANTS,
  workspaces: WORKSPACES,
  tracks: TRACKS,
  drafts: [...structuredClone(initialDrafts), ...structuredClone(BASS_SEED_NOTES)],
  scenes: structuredClone(scenes),
  defaultMix: structuredClone(defaultMix),
  arrangement: {
    id: "canonical-arrangement",
    title: "Canonical placeholder song",
    totalBars: TOTAL_BARS,
    scenes: scenes.map((s) => ({ sceneId: s.id, startBar: s.startBar })),
  },
  productionChoreography: PRODUCTION_CHOREOGRAPHY,
  livePerformanceChoreography: performanceScript,
  performanceViews: [FOUR_BRAIN_PRESET],
};

/** Expose hints for tests only — not a runtime authority. */
export { scenePlacementHints };

import type { PatternDraft, SceneDefinition } from "./types";

export const BPM = 92;
export const TOTAL_BARS = 40;

function noteId(draftId: string, step: number): string {
  return `note-${draftId}-${step}`;
}

export const initialDrafts: PatternDraft[] = [
  {
    id: "memory-opening",
    owner: "memory",
    title: "Opening fragment",
    kind: "melody",
    status: "editing",
    notes: [
      { id: noteId("memory-opening", 0), step: 0, pitch: 2, note: "E4", duration: "8n", velocity: 0.62 },
      { id: noteId("memory-opening", 3), step: 3, pitch: 1, note: "G4", duration: "8n", velocity: 0.58 },
      { id: noteId("memory-opening", 6), step: 6, pitch: 0, note: "A4", duration: "4n", velocity: 0.68 },
      { id: noteId("memory-opening", 12), step: 12, pitch: 1, note: "G4", duration: "8n", velocity: 0.52 },
    ],
  },
  {
    id: "memory-main",
    owner: "memory",
    title: "Main phrase",
    kind: "melody",
    status: "editing",
    notes: [
      { id: noteId("memory-main", 0), step: 0, pitch: 0, note: "A4", duration: "8n", velocity: 0.72 },
      { id: noteId("memory-main", 2), step: 2, pitch: 3, note: "C5", duration: "8n", velocity: 0.68 },
      { id: noteId("memory-main", 4), step: 4, pitch: 1, note: "B4", duration: "8n", velocity: 0.64 },
      { id: noteId("memory-main", 6), step: 6, pitch: 2, note: "G4", duration: "4n", velocity: 0.66 },
      { id: noteId("memory-main", 10), step: 10, pitch: 2, note: "E4", duration: "8n", velocity: 0.55 },
      { id: noteId("memory-main", 12), step: 12, pitch: 1, note: "G4", duration: "8n", velocity: 0.62 },
      { id: noteId("memory-main", 14), step: 14, pitch: 0, note: "A4", duration: "4n", velocity: 0.74 },
    ],
  },
  {
    id: "memory-response",
    owner: "memory",
    title: "Response fragment",
    kind: "melody",
    status: "editing",
    notes: [
      { id: noteId("memory-response", 1), step: 1, pitch: 3, note: "C5", duration: "8n", velocity: 0.58 },
      { id: noteId("memory-response", 5), step: 5, pitch: 1, note: "B4", duration: "8n", velocity: 0.54 },
      { id: noteId("memory-response", 9), step: 9, pitch: 0, note: "A4", duration: "8n", velocity: 0.56 },
      { id: noteId("memory-response", 13), step: 13, pitch: 3, note: "E5", duration: "8n", velocity: 0.62 },
    ],
  },
  {
    id: "pulse-sparse",
    owner: "pulse",
    title: "Sparse groove",
    kind: "drums",
    status: "editing",
    steps: [0, 6, 8, 14],
  },
  {
    id: "pulse-full",
    owner: "pulse",
    title: "Full groove",
    kind: "drums",
    status: "editing",
    steps: [0, 3, 6, 8, 11, 14],
  },
  {
    id: "pulse-break",
    owner: "pulse",
    title: "One-beat break",
    kind: "drums",
    status: "editing",
    steps: [4, 8, 11, 14],
  },
  {
    id: "blend-warm",
    owner: "blend",
    title: "Warm room",
    kind: "texture",
    status: "editing",
  },
  {
    id: "blend-filtered",
    owner: "blend",
    title: "Filtered memory",
    kind: "texture",
    status: "editing",
  },
  {
    id: "blend-release",
    owner: "blend",
    title: "Wide release",
    kind: "texture",
    status: "editing",
  },
  {
    id: "story-opening",
    owner: "story",
    title: "Opening scene",
    kind: "harmony",
    status: "editing",
  },
  {
    id: "story-release",
    owner: "story",
    title: "Main release scene",
    kind: "harmony",
    status: "editing",
  },
];

export const defaultMix = {
  filter: 1200,
  delayWet: 0.2,
  reverbWet: 0.42,
  masterGain: -3,
  faders: { groove: 64, harmony: 48, melody: 28, texture: 58 },
};

export const scenes: SceneDefinition[] = [
  {
    id: "opening",
    title: "Opening Memory",
    bars: 8,
    startBar: 0,
    description: "A blurred fragment appears before the groove has fully formed.",
    layers: { drums: null, bass: null, harmony: "harmony-soft", melody: "memory-opening", texture: "texture-air" },
    fx: { filter: 780, delayWet: 0.22, reverbWet: 0.58, masterGain: -4, faders: { groove: 20, harmony: 55, melody: 70, texture: 60 } },
  },
  {
    id: "groove",
    title: "Groove Established",
    bars: 8,
    startBar: 8,
    description: "The pulse settles while the opening memory remains incomplete.",
    layers: { drums: "pulse-sparse", bass: "bass-main", harmony: "harmony-main", melody: "memory-opening", texture: "texture-air" },
    fx: { filter: 1450, delayWet: 0.18, reverbWet: 0.42, masterGain: -3, faders: { groove: 64, harmony: 48, melody: 28, texture: 58 } },
  },
  {
    id: "tease",
    title: "Melody Tease",
    bars: 8,
    startBar: 16,
    description: "The main phrase is offered, but only a shortened form reaches the master.",
    layers: { drums: "pulse-full", bass: "bass-main", harmony: "harmony-main", melody: "memory-response", texture: "texture-dust" },
    fx: { filter: 1850, delayWet: 0.3, reverbWet: 0.4, masterGain: -2.5, faders: { groove: 72, harmony: 52, melody: 45, texture: 50 } },
  },
  {
    id: "release",
    title: "Main Release",
    bars: 8,
    startBar: 24,
    description: "A one-beat gap makes room for the full phrase and wider mix.",
    layers: { drums: "pulse-break", bass: "bass-main", harmony: "harmony-open", melody: "memory-main", texture: "texture-dust" },
    fx: { filter: 3200, delayWet: 0.2, reverbWet: 0.34, masterGain: -1.6, faders: { groove: 78, harmony: 62, melody: 72, texture: 55 } },
  },
  {
    id: "recompose",
    title: "Recomposition",
    bars: 4,
    startBar: 32,
    description: "The response fragment replaces the expected repeat while the groove thins.",
    layers: { drums: "pulse-sparse", bass: "bass-alt", harmony: "harmony-main", melody: "memory-response", texture: "texture-air" },
    fx: { filter: 2100, delayWet: 0.44, reverbWet: 0.5, masterGain: -2.4, faders: { groove: 45, harmony: 50, melody: 40, texture: 48 } },
  },
  {
    id: "return",
    title: "Return & Ending",
    bars: 4,
    startBar: 36,
    description: "The opening memory returns while the other layers progressively leave.",
    layers: { drums: null, bass: null, harmony: "harmony-soft", melody: "memory-opening", texture: "texture-air" },
    fx: { filter: 920, delayWet: 0.5, reverbWet: 0.66, masterGain: -4, faders: { groove: 10, harmony: 40, melody: 65, texture: 55 } },
  },
];

export function sceneForBar(bar: number): SceneDefinition {
  return [...scenes].reverse().find((scene) => bar >= scene.startBar) ?? scenes[0];
}

export function cloneDrafts(): Record<string, PatternDraft> {
  return Object.fromEntries(initialDrafts.map((d) => [d.id, structuredClone(d)]));
}

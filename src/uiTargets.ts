import type { BrainId } from "./types";

export interface UiTarget {
  id: string;
  brain: BrainId;
  selector: string;
}

export const UI_TARGETS: UiTarget[] = [
  { id: "memory-opening", brain: "memory", selector: '[data-draft-tab="memory-opening"]' },
  { id: "memory-main", brain: "memory", selector: '[data-draft-tab="memory-main"]' },
  { id: "memory-response", brain: "memory", selector: '[data-draft-tab="memory-response"]' },
  { id: "memory-grid", brain: "memory", selector: '[data-target="memory-grid"]' },
  { id: "private-cue", brain: "memory", selector: '[data-target="private-cue"]' },
  { id: "offer-memory", brain: "memory", selector: '[data-target="offer-memory"]' },
  { id: "pulse-sparse", brain: "pulse", selector: '[data-draft-tab="pulse-sparse"]' },
  { id: "pulse-full", brain: "pulse", selector: '[data-draft-tab="pulse-full"]' },
  { id: "pulse-break", brain: "pulse", selector: '[data-draft-tab="pulse-break"]' },
  { id: "pulse-grid", brain: "pulse", selector: '[data-target="pulse-grid"]' },
  { id: "quantize", brain: "pulse", selector: '[data-target="quantize"]' },
  { id: "offer-pulse", brain: "pulse", selector: '[data-target="offer-pulse"]' },
  { id: "blend-filtered", brain: "blend", selector: '[data-target="blend-filtered"]' },
  { id: "blend-warm", brain: "blend", selector: '[data-target="blend-warm"]' },
  { id: "blend-release", brain: "blend", selector: '[data-target="blend-release"]' },
  { id: "delay-send", brain: "blend", selector: '[data-target="delay-send"]' },
  { id: "fader-groove", brain: "blend", selector: '[data-fader="groove"]' },
  { id: "fader-harmony", brain: "blend", selector: '[data-fader="harmony"]' },
  { id: "fader-melody", brain: "blend", selector: '[data-fader="melody"]' },
  { id: "fader-texture", brain: "blend", selector: '[data-fader="texture"]' },
  { id: "shared-queue", brain: "story", selector: '[data-target="shared-queue"]' },
  { id: "hold-scene", brain: "story", selector: '[data-target="hold-scene"]' },
  { id: "commit-scene", brain: "story", selector: '[data-target="commit-scene"]' },
  { id: "opening", brain: "story", selector: '[data-story-scene="opening"]' },
  { id: "groove", brain: "story", selector: '[data-story-scene="groove"]' },
  { id: "tease", brain: "story", selector: '[data-story-scene="tease"]' },
  { id: "release", brain: "story", selector: '[data-story-scene="release"]' },
  { id: "recompose", brain: "story", selector: '[data-story-scene="recompose"]' },
  { id: "return", brain: "story", selector: '[data-story-scene="return"]' },
];

const targetMap = new Map(UI_TARGETS.map((t) => [t.id, t]));

export function resolveTarget(id: string): UiTarget | undefined {
  if (targetMap.has(id)) return targetMap.get(id);
  if (id.startsWith("note-")) return { id, brain: "memory", selector: `[data-note-id="${id}"]` };
  if (id.startsWith("seq-")) return { id, brain: "pulse", selector: `[data-seq-id="${id}"]` };
  if (id.startsWith("queue-item-")) return { id, brain: "story", selector: `[data-queue-id="${id}"]` };
  return undefined;
}

export function allTargetIds(): string[] {
  return UI_TARGETS.map((t) => t.id);
}

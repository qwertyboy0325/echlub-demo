import type { PerformanceScriptEvent, ScriptAction } from "./types";

export type EventClassification =
  | "human_authored"
  | "system_derived"
  | "audio_internal"
  | "presentation_only";

const CLASSIFICATION: Partial<Record<ScriptAction, EventClassification>> = {
  thought: "presentation_only",
  memory: "system_derived",
  focus: "human_authored",
  edit: "human_authored",
  preview: "human_authored",
  ready: "human_authored",
  offer: "human_authored",
  queue: "human_authored",
  launch: "human_authored",
  filter: "human_authored",
  delay: "human_authored",
  fader: "human_authored",
  quantize: "human_authored",
  toggleStep: "human_authored",
  addNote: "human_authored",
  moveNote: "human_authored",
  dragToQueue: "human_authored",
  scene: "presentation_only",
};

export function classifyEvent(event: PerformanceScriptEvent): EventClassification {
  return CLASSIFICATION[event.action] ?? "human_authored";
}

export function requiresChoreography(event: PerformanceScriptEvent): boolean {
  return classifyEvent(event) === "human_authored";
}

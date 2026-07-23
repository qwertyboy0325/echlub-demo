import type { ChoreographyStep } from "./types";

export const choreographyScript: ChoreographyStep[] = [
  // Memory opening workflow
  { eventId: "e02", actor: "memory", gesture: "move", target: "memory-opening", duration: 0.55, dwell: 0.2 },
  { eventId: "e03", actor: "memory", gesture: "click", target: "note-memory-opening-9", duration: 0.35, anticipation: 0.08, dwell: 0.3 },
  { eventId: "e03b", actor: "memory", gesture: "drag", target: "note-memory-opening-12", destination: "note-memory-opening-12", duration: 0.5, dwell: 0.25 },
  { eventId: "e05", actor: "memory", gesture: "click", target: "private-cue", duration: 0.4, dwell: 0.35 },
  { eventId: "e06", actor: "memory", gesture: "click", target: "memory-opening", duration: 0.45, dwell: 0.4 },

  // Blend filter
  { eventId: "e04", actor: "blend", gesture: "drag", target: "blend-filtered", duration: 0.85, dwell: 0.2, concurrentGroup: "opening" },
  { eventId: "e11", actor: "blend", gesture: "scrub", target: "blend-filtered", duration: 0.7, dwell: 0.15, concurrentGroup: "groove" },
  { eventId: "e20", actor: "blend", gesture: "scrub", target: "delay-send", duration: 0.65, dwell: 0.2 },
  { eventId: "e29", actor: "blend", gesture: "scrub", target: "delay-send", duration: 0.55, dwell: 0.15 },
  { eventId: "e34", actor: "blend", gesture: "scrub", target: "delay-send", duration: 0.6, dwell: 0.2 },
  { eventId: "e37", actor: "blend", gesture: "drag", target: "blend-filtered", duration: 0.75, dwell: 0.25 },

  // Story queue/launch
  { eventId: "e07", actor: "story", gesture: "drag", target: "memory-opening", destination: "shared-queue", duration: 0.75, dwell: 0.5 },
  { eventId: "e08", actor: "story", gesture: "click", target: "opening", duration: 0.5, dwell: 0.6 },
  { eventId: "e14", actor: "story", gesture: "drag", target: "pulse-sparse", destination: "shared-queue", duration: 0.7, dwell: 0.45 },
  { eventId: "e15", actor: "story", gesture: "click", target: "groove", duration: 0.5, dwell: 0.55 },
  { eventId: "e21", actor: "story", gesture: "drag", target: "memory-response", destination: "shared-queue", duration: 0.72, dwell: 0.45 },
  { eventId: "e22", actor: "story", gesture: "click", target: "tease", duration: 0.5, dwell: 0.55 },

  // Pulse sequencer workflow
  { eventId: "e09", actor: "pulse", gesture: "move", target: "pulse-sparse", duration: 0.35, dwell: 0.1 },
  { eventId: "e10", actor: "pulse", gesture: "click", target: "seq-pulse-sparse-3", duration: 0.2, dwell: 0.08 },
  { eventId: "e10b", actor: "pulse", gesture: "click", target: "seq-pulse-sparse-10", duration: 0.18, dwell: 0.08 },
  { eventId: "e10c", actor: "pulse", gesture: "click", target: "seq-pulse-sparse-6", duration: 0.18, dwell: 0.08 },
  { eventId: "e12", actor: "pulse", gesture: "click", target: "private-cue", duration: 0.35, dwell: 0.2 },
  { eventId: "e12b", actor: "pulse", gesture: "click", target: "quantize", duration: 0.35, dwell: 0.2 },
  { eventId: "e13", actor: "pulse", gesture: "click", target: "offer-pulse", duration: 0.35, dwell: 0.25 },
  { eventId: "e31", actor: "pulse", gesture: "drag", target: "pulse-sparse", destination: "shared-queue", duration: 0.65, dwell: 0.4 },

  // Memory main phrase + tease
  { eventId: "e16", actor: "memory", gesture: "move", target: "memory-main", duration: 0.5, dwell: 0.2 },
  { eventId: "e17", actor: "memory", gesture: "click", target: "memory-response", duration: 0.4, dwell: 0.3 },
  { eventId: "e18", actor: "memory", gesture: "click", target: "private-cue", duration: 0.4, dwell: 0.35 },
  { eventId: "e19", actor: "memory", gesture: "click", target: "offer-memory", duration: 0.45, dwell: 0.4 },
  { eventId: "e32", actor: "memory", gesture: "drag", target: "memory-response", destination: "shared-queue", duration: 0.68, dwell: 0.4 },
  { eventId: "e35", actor: "memory", gesture: "drag", target: "memory-opening", destination: "shared-queue", duration: 0.7, dwell: 0.4 },

  // Main release causal chain
  { eventId: "e23", actor: "pulse", gesture: "move", target: "pulse-break", duration: 0.35, dwell: 0.15, concurrentGroup: "release-prep" },
  { eventId: "e24", actor: "memory", gesture: "click", target: "memory-main", duration: 0.45, dwell: 0.35, concurrentGroup: "release-prep" },
  { eventId: "e25", actor: "blend", gesture: "scrub", target: "blend-release", duration: 0.65, dwell: 0.2, concurrentGroup: "release-prep" },
  { eventId: "e25b", actor: "blend", gesture: "drag", target: "fader-melody", duration: 0.9, dwell: 0.25, concurrentGroup: "release-prep" },
  { eventId: "e26", actor: "pulse", gesture: "click", target: "offer-pulse", duration: 0.35, dwell: 0.2, concurrentGroup: "release-prep" },
  { eventId: "e27", actor: "story", gesture: "drag", target: "release", destination: "shared-queue", duration: 0.8, dwell: 0.55 },
  { eventId: "e28", actor: "story", gesture: "click", target: "release", duration: 0.55, dwell: 0.7 },

  // Recompose + return
  { eventId: "e33", actor: "story", gesture: "click", target: "recompose", duration: 0.5, dwell: 0.45 },
  { eventId: "e36", actor: "story", gesture: "drag", target: "pulse-sparse", destination: "shared-queue", duration: 0.65, dwell: 0.4 },
  { eventId: "e38", actor: "story", gesture: "click", target: "return", duration: 0.55, dwell: 0.6 },

  // Extended capability live moments (assignment-routed, not BrainId)
  { eventId: "cap-lowend-cue", capabilityId: "cap-lowend", gesture: "move", target: "lowend-grid", duration: 0.5, dwell: 0.2 },
  { eventId: "cap-lowend-cue", capabilityId: "cap-lowend", gesture: "click", target: "lowend-private-cue", duration: 0.4, dwell: 0.35 },
  { eventId: "cap-harmony-revise", capabilityId: "cap-harmony", gesture: "move", target: "harmony-grid", duration: 0.5, dwell: 0.2 },
  { eventId: "cap-harmony-revise", capabilityId: "cap-harmony", gesture: "click", target: "harmony-voice", duration: 0.45, dwell: 0.4 },
];

export function stepsForEvent(eventId: string): ChoreographyStep[] {
  return choreographyScript.filter((s) => {
    if (s.eventId === eventId) return true;
    if (!s.eventId.startsWith(eventId)) return false;
    const suffix = s.eventId.slice(eventId.length);
    return /^[a-z]+$/.test(suffix);
  });
}

export function stepsByEventId(): Map<string, ChoreographyStep[]> {
  const map = new Map<string, ChoreographyStep[]>();
  for (const step of choreographyScript) {
    const baseId = step.eventId.replace(/[a-z]$/, "");
    const list = map.get(baseId) ?? [];
    list.push(step);
    map.set(baseId, list);
    if (!map.has(step.eventId)) map.set(step.eventId, [step]);
  }
  return map;
}

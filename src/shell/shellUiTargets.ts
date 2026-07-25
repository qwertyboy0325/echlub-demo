/**
 * Stable DOM hooks for Phase 5 cursor choreography (WP5.3).
 * Selectors use data-demo-target attributes on V2 shell controls.
 */

export type ShellUiTarget =
  | { kind: "participant"; participantId: string }
  | { kind: "launch-slot"; slotId: string }
  | { kind: "step-cell"; step: number }
  | { kind: "preview-clip" }
  | { kind: "device-knob"; deviceId: string }
  | { kind: "dock-slot"; slotIndex: number }
  | { kind: "transport-play" }
  | { kind: "transport-restart" }
  | { kind: "share-clip" }
  | { kind: "save-to-library" }
  | { kind: "desk-library" }
  | { kind: "fork-clip"; clipId: string }
  | { kind: "ready-clip"; clipId: string }
  | { kind: "accept-clip"; clipId: string }
  | { kind: "promote-clip"; clipId: string }
  | { kind: "revise-clip"; clipId: string }
  | { kind: "compare-listen-parent" }
  | { kind: "compare-listen-fork" }
  | { kind: "stage-clip"; slotId?: string }
  | { kind: "velocity-slider"; noteId: string }
  | { kind: "desk-delay"; desk: string }
  | { kind: "desk-mute"; desk: string }
  | { kind: "piano-note"; noteId: string }
  | { kind: "score-map" };

export function shellUiTargetId(target: ShellUiTarget): string {
  switch (target.kind) {
    case "participant":
      return `participant-${target.participantId}`;
    case "launch-slot":
      return `launch-slot-${target.slotId}`;
    case "step-cell":
      return `step-cell-${target.step}`;
    case "preview-clip":
      return "preview-clip";
    case "device-knob":
      return `device-knob-${target.deviceId}`;
    case "dock-slot":
      return `dock-slot-${target.slotIndex}`;
    case "transport-play":
      return "transport-play";
    case "transport-restart":
      return "transport-restart";
    case "share-clip":
      return "share-clip";
    case "save-to-library":
      return "save-to-library";
    case "desk-library":
      return "desk-library";
    case "fork-clip":
      return `fork-clip-${target.clipId}`;
    case "ready-clip":
      return `ready-clip-${target.clipId}`;
    case "accept-clip":
      return `accept-clip-${target.clipId}`;
    case "promote-clip":
      return `promote-clip-${target.clipId}`;
    case "revise-clip":
      return `revise-clip-${target.clipId}`;
    case "compare-listen-parent":
      return "compare-listen-parent";
    case "compare-listen-fork":
      return "compare-listen-fork";
    case "stage-clip":
      return target.slotId ? `stage-clip-${target.slotId}` : "stage-clip";
    case "velocity-slider":
      return `velocity-${target.noteId}`;
    case "desk-delay":
      return `desk-delay-${target.desk}`;
    case "desk-mute":
      return `desk-mute-${target.desk}`;
    case "piano-note":
      return `piano-note-${target.noteId}`;
    case "score-map":
      return "arrangement-score-map";
  }
}

export function selectorForShellUiTarget(target: ShellUiTarget): string {
  return `[data-demo-target="${shellUiTargetId(target)}"]`;
}

export function resolveShellUiTarget(
  target: ShellUiTarget,
  root: ParentNode = typeof document !== "undefined" ? document : (null as unknown as ParentNode),
): HTMLElement | null {
  if (!root) return null;
  const matches = root.querySelectorAll<HTMLElement>(selectorForShellUiTarget(target));
  for (const element of matches) {
    if (!element.classList.contains("sr-only")) return element;
  }
  return matches[0] ?? null;
}

/** Lane → default operator when a beat omits SET_PARTICIPANT_PROJECTION. */
export const LIVE_COLLAB_LAUNCH_OPERATORS: Record<string, string> = {
  "lane-1": "p2",
  "lane-2": "p1",
  "lane-3": "p1",
  "lane-4": "p2",
  "lane-5": "p4",
  "lane-6": "p3",
  "lane-7": "p3",
};

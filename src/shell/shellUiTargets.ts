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
  | { kind: "stage-clip" }
  | { kind: "piano-note"; noteId: string };

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
    case "stage-clip":
      return "stage-clip";
    case "piano-note":
      return `piano-note-${target.noteId}`;
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
  return root.querySelector<HTMLElement>(selectorForShellUiTarget(target));
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

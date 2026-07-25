import type { ArrangementSlot, ArrangementSlotState } from "./domain/shellTypes";

export function isLanePlayingState(state: ArrangementSlotState): boolean {
  return state === "playing" || state === "active";
}

export function isLaneLaunchableState(state: ArrangementSlotState): boolean {
  return state === "loaded" || state === "staged" || state === "playing" || state === "queued";
}

export function countPlayingLanes(slots: ArrangementSlot[]): number {
  return slots.filter((slot) => isLanePlayingState(slot.state)).length;
}

export function laneStateLabel(
  state: ArrangementSlotState,
  transportBar: number,
): string {
  switch (state) {
    case "empty":
      return "No clip";
    case "loaded":
      return "Loaded";
    case "queued":
      return `Queued · bar ${transportBar + 1}`;
    case "playing":
    case "active":
      return "Playing";
    case "staged":
      return "Ready to launch";
    default:
      return state;
  }
}

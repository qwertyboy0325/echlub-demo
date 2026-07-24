import type { ShellCommand } from "./shellTypes";
import { shellStore } from "./shellStore";

export function dispatch(command: ShellCommand): void {
  shellStore.dispatch(command);
}

export function stageClip(clipId: string, slotId: string): void {
  shellStore.dispatch({ type: "STAGE_CLIP", clipId, slotId });
}

export function activateSlot(slotId: string): void {
  shellStore.dispatch({ type: "ACTIVATE_SLOT", slotId });
}

export function reviseClip(clipId: string): void {
  shellStore.dispatch({ type: "REVISE_CLIP", clipId });
}

export { shellStore };

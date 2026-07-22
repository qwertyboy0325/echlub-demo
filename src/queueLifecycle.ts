import type { RuntimeState } from "./types";
import type { SceneExecutionTransaction } from "./sceneExecution";
import { formatPosition } from "./musicalPosition";
import type { MusicalPosition } from "./musicalPosition";

export function finalizeQueueForTransaction(
  state: RuntimeState,
  tx: SceneExecutionTransaction,
  position: MusicalPosition,
): void {
  const formatted = formatPosition(position);
  state.queue = state.queue.map((q) =>
    q.status === "queued" && !q.sceneId && q.executeAtBar <= position.bar
      ? { ...q, status: "archived" as const }
      : q,
  );
  state.queue = state.queue.map((q) =>
    q.status === "playing" && q.sceneId !== tx.sceneId
      ? { ...q, status: "executed" as const }
      : q,
  );
  state.queue = state.queue.map((q) => {
    if (q.boundaryId === tx.boundaryId || (q.sceneId === tx.sceneId && q.status === "queued")) {
      return { ...q, status: "playing" as const, boundaryId: tx.boundaryId };
    }
    return q;
  });
  tx.queueUpdatedAt = formatted;
  state.boundaryCountdown = null;
  state.previewBrain = null;
}

export function applyLaunchRuntimeState(
  state: RuntimeState,
  sceneId: string,
  _eventDetail: string,
): void {
  state.activeSceneId = sceneId;
  state.offeredDrafts = state.offeredDrafts.filter((id) => id !== sceneId);
}

export function queueExecutedBeforeTransaction(state: RuntimeState, boundaryId: string): boolean {
  return state.queue.some((q) => q.boundaryId === boundaryId && (q.status === "executed" || q.status === "playing"));
}

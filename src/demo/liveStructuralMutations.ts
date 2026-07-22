import { materialRefForDraft } from "../domain/sessionMaterialBank";
import type {
  AppliedLiveStructuralOperation,
  LiveStructuralOperation,
  ProductionSession,
} from "../domain/sessionTypes";

export interface LiveStructuralBoundaryResult {
  bar: number;
  applied: AppliedLiveStructuralOperation[];
}

function assertBoundaryBar(bar: number, label: string): void {
  if (!Number.isInteger(bar) || bar < 0) {
    throw new Error(`${label} must be a non-negative integer bar`);
  }
}

function assertPositiveBars(bars: number, label: string): void {
  if (!Number.isInteger(bars) || bars <= 0) {
    throw new Error(`${label} must be a positive integer bar count`);
  }
}

function sceneExists(session: ProductionSession, sceneId: string): boolean {
  return session.scenes.some((scene) => scene.id === sceneId);
}

function removalKey(sceneId: string, layer: string): string {
  return `${sceneId}/${layer}`;
}

function shiftArrangementFrom(session: ProductionSession, boundaryBar: number, bars: number): void {
  for (const ref of session.arrangement.scenes) {
    if (ref.startBar >= boundaryBar) ref.startBar += bars;
  }
  for (const scene of session.scenes) {
    if (scene.startBar >= boundaryBar) scene.startBar += bars;
  }
  session.arrangement.totalBars += bars;
}

function applyOperation(
  session: ProductionSession,
  operation: LiveStructuralOperation,
  appliedAtBar: number,
): AppliedLiveStructuralOperation {
  let description: string;

  switch (operation.kind) {
    case "hold": {
      assertPositiveBars(operation.bars, "hold");
      if (!sceneExists(session, operation.sceneId)) {
        throw new Error(`hold references unknown scene ${operation.sceneId}`);
      }
      const activeRef = [...session.arrangement.scenes]
        .sort((a, b) => b.startBar - a.startBar)
        .find((ref) => ref.startBar < operation.executeAtBar);
      if (activeRef?.sceneId !== operation.sceneId) {
        throw new Error(`hold expected ${operation.sceneId} before bar ${operation.executeAtBar}`);
      }
      const scene = session.scenes.find((candidate) => candidate.id === operation.sceneId)!;
      scene.bars += operation.bars;
      shiftArrangementFrom(session, operation.executeAtBar, operation.bars);
      description = `Held ${operation.sceneId} for ${operation.bars} bar(s)`;
      break;
    }
    case "replaceLayer": {
      const scene = session.scenes.find((candidate) => candidate.id === operation.sceneId);
      const draft = session.drafts[operation.draftId];
      if (!scene) throw new Error(`replaceLayer references unknown scene ${operation.sceneId}`);
      if (!draft) throw new Error(`replaceLayer references unknown draft ${operation.draftId}`);
      if (draft.kind !== operation.layer) {
        throw new Error(`replaceLayer cannot place ${draft.kind} draft on ${operation.layer}`);
      }
      scene.layers[operation.layer] = materialRefForDraft(draft);
      description = `Replaced ${operation.sceneId}/${operation.layer} with ${operation.draftId}@r${draft.revision}`;
      break;
    }
    case "removeLayer": {
      const scene = session.scenes.find((candidate) => candidate.id === operation.sceneId);
      if (!scene) throw new Error(`removeLayer references unknown scene ${operation.sceneId}`);
      const ref = scene.layers[operation.layer];
      if (!ref) throw new Error(`removeLayer found no ${operation.layer} layer in ${operation.sceneId}`);
      session.liveStructure.removedLayerRefs[removalKey(operation.sceneId, operation.layer)] = structuredClone(ref);
      scene.layers[operation.layer] = null;
      description = `Removed ${operation.sceneId}/${operation.layer}`;
      break;
    }
    case "restoreLayer": {
      const scene = session.scenes.find((candidate) => candidate.id === operation.sceneId);
      if (!scene) throw new Error(`restoreLayer references unknown scene ${operation.sceneId}`);
      const key = removalKey(operation.sceneId, operation.layer);
      const ref = session.liveStructure.removedLayerRefs[key];
      if (!ref) throw new Error(`restoreLayer has no saved ref for ${key}`);
      scene.layers[operation.layer] = structuredClone(ref);
      delete session.liveStructure.removedLayerRefs[key];
      description = `Restored ${operation.sceneId}/${operation.layer} to ${ref.draftId}@r${ref.revision}`;
      break;
    }
    case "extendScene": {
      assertPositiveBars(operation.bars, "extendScene");
      const scene = session.scenes.find((candidate) => candidate.id === operation.sceneId);
      const arrangementRef = session.arrangement.scenes.find((ref) => ref.sceneId === operation.sceneId);
      if (!scene || !arrangementRef) {
        throw new Error(`extendScene references unarranged scene ${operation.sceneId}`);
      }
      scene.bars += operation.bars;
      const originalEndBar = arrangementRef.startBar + scene.bars - operation.bars;
      shiftArrangementFrom(session, originalEndBar, operation.bars);
      description = `Extended ${operation.sceneId} by ${operation.bars} bar(s)`;
      break;
    }
    case "alternateTransition": {
      if (!sceneExists(session, operation.replacementSceneId)) {
        throw new Error(`alternateTransition references unknown scene ${operation.replacementSceneId}`);
      }
      const transitionRef = session.arrangement.scenes.find(
        (ref) => ref.startBar === operation.executeAtBar,
      );
      if (!transitionRef) {
        throw new Error(`alternateTransition found no transition at bar ${operation.executeAtBar}`);
      }
      const previous = transitionRef.sceneId;
      transitionRef.sceneId = operation.replacementSceneId;
      description = `Changed transition at bar ${operation.executeAtBar}: ${previous} to ${operation.replacementSceneId}`;
      break;
    }
    case "alternateEnding": {
      if (!sceneExists(session, operation.replacementSceneId)) {
        throw new Error(`alternateEnding references unknown scene ${operation.replacementSceneId}`);
      }
      const finalRef = [...session.arrangement.scenes].sort((a, b) => b.startBar - a.startBar)[0];
      if (!finalRef) throw new Error("alternateEnding requires an arranged scene");
      const previous = finalRef.sceneId;
      finalRef.sceneId = operation.replacementSceneId;
      description = `Changed ending: ${previous} to ${operation.replacementSceneId}`;
      break;
    }
  }

  return {
    operationId: operation.id,
    kind: operation.kind,
    requestedBar: operation.executeAtBar,
    appliedAtBar,
    description,
  };
}

/**
 * Queue a structural musical change without mutating scenes or arrangement.
 * The ProductionSession owns both intent and eventual result.
 */
export function queueLiveStructuralOperation(
  session: ProductionSession,
  operation: LiveStructuralOperation,
): void {
  assertBoundaryBar(operation.executeAtBar, "executeAtBar");
  if (
    session.liveStructure.pending.some((candidate) => candidate.id === operation.id)
    || session.liveStructure.applied.some((candidate) => candidate.operationId === operation.id)
  ) {
    throw new Error(`duplicate Live structural operation ${operation.id}`);
  }
  session.liveStructure.pending.push(structuredClone(operation));
  session.liveStructure.pending.sort(
    (a, b) => a.executeAtBar - b.executeAtBar || a.id.localeCompare(b.id),
  );
}

/** Apply exactly the operations assigned to this musical bar boundary. */
export function applyLiveStructuralBoundary(
  session: ProductionSession,
  bar: number,
): LiveStructuralBoundaryResult {
  assertBoundaryBar(bar, "boundary");
  const overdue = session.liveStructure.pending.find((operation) => operation.executeAtBar < bar);
  if (overdue) {
    throw new Error(`missed Live structural boundary ${overdue.executeAtBar} for ${overdue.id}`);
  }

  const due = session.liveStructure.pending.filter((operation) => operation.executeAtBar === bar);
  // Apply the whole boundary transaction to a clone first. A malformed sibling
  // operation cannot leave the authoritative session half-mutated.
  const workingSession = structuredClone(session);
  const applied = due.map((operation) => applyOperation(workingSession, operation, bar));
  if (due.length) {
    const dueIds = new Set(due.map((operation) => operation.id));
    workingSession.liveStructure.pending = workingSession.liveStructure.pending.filter(
      (operation) => !dueIds.has(operation.id),
    );
    workingSession.liveStructure.applied.push(...applied);
    Object.assign(session, workingSession);
  }
  return { bar, applied: structuredClone(applied) };
}

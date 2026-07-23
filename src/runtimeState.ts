import { boundaryIdForScene } from "./boundaryIds";
import { cloneDrafts, defaultMix, scenes } from "./musicData";
import { performanceScript } from "./performanceScript";
import { parsePosition, positionFromBarBeat } from "./musicalPosition";
import type {
  DraftStatus,
  PerformanceScriptEvent,
  QueuedOperation,
  RuntimeState,
} from "./types";
import type { ProductionSession } from "./domain/sessionTypes";
import { DRAFT_TRANSITIONS } from "./types";

export function createInitialState(): RuntimeState {
  return {
    activeSceneId: "idle",
    currentBar: 0,
    currentBeat: 0,
    currentSixteenth: 0,
    activeBrains: new Set(),
    thoughts: {
      memory: "Waiting to hear which fragment the piece needs.",
      pulse: "Watching the shared grid for a useful entry point.",
      blend: "Holding the mix in a narrow, distant space.",
      story: "The full phrase should arrive later, not now.",
    },
    drafts: cloneDrafts(),
    queue: [],
    offeredDrafts: [],
    history: [],
    lastAction: null,
    mix: structuredClone(defaultMix),
    activePatternId: "pulse-sparse",
    activeDraftId: "memory-opening",
    previewBrain: null,
    boundaryCountdown: null,
    recordingMode: false,
  };
}

export function canTransitionDraft(from: DraftStatus, to: DraftStatus): boolean {
  return DRAFT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionDraft(state: RuntimeState, draftId: string, to: DraftStatus): boolean {
  const draft = state.drafts[draftId];
  if (!draft) return false;
  if (!canTransitionDraft(draft.status, to)) return false;
  draft.status = to;
  return true;
}

export function applyCollaborationEvent(
  state: RuntimeState,
  event: PerformanceScriptEvent,
  script: readonly PerformanceScriptEvent[] = performanceScript,
): void {
  state.lastAction = event;
  if (event.action === "capability") return;
  if (!event.brain) return;
  state.activeBrains.add(event.brain);
  state.thoughts[event.brain] = event.detail;

  const statusByAction: Partial<Record<PerformanceScriptEvent["action"], DraftStatus>> = {
    edit: "editing",
    preview: "preview",
    ready: "ready",
    offer: "offered",
    queue: "queued",
    launch: "playing",
  };

  if (event.target && state.drafts[event.target]) {
    const next = statusByAction[event.action];
    if (next) transitionDraft(state, event.target, next);
  }

  switch (event.action) {
    case "focus":
      if (event.target) {
        if (state.drafts[event.target]) state.activeDraftId = event.target;
        if (event.target.startsWith("pulse-")) state.activePatternId = event.target;
      }
      break;
    case "preview":
      state.previewBrain = event.brain;
      break;
    case "offer":
      if (event.target && !state.offeredDrafts.includes(event.target)) {
        state.offeredDrafts.push(event.target);
      }
      break;
    case "toggleStep":
    case "quantize":
      break;
    case "filter":
    case "delay":
    case "fader":
    case "addNote":
    case "moveNote":
      break;
    case "queue": {
      const scene = scenes.find((s) => s.id === event.target);
      const launchEvent = script.find((e) => e.action === "launch" && e.target === event.target);
      const queuedAt = parsePosition(event.at);
      const executeAt = launchEvent
        ? parsePosition(launchEvent.at)
        : positionFromBarBeat(event.boundary?.bar ?? (scene?.startBar ?? state.currentBar + 4));
      const executeAtBar = executeAt.bar;
      const op: QueuedOperation = {
        id: `queue-item-${event.id}`,
        draftId: state.drafts[event.target ?? ""] ? event.target : undefined,
        sceneId: scene?.id,
        label: event.label,
        queuedAt,
        executeAt,
        executeAtBar,
        boundary: event.boundary?.type ?? "phrase",
        boundaryId: scene ? boundaryIdForScene(scene.id, executeAtBar) : undefined,
        status: "queued",
      };
      state.queue.push(op);
      if (event.target && state.drafts[event.target]) {
        transitionDraft(state, event.target, "queued");
      }
      state.boundaryCountdown = {
        label: op.boundaryId ?? `Queued for Bar ${executeAtBar + 1}`,
        boundaryId: op.boundaryId ?? `queue@${executeAtBar + 1}`,
        barsRemaining: Math.max(0, executeAtBar - state.currentBar),
        beatsRemaining: 0,
      };
      break;
    }
    case "launch":
      break;
    case "dragToQueue":
      if (event.target) {
        const queuedAt = parsePosition(event.at);
        const executeAt = positionFromBarBeat(event.boundary?.bar ?? state.currentBar + 2);
        const op: QueuedOperation = {
          id: `queue-item-${event.id}`,
          draftId: event.target,
          label: `Offered: ${state.drafts[event.target]?.title ?? event.target}`,
          queuedAt,
          executeAt,
          executeAtBar: executeAt.bar,
          boundary: "phrase",
          status: "queued",
        };
        state.queue.push(op);
        transitionDraft(state, event.target, "queued");
      }
      break;
  }
}

/** Backward-compatible collaboration entry point. It never originates musical content or mix. */
export const applyScriptEvent = applyCollaborationEvent;

export function projectSessionMusicalState(state: RuntimeState, session: ProductionSession): void {
  for (const [id, sessionDraft] of Object.entries(session.drafts)) {
    const projected = structuredClone(sessionDraft);
    const collaborationStatus = state.drafts[id]?.status;
    if (collaborationStatus) projected.status = collaborationStatus;
    state.drafts[id] = projected;
  }
  state.mix = structuredClone(session.mix);
}

export function updateBoundaryCountdown(state: RuntimeState): void {
  const next = state.queue.find((q) => q.status === "queued");
  if (!next) {
    state.boundaryCountdown = null;
    return;
  }
  const barsRemaining = Math.max(0, next.executeAtBar - state.currentBar);
  const beatsInBar = state.currentBeat;
  state.boundaryCountdown = {
    label: next.boundaryId ?? `Queued for Bar ${next.executeAtBar + 1}`,
    boundaryId: next.boundaryId ?? `queue@${next.executeAtBar + 1}`,
    barsRemaining,
    beatsRemaining: barsRemaining === 0 ? Math.max(0, 4 - beatsInBar) : barsRemaining * 4,
  };
}

export function resetState(state: RuntimeState): void {
  const recordingMode = state.recordingMode;
  const fresh = createInitialState();
  Object.assign(state, fresh);
  state.recordingMode = recordingMode;
}

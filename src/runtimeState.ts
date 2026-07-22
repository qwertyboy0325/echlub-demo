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

export function applyScriptEvent(state: RuntimeState, event: PerformanceScriptEvent): void {
  state.lastAction = event;
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
      if (event.target && state.drafts[event.target]?.steps) {
        const steps = state.drafts[event.target].steps!;
        const step = Number(event.value);
        const idx = steps.indexOf(step);
        if (idx >= 0) steps.splice(idx, 1);
        else steps.push(step);
        steps.sort((a, b) => a - b);
      }
      break;
    case "quantize":
      break;
    case "filter":
      if (typeof event.value === "number") state.mix.filter = event.value;
      break;
    case "delay":
      if (typeof event.value === "number") state.mix.delayWet = event.value;
      break;
    case "fader":
      if (event.target && typeof event.value === "number") {
        state.mix.faders[event.target] = event.value;
      }
      break;
    case "addNote":
      if (event.target && event.value && typeof event.value === "string") {
        const draft = state.drafts[event.target];
        if (draft?.notes) {
          const parsed = JSON.parse(event.value) as { step: number; pitch: number; note: string };
          const id = `note-${event.target}-${parsed.step}`;
          if (!draft.notes.find((n) => n.id === id)) {
            draft.notes.push({ id, step: parsed.step, pitch: parsed.pitch, note: parsed.note, duration: "8n", velocity: 0.6 });
            draft.notes.sort((a, b) => a.step - b.step);
          }
        }
      }
      break;
    case "moveNote":
      if (event.target && typeof event.value === "string") {
        const [noteId, newStep] = event.value.split(":");
        for (const draft of Object.values(state.drafts)) {
          const note = draft.notes?.find((n) => n.id === noteId);
          if (note) { note.step = Number(newStep); break; }
        }
      }
      break;
    case "queue": {
      const scene = scenes.find((s) => s.id === event.target);
      const launchEvent = performanceScript.find((e) => e.action === "launch" && e.target === event.target);
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

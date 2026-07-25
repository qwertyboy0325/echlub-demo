import { createShellStateForMode } from "./shellBootstrap";
import { isLiveCollabLaneSlot } from "./liveCollabShellFixtures";
import type { ExchangeClip, ShellCommand, ShellState } from "./shellTypes";

function participantName(state: ShellState, id: string): string {
  return state.participants.find((p) => p.id === id)?.name ?? id;
}

function pushActivity(state: ShellState, message: string): string[] {
  return [message, ...state.activityFeed].slice(0, 8);
}

function followProjection(state: ShellState): ShellState {
  const active = state.participants.find((p) => p.active);
  if (!active) return state;
  return {
    ...state,
    room: active.projectedRoom,
    participantTab: active.projectedTab,
    selectedParticipantId: active.id,
  };
}

function updateClip(state: ShellState, clipId: string, patch: Partial<ExchangeClip>): ShellState {
  return {
    ...state,
    exchangeClips: state.exchangeClips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
  };
}

export function shellReducer(state: ShellState, command: ShellCommand): ShellState {
  switch (command.type) {
    case "SET_ROOM":
      if (state.interactionFrozen) return state;
      return {
        ...state,
        room: command.room,
        followActive: false,
        followLocked: true,
      };
    case "SELECT_PARTICIPANT":
      if (state.interactionFrozen) return state;
      return {
        ...state,
        selectedParticipantId: command.participantId,
        followActive: false,
        followLocked: true,
        participants: state.participants.map((p) => ({
          ...p,
          active: p.id === command.participantId,
        })),
      };
    case "SET_PARTICIPANT_PROJECTION": {
      if (state.interactionFrozen) return state;
      const next = {
        ...state,
        selectedParticipantId: command.participantId,
        participants: state.participants.map((p) =>
          p.id === command.participantId
            ? { ...p, active: true, projectedRoom: command.room, projectedTab: command.tab }
            : { ...p, active: false },
        ),
      };
      if (next.followActive && !next.followLocked) return followProjection(next);
      return next;
    }
    case "ENABLE_FOLLOW":
      if (state.interactionFrozen) return state;
      return followProjection({ ...state, followActive: true, followLocked: false });
    case "RESUME_FOLLOW":
      if (state.interactionFrozen) return state;
      return followProjection({ ...state, followActive: true, followLocked: false });
    case "SET_INTERACTION_FROZEN":
      return { ...state, interactionFrozen: command.frozen };
    case "TOGGLE_EXCHANGE":
      return { ...state, exchangeOpen: !state.exchangeOpen };
    case "SET_PARTICIPANT_TAB":
      return { ...state, participantTab: command.tab };
    case "SET_CREATE_SUBMODE":
      return { ...state, createSubMode: command.mode };
    case "SHARE_CLIP": {
      const draftId = state.workspaceDraftId ?? "midi-opening-bass";
      const draft: ExchangeClip = {
        id: `c${state.exchangeClips.length + 1}`,
        title: `pulse-r${state.exchangeClips.length + 1}`,
        revision: 1,
        creatorId: state.selectedParticipantId,
        contributorId: null,
        lifecycle: "Available",
        thumbnail: "notes",
        lineageParentId: null,
        forkOf: null,
        draftId,
      };
      return {
        ...state,
        exchangeClips: [...state.exchangeClips, draft],
        activityFeed: pushActivity(state, `${participantName(state, draft.creatorId)} shared ${draft.title}`),
      };
    }
    case "FORK_CLIP": {
      const source = state.exchangeClips.find((c) => c.id === command.clipId);
      if (!source) return state;
      const forkDraftId = `${source.draftId ?? "draft"}-fork-${state.exchangeClips.length + 1}`;
      const fork: ExchangeClip = {
        id: `c${state.exchangeClips.length + 1}`,
        title: `${source.title}-r${source.revision + 1}`,
        revision: source.revision + 1,
        creatorId: source.creatorId,
        contributorId: state.selectedParticipantId,
        lifecycle: "In Progress",
        thumbnail: source.thumbnail,
        lineageParentId: source.id,
        forkOf: source.id,
        draftId: forkDraftId,
      };
      return {
        ...state,
        exchangeClips: [...state.exchangeClips, fork],
        selectedExchangeClipId: fork.id,
        workspaceDraftId: forkDraftId,
        activityFeed: pushActivity(state, `${participantName(state, fork.contributorId!)} forked ${source.title}`),
      };
    }
    case "CLAIM_CLIP":
      return {
        ...updateClip(state, command.clipId, {
          contributorId: state.selectedParticipantId,
          lifecycle: "In Progress",
        }),
        workspaceDraftId: state.exchangeClips.find((c) => c.id === command.clipId)?.draftId ?? state.workspaceDraftId,
      };
    case "SUBMIT_REVIEW":
      return updateClip(state, command.clipId, { lifecycle: "Review" });
    case "REVISE_CLIP": {
      const clip = state.exchangeClips.find((c) => c.id === command.clipId);
      if (!clip || clip.lifecycle !== "Review") return state;
      return updateClip(state, command.clipId, {
        lifecycle: "In Progress",
        revision: clip.revision + 1,
      });
    }
    case "MARK_READY":
      return updateClip(state, command.clipId, { lifecycle: "Ready" });
    case "STAGE_CLIP": {
      const clip = state.exchangeClips.find((c) => c.id === command.clipId);
      if (!clip || clip.lifecycle !== "Ready") return state;
      return {
        ...state,
        arrangementSlots: state.arrangementSlots.map((slot) =>
          slot.id === command.slotId
            ? { ...slot, clipId: clip.id, state: "staged", label: clip.title }
            : slot,
        ),
        activityFeed: pushActivity(state, `Staged ${clip.title} on ${command.slotId}`),
      };
    }
    case "ACTIVATE_SLOT": {
      const slot = state.arrangementSlots.find((s) => s.id === command.slotId);
      if (!slot || slot.state !== "staged" || !slot.clipId) return state;
      const clip = state.exchangeClips.find((c) => c.id === slot.clipId);
      return {
        ...state,
        arrangementSlots: state.arrangementSlots.map((s) => {
          if (s.id === command.slotId) return { ...s, state: "active" as const };
          if (s.state === "active") return { ...s, state: "empty" as const, clipId: null, label: "Empty slot" };
          return s;
        }),
        activeMasterDraftId: clip?.draftId ?? null,
        activityFeed: pushActivity(state, `Activated ${slot.label} on Shared Master`),
      };
    }
    case "LAUNCH_SLOT": {
      const slot = state.arrangementSlots.find((s) => s.id === command.slotId);
      if (!slot) return state;
      const laneSlot = isLiveCollabLaneSlot(command.slotId);
      const launchedLabel = command.draftId ?? slot.label;
      const activeCount =
        state.arrangementSlots.filter((s) => s.state === "active" && s.id !== command.slotId).length + 1;
      return {
        ...state,
        arrangementSlots: state.arrangementSlots.map((s) => {
          if (s.id === command.slotId) return { ...s, state: "active" as const, label: launchedLabel };
          if (!laneSlot && s.state === "active") {
            return { ...s, state: "empty" as const, clipId: null, label: "Empty slot" };
          }
          return s;
        }),
        activeMasterDraftId: laneSlot ? `live-collab-${activeCount}-lanes` : state.activeMasterDraftId,
        activityFeed: pushActivity(
          state,
          laneSlot
            ? `Launched ${launchedLabel} · ${activeCount}/7 lanes`
            : `Launched ${command.slotId}${command.draftId ? ` · ${command.draftId}` : ""}`,
        ),
      };
    }
    case "REORDER_EXCHANGE": {
      const map = new Map(state.exchangeClips.map((c) => [c.id, c]));
      const ordered = command.clipIds.map((id) => map.get(id)).filter(Boolean) as ExchangeClip[];
      if (ordered.length !== state.exchangeClips.length) return state;
      return { ...state, exchangeClips: ordered };
    }
    case "PIN_DOCK":
      return {
        ...state,
        dockSlots: state.dockSlots.map((slot) =>
          slot.index === command.slotIndex
            ? {
                ...slot,
                label: command.sourceParam ?? command.label,
                sourceTrack: command.sourceTrack ?? slot.sourceTrack,
                sourceClip: command.sourceClip ?? slot.sourceClip,
                sourceParam: command.sourceParam ?? command.label,
                mapped: true,
              }
            : slot,
        ),
      };
    case "SET_DOCK_VALUE":
      return {
        ...state,
        dockSlots: state.dockSlots.map((slot) =>
          slot.index === command.slotIndex ? { ...slot, value: command.value } : slot,
        ),
      };
    case "SYNC_DOCK_FROM_MIX": {
      if (!command.updates.length) return state;
      const byIndex = new Map(command.updates.map((u) => [u.index, u.value]));
      return {
        ...state,
        dockSlots: state.dockSlots.map((slot) => {
          const value = byIndex.get(slot.index);
          return value === undefined ? slot : { ...slot, value };
        }),
      };
    }
    case "SET_DOCK_MODE":
      return { ...state, dockMode: command.mode };
    case "SELECT_EXCHANGE_CLIP":
      return { ...state, selectedExchangeClipId: command.clipId };
    case "TOGGLE_TRANSPORT":
      return { ...state, transportPlaying: !state.transportPlaying };
    case "SYNC_TRANSPORT":
      return {
        ...state,
        transportBar: command.bar,
        transportBeat: command.beat,
        transportPlaying: command.playing,
      };
    case "EDIT_NOTE_STEP":
    case "SET_NOTE_VELOCITY":
    case "INSERT_NOTE":
    case "TOGGLE_STEP":
    case "PREVIEW_WORKSPACE":
      return state;
    case "SET_DEVICE_PARAM":
      return state;
    case "RESTART_SESSION":
      return {
        ...createShellStateForMode(),
        room: state.room,
        exchangeOpen: state.exchangeOpen,
      };
    case "SELECT_MIXER_CHANNEL":
      return { ...state, selectedMixerChannel: command.channelIndex };
    default:
      return state;
  }
}

export type ShellListener = (state: ShellState) => void;

export class ShellStore {
  private state: ShellState;
  private listeners = new Set<ShellListener>();

  constructor(initial = createShellStateForMode()) {
    this.state = initial;
  }

  getState(): ShellState {
    return this.state;
  }

  dispatch(command: ShellCommand): void {
    this.state = shellReducer(this.state, command);
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(listener: ShellListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const shellStore = new ShellStore(createShellStateForMode());

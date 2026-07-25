import { createShellStateForMode } from "./shellBootstrap";
import { isLiveCollabLaneSlot } from "./liveCollabShellFixtures";
import {
  activeWorkspaceDraftId,
  patchParticipantWorkspace,
  selectParticipantWorkspace,
  syncActiveWorkspaceFields,
} from "./participantWorkspace";
import {
  deskCreateCaption,
  deskEditCaption,
  exchangeSharedCaption,
  exchangeTitleForDraft,
  combinedSongCaption,
  laneLaunchCaption,
  librarySavedCaption,
  performCaption,
  preloadExchangeCaption,
  privateDeskHandoffCaption,
  promoteCaption,
  recallCaption,
} from "../handoffCaptions";
import { countPlayingLanes, isLaneLaunchableState } from "../laneSlotSemantics";
import type { DeskLibraryClip, ExchangeClip, ShellCommand, ShellState } from "./shellTypes";

function pushActivity(state: ShellState, message: string): string[] {
  return [message, ...state.activityFeed].slice(0, 8);
}

function followProjection(state: ShellState): ShellState {
  const active = state.participants.find((p) => p.active);
  if (!active) return state;
  const next = {
    ...state,
    room: active.projectedRoom,
    participantTab: active.projectedTab,
    selectedParticipantId: active.id,
    participants: state.participants.map((p) => ({ ...p, active: p.id === active.id })),
  };
  return syncActiveWorkspaceFields(
    patchParticipantWorkspace(next, active.id, { tab: active.projectedTab }),
    active.id,
  );
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
      {
        const nextRoom = command.room;
        const active =
          state.participants.find((p) => p.active) ??
          state.participants.find((p) => p.id === state.selectedParticipantId);
        const handoff =
          nextRoom === "participant" && active
            ? privateDeskHandoffCaption(active.name, active.taskProfile, state.participantTab)
            : null;
        return {
          ...state,
          room: nextRoom,
          followActive: false,
          followLocked: true,
          activityFeed: handoff ? pushActivity(state, handoff) : state.activityFeed,
        };
      }
    case "SELECT_PARTICIPANT":
      if (state.interactionFrozen) return state;
      return {
        ...selectParticipantWorkspace(state, command.participantId),
        followActive: false,
        followLocked: true,
        participants: state.participants.map((p) => ({
          ...p,
          active: p.id === command.participantId,
        })),
      };
    case "SET_PARTICIPANT_PROJECTION": {
      if (state.interactionFrozen) return state;
      const participant = state.participants.find((p) => p.id === command.participantId);
      const next = {
        ...state,
        selectedParticipantId: command.participantId,
        participants: state.participants.map((p) =>
          p.id === command.participantId
            ? { ...p, active: true, projectedRoom: command.room, projectedTab: command.tab }
            : { ...p, active: false },
        ),
      };
      const withFollow =
        next.followActive && !next.followLocked ? followProjection(next) : next;
      if (command.room === "participant" && command.tab === "Create" && participant) {
        const draftId = withFollow.workspaceDraftId;
        const caption = draftId
          ? deskEditCaption(draftId, "Create")
          : privateDeskHandoffCaption(participant.name, participant.taskProfile, "Create");
        return { ...withFollow, activityFeed: pushActivity(withFollow, caption) };
      }
      return withFollow;
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
    case "SET_EXCHANGE_OPEN":
      return { ...state, exchangeOpen: command.open };
    case "NOTE_PRELOAD_PROVENANCE":
      return {
        ...state,
        exchangeOpen: true,
        activityFeed: pushActivity(state, preloadExchangeCaption(command.materialId)),
      };
    case "SET_PARTICIPANT_TAB": {
      const next = patchParticipantWorkspace(state, state.selectedParticipantId, { tab: command.tab });
      const active = next.participants.find((p) => p.id === next.selectedParticipantId);
      if (next.room === "participant" && active && command.tab === "Create") {
        const draftId = next.workspaceDraftId;
        const caption = draftId
          ? deskEditCaption(draftId, "Create")
          : privateDeskHandoffCaption(active.name, active.taskProfile, "Create");
        return { ...next, activityFeed: pushActivity(next, caption) };
      }
      return next;
    }
    case "SET_CREATE_SUBMODE":
      return patchParticipantWorkspace(state, state.selectedParticipantId, { createSubMode: command.mode });
    case "SAVE_TO_LIBRARY": {
      const draftId = state.workspaceDraftId;
      if (!draftId) return state;
      const title = exchangeTitleForDraft(draftId);
      const ws = state.participantWorkspaces[state.selectedParticipantId];
      const existing = (ws?.libraryClips ?? []).find((clip) => clip.draftId === draftId);
      const saved: DeskLibraryClip = existing
        ? { ...existing, title, revision: existing.revision + 1 }
        : {
            id: `lib-${state.selectedParticipantId}-${(ws?.libraryClips?.length ?? 0) + 1}`,
            draftId,
            title,
            revision: 1,
          };
      const libraryClips = existing
        ? (ws?.libraryClips ?? []).map((clip) => (clip.draftId === draftId ? saved : clip))
        : [...(ws?.libraryClips ?? []), saved];
      const next = patchParticipantWorkspace(state, state.selectedParticipantId, { libraryClips });
      return {
        ...next,
        activityFeed: pushActivity(next, librarySavedCaption(title)),
      };
    }
    case "SHARE_CLIP": {
      const draftId = state.workspaceDraftId ?? "midi-opening-bass";
      const title = exchangeTitleForDraft(draftId);
      const already = state.exchangeClips.find(
        (c) => c.draftId === draftId && c.creatorId === state.selectedParticipantId && !c.forkOf,
      );
      if (already) {
        return {
          ...state,
          exchangeOpen: true,
          selectedExchangeClipId: already.id,
          activityFeed: pushActivity(state, exchangeSharedCaption(already.title)),
        };
      }
      const draft: ExchangeClip = {
        id: `c${state.exchangeClips.length + 1}`,
        title,
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
        exchangeOpen: true,
        selectedExchangeClipId: draft.id,
        exchangeClips: [...state.exchangeClips, draft],
        activityFeed: pushActivity(state, exchangeSharedCaption(draft.title)),
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
      const forked = {
        ...state,
        exchangeClips: [...state.exchangeClips, fork],
        selectedExchangeClipId: fork.id,
        activityFeed: pushActivity(state, `Exchange: ${source.title} forked`),
      };
      return patchParticipantWorkspace(forked, state.selectedParticipantId, { draftId: forkDraftId });
    }
    case "CLAIM_CLIP": {
      const claimedDraft =
        state.exchangeClips.find((c) => c.id === command.clipId)?.draftId ?? state.workspaceDraftId;
      return patchParticipantWorkspace(
        updateClip(state, command.clipId, {
          contributorId: state.selectedParticipantId,
          lifecycle: "In Progress",
        }),
        state.selectedParticipantId,
        { draftId: claimedDraft },
      );
    }
    case "SUBMIT_REVIEW":
      return updateClip(state, command.clipId, { lifecycle: "Review" });
    case "REVISE_CLIP": {
      const clip = state.exchangeClips.find((c) => c.id === command.clipId);
      if (!clip || clip.lifecycle !== "Review") return state;
      const revised = updateClip(state, command.clipId, {
        lifecycle: "In Progress",
        revision: clip.revision + 1,
      });
      const editorId = clip.contributorId ?? state.selectedParticipantId;
      return clip.draftId
        ? patchParticipantWorkspace(revised, editorId, { draftId: clip.draftId })
        : revised;
    }
    case "MARK_READY":
      return updateClip(state, command.clipId, { lifecycle: "Ready" });
    case "PROMOTE_CLIP": {
      const clip = state.exchangeClips.find((c) => c.id === command.clipId);
      if (!clip || clip.lifecycle !== "Ready" || !clip.forkOf) return state;
      const forkParent = state.exchangeClips.find((c) => c.id === clip.forkOf);
      const laneSlot = isLiveCollabLaneSlot(command.slotId);
      const slotLabel = forkParent
        ? `${clip.draftId ?? clip.title} ← ${forkParent.draftId ?? forkParent.title}`
        : clip.title;
      return {
        ...state,
        arrangementSlots: state.arrangementSlots.map((slot) =>
          slot.id === command.slotId
            ? {
                ...slot,
                clipId: clip.id,
                materialId: clip.draftId,
                state: laneSlot ? ("loaded" as const) : ("staged" as const),
                label: slotLabel,
              }
            : slot,
        ),
        exchangeOpen: true,
        selectedExchangeClipId: clip.id,
        activityFeed: pushActivity(
          state,
          promoteCaption(clip.draftId ?? clip.title, forkParent?.draftId ?? forkParent?.title ?? "parent"),
        ),
      };
    }
    case "STAGE_CLIP": {
      const clip = state.exchangeClips.find((c) => c.id === command.clipId);
      if (!clip || clip.lifecycle !== "Ready") return state;
      const laneSlot = isLiveCollabLaneSlot(command.slotId);
      const forkParent = clip.forkOf ? state.exchangeClips.find((c) => c.id === clip.forkOf) : null;
      const slotLabel = forkParent
        ? `${clip.draftId ?? clip.title} ← ${forkParent.draftId ?? forkParent.title}`
        : clip.title;
      const stageNote = forkParent
        ? promoteCaption(clip.draftId ?? clip.title, forkParent.draftId ?? forkParent.title)
        : `Exchange: ${clip.title} ready for ${command.slotId}`;
      return {
        ...state,
        arrangementSlots: state.arrangementSlots.map((slot) =>
          slot.id === command.slotId
            ? {
                ...slot,
                clipId: clip.id,
                materialId: clip.draftId,
                state: laneSlot ? ("loaded" as const) : ("staged" as const),
                label: slotLabel,
              }
            : slot,
        ),
        exchangeOpen: true,
        selectedExchangeClipId: clip.id,
        activityFeed: pushActivity(state, stageNote),
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
        deskAuditionDraftId: null,
        activityFeed: pushActivity(state, `Activated ${slot.label} on Shared Master`),
      };
    }
    case "LAUNCH_SLOT": {
      if (state.sessionPhase === "performing") return state;
      const slot = state.arrangementSlots.find((s) => s.id === command.slotId);
      if (!slot) return state;
      const laneSlot = isLiveCollabLaneSlot(command.slotId);
      if (laneSlot) {
        if (!isLaneLaunchableState(slot.state)) return state;
        const launchedLabel = command.draftId ?? slot.label;
        const materialId = command.draftId ?? slot.materialId;
        const preloadNote = slot.materialId && !slot.clipId ? preloadExchangeCaption(slot.materialId) : null;
        const launchNote = preloadNote
          ? `${preloadNote} · Lane: Launch ${launchedLabel}`
          : `Lane: Launch ${launchedLabel} · queued`;
        return {
          ...state,
          arrangementSlots: state.arrangementSlots.map((s) =>
            s.id === command.slotId
              ? { ...s, state: "queued" as const, label: launchedLabel, materialId }
              : s,
          ),
          exchangeOpen: true,
          deskAuditionDraftId: null,
          activityFeed: pushActivity(state, launchNote),
        };
      }
      const launchedLabel = command.draftId ?? slot.label;
      return {
        ...state,
        arrangementSlots: state.arrangementSlots.map((s) => {
          if (s.id === command.slotId) return { ...s, state: "active" as const, label: launchedLabel };
          if (s.state === "active") {
            return { ...s, state: "empty" as const, clipId: null, materialId: null, label: "Empty slot" };
          }
          return s;
        }),
        activeMasterDraftId: state.activeMasterDraftId,
        deskAuditionDraftId: null,
        activityFeed: pushActivity(
          state,
          `Launched ${command.slotId}${command.draftId ? ` · ${command.draftId}` : ""}`,
        ),
      };
    }
    case "COMMIT_LANE_LAUNCH": {
      const slot = state.arrangementSlots.find((s) => s.id === command.slotId);
      if (!slot || !isLiveCollabLaneSlot(command.slotId)) return state;
      const launchedLabel = command.draftId ?? slot.label;
      const wasPlaying = slot.state === "playing";
      const playingCount = wasPlaying
        ? countPlayingLanes(state.arrangementSlots)
        : countPlayingLanes(state.arrangementSlots.filter((s) => s.id !== command.slotId)) + 1;
      const nextPhase = playingCount >= 7 ? ("performing" as const) : state.sessionPhase;
      return {
        ...state,
        sessionPhase: nextPhase,
        arrangementSlots: state.arrangementSlots.map((s) =>
          s.id === command.slotId
            ? { ...s, state: "playing" as const, label: launchedLabel, materialId: command.draftId ?? s.materialId }
            : s,
        ),
        activeMasterDraftId: `live-collab-${playingCount}-lanes`,
        exchangeOpen: true,
        activityFeed: pushActivity(
          state,
          playingCount >= 7 ? combinedSongCaption() : laneLaunchCaption(launchedLabel, playingCount),
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
    case "SELECT_PIANO_NOTE":
      return {
        ...patchParticipantWorkspace(state, state.selectedParticipantId, {
          draftId: command.draftId,
          createSubMode: "piano",
        }),
        selectedPianoNoteId: command.noteId,
        activityFeed: pushActivity(state, deskCreateCaption(command.draftId, "shaping")),
      };
    case "EDIT_NOTE_STEP":
      return {
        ...patchParticipantWorkspace(state, state.selectedParticipantId, { draftId: command.draftId }),
        selectedPianoNoteId: command.noteId,
        activityFeed: pushActivity(state, deskCreateCaption(command.draftId, "shaping")),
      };
    case "SET_NOTE_VELOCITY":
      return {
        ...patchParticipantWorkspace(state, state.selectedParticipantId, { draftId: command.draftId }),
        selectedPianoNoteId: command.noteId,
      };
    case "INSERT_NOTE":
      return {
        ...patchParticipantWorkspace(state, state.selectedParticipantId, { draftId: command.draftId }),
        activityFeed: pushActivity(state, deskCreateCaption(command.draftId, "adding note")),
      };
    case "TOGGLE_STEP":
      return {
        ...patchParticipantWorkspace(state, state.selectedParticipantId, { draftId: command.draftId }),
        activityFeed: pushActivity(state, deskCreateCaption(command.draftId, "shaping")),
      };
    case "PREVIEW_WORKSPACE":
      return {
        ...patchParticipantWorkspace(state, state.selectedParticipantId, { draftId: command.draftId }),
        deskAuditionDraftId: command.draftId,
        activityFeed: pushActivity(state, `Desk audition · ${command.draftId} · not Shared Master`),
      };
    case "SET_WORKSPACE_DRAFT":
      return {
        ...patchParticipantWorkspace(state, state.selectedParticipantId, { draftId: command.draftId }),
        recallRole: command.recallRole ?? null,
        activityFeed: pushActivity(state, recallCaption(command.draftId, command.recallRole ?? "new role")),
      };
    case "SET_SESSION_PHASE": {
      const performNote =
        command.phase === "performing" ? performCaption(countPlayingLanes(state.arrangementSlots)) : null;
      return {
        ...state,
        sessionPhase: command.phase,
        deskAuditionDraftId: command.phase === "performing" ? null : state.deskAuditionDraftId,
        activityFeed: performNote ? pushActivity(state, performNote) : state.activityFeed,
      };
    }
    case "SET_DEVICE_PARAM": {
      if (state.room === "participant" && state.participantTab === "Create") {
        const draftId = activeWorkspaceDraftId(state);
        if (draftId) {
          return {
            ...patchParticipantWorkspace(state, state.selectedParticipantId, { draftId }),
            activityFeed: pushActivity(state, deskCreateCaption(draftId, "shaping")),
          };
        }
      }
      return state;
    }
    case "RESTART_SESSION":
      return {
        ...createShellStateForMode(),
        room: "global",
        exchangeOpen: state.exchangeOpen,
        followActive: false,
        followLocked: true,
        sessionPhase: "building",
        recallRole: null,
        selectedPianoNoteId: null,
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

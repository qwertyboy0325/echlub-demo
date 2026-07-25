import type { CreateSubMode, ParticipantTab, ParticipantWorkspace, ShellState } from "./shellTypes";

export type { ParticipantWorkspace };

export function participantInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function deskLabelForProfile(taskProfile: string): string {
  switch (taskProfile) {
    case "Rhythm":
      return "Rhythm Desk";
    case "Keys":
      return "Keys Desk";
    case "Horns":
      return "Horns Desk";
    case "Guitar":
      return "Guitar + Color Desk";
    default:
      return `${taskProfile} Desk`;
  }
}

export function fullDeskTitle(name: string, taskProfile: string): string {
  return `${name} · ${deskLabelForProfile(taskProfile)}`;
}

export function parkedCursorLabel(name: string, taskProfile: string): string {
  return `${name} at ${deskLabelForProfile(taskProfile)}`;
}

export function createPhase4ParticipantWorkspaces(): Record<string, ParticipantWorkspace> {
  return {
    p1: {
      draftId: "midi-opening-bass",
      tab: "Create",
      createSubMode: "piano",
      ownedTrackIds: ["t-drums", "t-bass"],
    },
    p2: {
      draftId: "midi-opening-guitar",
      tab: "Devices",
      createSubMode: "piano",
      ownedTrackIds: ["t-lead"],
    },
    p3: {
      draftId: null,
      tab: "Mix",
      createSubMode: "clip",
      ownedTrackIds: ["t-fx"],
    },
  };
}

export function createLiveCollabParticipantWorkspaces(): Record<string, ParticipantWorkspace> {
  return {
    p1: {
      draftId: "ryo-bass-sparse-4",
      tab: "Create",
      createSubMode: "step",
      ownedTrackIds: ["track-drums", "track-bass"],
    },
    p2: {
      draftId: "kai-lh-sparse-4",
      tab: "Create",
      createSubMode: "piano",
      ownedTrackIds: ["track-piano-lh", "track-piano-rh"],
    },
    p3: {
      draftId: "mei-alto-themeA-8",
      tab: "Create",
      createSubMode: "clip",
      ownedTrackIds: ["track-alto", "track-tenor"],
    },
    p4: {
      draftId: "ren-comp-2",
      tab: "Devices",
      createSubMode: "clip",
      ownedTrackIds: ["track-guitar"],
    },
  };
}

export function workspaceForParticipant(state: ShellState, participantId: string): ParticipantWorkspace {
  return (
    state.participantWorkspaces[participantId] ?? {
      draftId: null,
      tab: "Create",
      createSubMode: "piano",
      ownedTrackIds: [],
    }
  );
}

function saveActiveToWorkspace(state: ShellState): ShellState {
  const id = state.selectedParticipantId;
  const ws = workspaceForParticipant(state, id);
  if (
    ws.draftId === state.workspaceDraftId &&
    ws.tab === state.participantTab &&
    ws.createSubMode === state.createSubMode
  ) {
    return state;
  }
  return {
    ...state,
    participantWorkspaces: {
      ...state.participantWorkspaces,
      [id]: {
        ...ws,
        draftId: state.workspaceDraftId,
        tab: state.participantTab,
        createSubMode: state.createSubMode,
      },
    },
  };
}

export function syncActiveWorkspaceFields(
  state: ShellState,
  participantId: string = state.selectedParticipantId,
): ShellState {
  const ws = workspaceForParticipant(state, participantId);
  return {
    ...state,
    workspaceDraftId: ws.draftId,
    participantTab: ws.tab,
    createSubMode: ws.createSubMode,
  };
}

export function patchParticipantWorkspace(
  state: ShellState,
  participantId: string,
  patch: Partial<ParticipantWorkspace>,
): ShellState {
  const current = workspaceForParticipant(state, participantId);
  const next = { ...current, ...patch };
  const workspaces = { ...state.participantWorkspaces, [participantId]: next };
  const base = { ...state, participantWorkspaces: workspaces };
  if (participantId === state.selectedParticipantId) {
    return syncActiveWorkspaceFields(base, participantId);
  }
  return base;
}

export function selectParticipantWorkspace(state: ShellState, participantId: string): ShellState {
  const saved = saveActiveToWorkspace(state);
  return syncActiveWorkspaceFields({ ...saved, selectedParticipantId: participantId }, participantId);
}

export function activeWorkspaceDraftId(state: ShellState): string | null {
  return workspaceForParticipant(state, state.selectedParticipantId).draftId ?? state.workspaceDraftId;
}

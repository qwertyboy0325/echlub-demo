import type { ParticipantWorkspace, ShellState } from "./shellTypes";

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

/** Viewer-facing possessive desk label — e.g. "Kai's Keys Desk". */
export function possessiveDeskTitle(name: string, taskProfile: string): string {
  const desk = deskLabelForProfile(taskProfile);
  const short = desk.replace(/ Desk$/, "");
  return `${name}'s ${short} Desk`;
}

export function instrumentSummaryForProfile(taskProfile: string): string {
  switch (taskProfile) {
    case "Rhythm":
      return "Drums · Bass";
    case "Keys":
      return "Piano LH · RH";
    case "Horns":
      return "Alto · Tenor";
    case "Guitar":
      return "Guitar · FX";
    default:
      return taskProfile;
  }
}

export function createModeLegend(subMode: string, taskProfile: string): string {
  switch (subMode) {
    case "step":
      return taskProfile === "Rhythm"
        ? "Step grid — toggle drum/bass hits. Stays on your private desk until shared to Exchange."
        : "Step grid — toggle pattern steps on your private desk.";
    case "clip":
      return taskProfile === "Horns"
        ? "Clip view — phrase lanes for horn parts. Not on Shared Master until launched."
        : "Clip view — name and shape your take. Desk-local until Exchange.";
    case "piano":
    default:
      return taskProfile === "Keys"
        ? "Piano roll — edit LH/RH notes. Preview with Desk audition; Shared Master is separate."
        : "Piano roll — edit note timing. Desk-local until you share to Exchange.";
  }
}

export function parkedCursorLabel(name: string, taskProfile: string): string {
  return `${name} at ${deskLabelForProfile(taskProfile)}`;
}

/** Short craft verb for Presence — e.g. "editing LH", "forking guitar". */
export function editingTaskForDraft(draftId: string | null, options?: { forking?: boolean }): string {
  if (!draftId) return "at desk";
  const id = draftId.toLowerCase();
  if (options?.forking || id.includes("fork")) {
    if (id.includes("guitar") || id.includes("comp") || id.includes("ren-")) return "forking guitar";
    if (id.includes("bass")) return "editing bass fork";
    return "editing fork";
  }
  if (id.includes("-lh-") || id.includes("lh-") || /piano-lh|lh-sparse/.test(id)) return "editing LH";
  if (id.includes("-rh-") || id.includes("rh-") || /piano-rh|rh-pad/.test(id)) return "editing RH";
  if (id.includes("bass")) return "editing bass";
  if (id.includes("drum") || id.includes("entry-4") && id.includes("ryo")) return "editing drums";
  if (id.includes("alto")) return "editing alto";
  if (id.includes("tenor")) return "editing tenor";
  if (id.includes("guitar") || id.includes("comp")) return "editing guitar";
  return "editing draft";
}

/** Presence line: "Kai · editing LH" when draft known; else desk label. */
export function presenceActivityLabel(
  name: string,
  taskProfile: string,
  draftId: string | null,
  options?: { forking?: boolean },
): string {
  if (!draftId) return deskLabelForProfile(taskProfile);
  return `${name} · ${editingTaskForDraft(draftId, options)}`;
}

/** Short verb under participant name — e.g. "editing LH" or "Keys Desk". */
export function presenceActivityVerb(taskProfile: string, activity: string): string {
  return activity.includes(" · ") ? activity.split(" · ")[1]! : deskLabelForProfile(taskProfile);
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

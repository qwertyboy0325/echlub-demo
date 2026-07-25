import {
  LIVE_COLLAB_LAUNCH_ORDER,
  LIVE_COLLAB_SLOT_TRACKS,
} from "../../domain/liveCollabSessionAdapter";
import { SHIKI_SEVEN_TRACK_INSTRUMENTS, type ShikiSevenTrackId } from "../../domain/shikiSevenTracks";
import { createLiveCollabParticipantWorkspaces } from "./participantWorkspace";
import type { ArrangementSlot, ArrangementTrack, ShellState } from "./shellTypes";
import { createInitialShellState } from "./shellFixtures";

const LIVE_COLLAB_PARTICIPANTS = [
  { id: "p1", name: "Ryo", color: "var(--participant-ryo)", taskProfile: "Rhythm", projectedRoom: "participant" as const, projectedTab: "Create" as const },
  { id: "p2", name: "Kai", color: "var(--participant-kai)", taskProfile: "Keys", projectedRoom: "participant" as const, projectedTab: "Create" as const },
  { id: "p3", name: "Mei", color: "var(--participant-mei)", taskProfile: "Horns", projectedRoom: "participant" as const, projectedTab: "Create" as const },
  { id: "p4", name: "Ren", color: "var(--participant-ren)", taskProfile: "Guitar", projectedRoom: "participant" as const, projectedTab: "Devices" as const },
];

const LIVE_COLLAB_TRACK_LABELS: Record<string, string> = {
  "track-drums": "Drums",
  "track-bass": "Bass",
  "track-piano-lh": "Piano LH",
  "track-piano-rh": "Piano RH",
  "track-guitar": "Guitar",
  "track-alto": "Alto",
  "track-tenor": "Tenor",
};

const LIVE_COLLAB_TRACK_OWNERS: Record<string, string> = {
  "track-drums": "Ryo",
  "track-bass": "Ryo",
  "track-piano-lh": "Kai",
  "track-piano-rh": "Kai",
  "track-guitar": "Ren",
  "track-alto": "Mei",
  "track-tenor": "Mei",
};

/** Preloaded supporting lanes — Drums, RH, Tenor start Loaded. */
const PRELOADED_LANE_MATERIAL: Partial<Record<ShikiSevenTrackId, { materialId: string; label: string }>> = {
  "track-drums": { materialId: "ryo-entry-4", label: "ryo-entry-4" },
  "track-piano-rh": { materialId: "kai-rh-pad-4", label: "kai-rh-pad-4" },
  "track-tenor": { materialId: "mei-tenor-entry-8", label: "mei-tenor-entry-8" },
};

export function createLiveCollabArrangementSlots(): ArrangementSlot[] {
  return LIVE_COLLAB_LAUNCH_ORDER.map((trackId, index) => {
    const preload = PRELOADED_LANE_MATERIAL[trackId];
    return {
      id: `lane-${index + 1}`,
      clipId: null,
      materialId: preload?.materialId ?? null,
      state: preload ? ("loaded" as const) : ("empty" as const),
      label: preload?.label ?? LIVE_COLLAB_TRACK_LABELS[trackId] ?? trackId,
    };
  });
}

export function createLiveCollabArrangementTracks(): ArrangementTrack[] {
  return LIVE_COLLAB_LAUNCH_ORDER.map((trackId) => ({
    id: trackId,
    name: LIVE_COLLAB_TRACK_LABELS[trackId] ?? trackId,
    identity: `${SHIKI_SEVEN_TRACK_INSTRUMENTS[trackId]} · ${LIVE_COLLAB_TRACK_OWNERS[trackId] ?? "—"}`,
  }));
}

/** Sparse Phase 5 boot — three preloaded lanes, four empty for on-screen authoring. */
export function createLiveCollabInitialShellState(): ShellState {
  const preloaded = createLiveCollabArrangementSlots().filter((slot) => slot.state === "loaded").length;
  const participantWorkspaces = createLiveCollabParticipantWorkspaces();
  const bootParticipantId = "p1";
  const bootWorkspace = participantWorkspaces[bootParticipantId]!;
  return {
    ...createInitialShellState(),
    selectedParticipantId: bootParticipantId,
    workspaceDraftId: bootWorkspace.draftId,
    participantTab: bootWorkspace.tab,
    createSubMode: bootWorkspace.createSubMode,
    participantWorkspaces,
    participants: LIVE_COLLAB_PARTICIPANTS.map((p, index) => ({
      ...p,
      active: index === 0,
    })),
    arrangementTracks: createLiveCollabArrangementTracks(),
    arrangementSlots: createLiveCollabArrangementSlots(),
    timelineClips: [],
    activityFeed: [`Session ready · Shiki live-collab derived pack · ${preloaded}/7 lanes loaded`],
  };
}

export function isLiveCollabLaneSlot(slotId: string): boolean {
  return slotId in LIVE_COLLAB_SLOT_TRACKS;
}

export function liveCollabSlotForTrack(trackId: ShikiSevenTrackId): string | undefined {
  const index = LIVE_COLLAB_LAUNCH_ORDER.indexOf(trackId);
  return index >= 0 ? `lane-${index + 1}` : undefined;
}

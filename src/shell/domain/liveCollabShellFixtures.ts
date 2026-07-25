import {
  LIVE_COLLAB_LAUNCH_ORDER,
  LIVE_COLLAB_SLOT_TRACKS,
} from "../../domain/liveCollabSessionAdapter";
import { SHIKI_SEVEN_TRACK_INSTRUMENTS } from "../../domain/shikiSevenTracks";
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

export function createLiveCollabArrangementSlots(): ArrangementSlot[] {
  return LIVE_COLLAB_LAUNCH_ORDER.map((trackId, index) => ({
    id: `lane-${index + 1}`,
    clipId: null,
    state: "empty" as const,
    label: LIVE_COLLAB_TRACK_LABELS[trackId] ?? trackId,
  }));
}

export function createLiveCollabArrangementTracks(): ArrangementTrack[] {
  return LIVE_COLLAB_LAUNCH_ORDER.map((trackId) => ({
    id: trackId,
    name: LIVE_COLLAB_TRACK_LABELS[trackId] ?? trackId,
    identity: `${SHIKI_SEVEN_TRACK_INSTRUMENTS[trackId]} · ${LIVE_COLLAB_TRACK_OWNERS[trackId] ?? "—"}`,
  }));
}

/** Sparse Phase 5 boot — seven empty lanes, four collaborators, silence until Launch. */
export function createLiveCollabInitialShellState(): ShellState {
  return {
    ...createInitialShellState(),
    workspaceDraftId: "kai-lh-sparse-4",
    participants: LIVE_COLLAB_PARTICIPANTS.map((p, index) => ({
      ...p,
      active: index === 0,
    })),
    arrangementTracks: createLiveCollabArrangementTracks(),
    arrangementSlots: createLiveCollabArrangementSlots(),
    timelineClips: [],
    activityFeed: ["Session ready · Shiki live-collab derived pack · 0/7 lanes"],
  };
}

export function isLiveCollabLaneSlot(slotId: string): boolean {
  return slotId in LIVE_COLLAB_SLOT_TRACKS;
}

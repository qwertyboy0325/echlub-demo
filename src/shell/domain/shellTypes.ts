export type RoomId = "global" | "participant" | "mixer";

export type LifecycleChip = "Available" | "In Progress" | "Review" | "Ready";

export type ArrangementSlotState = "empty" | "staged" | "active";

export type ParticipantTab = "Create" | "Devices" | "Automation" | "Mix" | "Queue";

export type CreateSubMode = "piano" | "step" | "clip";

export type DockSlotType = "knob" | "fader" | "toggle" | "momentary";

export type DockBadge = "PREVIEW" | "CAPTURE" | "MASTER";

export type DockMode = "preview" | "capture" | "master";

export type ViewportMode = "wide" | "drawer" | "compact";

export type WorkspaceBleed = "low" | "medium" | "high";

export interface ArrangementTrack {
  id: string;
  name: string;
  identity: string;
}

export interface TimelineClip {
  id: string;
  exchangeClipId: string;
  trackId: string;
  startBar: number;
  lengthBars: number;
  variant: "normal" | "staged" | "active" | "selected";
}

export interface Participant {
  id: string;
  name: string;
  color: string;
  taskProfile: string;
  active: boolean;
  projectedRoom: RoomId;
  projectedTab: ParticipantTab;
}

export interface ExchangeClip {
  id: string;
  title: string;
  revision: number;
  creatorId: string;
  contributorId: string | null;
  lifecycle: LifecycleChip;
  thumbnail: "wave" | "steps" | "notes";
  lineageParentId: string | null;
  forkOf: string | null;
  draftId: string | null;
}

export interface ArrangementSlot {
  id: string;
  clipId: string | null;
  state: ArrangementSlotState;
  label: string;
}

export interface DockSlot {
  index: number;
  label: string;
  type: DockSlotType;
  value: number;
  badge: DockBadge | null;
  sourceTrack: string | null;
  sourceClip: string | null;
  sourceParam: string | null;
  mapped: boolean;
}

export interface ShellState {
  room: RoomId;
  selectedParticipantId: string;
  followActive: boolean;
  followLocked: boolean;
  exchangeOpen: boolean;
  interactionFrozen: boolean;
  participantTab: ParticipantTab;
  createSubMode: CreateSubMode;
  transportPlaying: boolean;
  transportBar: number;
  transportBeat: number;
  participants: Participant[];
  exchangeClips: ExchangeClip[];
  arrangementSlots: ArrangementSlot[];
  arrangementTracks: ArrangementTrack[];
  timelineClips: TimelineClip[];
  selectedExchangeClipId: string | null;
  selectedMixerChannel: number;
  dockMode: DockMode;
  dockSlots: DockSlot[];
  activityFeed: string[];
  workspaceDraftId: string | null;
  workspaceBleed: WorkspaceBleed;
  activeMasterDraftId: string | null;
}

export type ShellCommand =
  | { type: "SET_ROOM"; room: RoomId }
  | { type: "SELECT_PARTICIPANT"; participantId: string }
  | { type: "SET_PARTICIPANT_PROJECTION"; participantId: string; room: RoomId; tab: ParticipantTab }
  | { type: "ENABLE_FOLLOW" }
  | { type: "RESUME_FOLLOW" }
  | { type: "SET_INTERACTION_FROZEN"; frozen: boolean }
  | { type: "TOGGLE_EXCHANGE" }
  | { type: "SET_PARTICIPANT_TAB"; tab: ParticipantTab }
  | { type: "SET_CREATE_SUBMODE"; mode: CreateSubMode }
  | { type: "SHARE_CLIP" }
  | { type: "FORK_CLIP"; clipId: string }
  | { type: "CLAIM_CLIP"; clipId: string }
  | { type: "SUBMIT_REVIEW"; clipId: string }
  | { type: "REVISE_CLIP"; clipId: string }
  | { type: "MARK_READY"; clipId: string }
  | { type: "STAGE_CLIP"; clipId: string; slotId: string }
  | { type: "ACTIVATE_SLOT"; slotId: string }
  | { type: "LAUNCH_SLOT"; slotId: string; draftId?: string }
  | { type: "REORDER_EXCHANGE"; clipIds: string[] }
  | { type: "PIN_DOCK"; slotIndex: number; label: string; sourceTrack?: string; sourceClip?: string; sourceParam?: string }
  | { type: "SET_DOCK_VALUE"; slotIndex: number; value: number }
  | { type: "SYNC_DOCK_FROM_MIX"; updates: { index: number; value: number }[] }
  | { type: "SET_DOCK_MODE"; mode: DockMode }
  | { type: "SELECT_EXCHANGE_CLIP"; clipId: string | null }
  | { type: "SELECT_MIXER_CHANNEL"; channelIndex: number }
  | { type: "TOGGLE_TRANSPORT" }
  | { type: "SYNC_TRANSPORT"; bar: number; beat: number; sixteenth: number; playing: boolean }
  | { type: "EDIT_NOTE_STEP"; draftId: string; noteId: string; step: number }
  | { type: "SET_NOTE_VELOCITY"; draftId: string; noteId: string; velocity: number }
  | { type: "INSERT_NOTE"; draftId: string; noteIndex?: number }
  | { type: "TOGGLE_STEP"; draftId: string; step: number }
  | { type: "SET_DEVICE_PARAM"; deviceId: string; value: number }
  | { type: "SET_LAUNCH_VELOCITY_SCALE"; scale: number }
  | { type: "SET_LANE_MUTE"; layer: import("../../types").LayerId; muted: boolean }
  | { type: "SET_DESK_BUS"; desk: import("../../types").DeskBusId; params: import("../../types").DeskBusParams }
  | { type: "PREVIEW_WORKSPACE"; draftId: string }
  | { type: "RESTART_SESSION" };

export function viewportModeForSize(width: number, height: number): ViewportMode {
  if (width >= 1360) return "wide";
  if (width === 1280 && height <= 720) return "compact";
  if (width >= 1280) return "drawer";
  return "compact";
}

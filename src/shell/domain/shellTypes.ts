export type RoomId = "global" | "participant" | "mixer";

export type LifecycleChip = "Available" | "In Progress" | "Review" | "Ready";

export type ArrangementSlotState = "empty" | "staged" | "active";

export type ParticipantTab = "Create" | "Devices" | "Automation" | "Mix" | "Queue";

export type CreateSubMode = "piano" | "step" | "clip";

export type DockSlotType = "knob" | "fader" | "toggle" | "momentary";

export type DockBadge = "PREVIEW" | "CAPTURE" | "MASTER";

export type ViewportMode = "wide" | "drawer" | "compact";

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
  badge: DockBadge;
  sourceLabel: string | null;
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
  dockSlots: DockSlot[];
  activityFeed: string[];
}

export type ShellCommand =
  | { type: "SET_ROOM"; room: RoomId }
  | { type: "SELECT_PARTICIPANT"; participantId: string }
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
  | { type: "REORDER_EXCHANGE"; clipIds: string[] }
  | { type: "PIN_DOCK"; slotIndex: number; label: string }
  | { type: "SET_DOCK_VALUE"; slotIndex: number; value: number }
  | { type: "TOGGLE_TRANSPORT" };

export function viewportModeForSize(width: number, height: number): ViewportMode {
  if (width >= 1360) return "wide";
  if (width === 1280 && height <= 720) return "compact";
  if (width >= 1280) return "drawer";
  return "compact";
}

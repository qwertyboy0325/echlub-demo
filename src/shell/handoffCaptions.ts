import { resolveShellPackMode } from "../domain/liveCollabPack";
import { countPlayingLanes } from "./laneSlotSemantics";
import type { ShellState } from "./domain/shellTypes";

/** Authored unit id is the exchange title in live-collab; phase-4 keeps draft id over pulse-rN. */
export function exchangeTitleForDraft(draftId: string): string {
  return draftId;
}

export function deskEditCaption(draftId: string): string {
  return `Desk: edit ${draftId}`;
}

export function exchangeSharedCaption(title: string): string {
  return `Exchange: ${title} shared`;
}

export function laneLaunchCaption(title: string, playingCount: number, laneTotal = 7): string {
  return `Lane: Launch ${title} · ${playingCount}/${laneTotal}`;
}

export function preloadExchangeCaption(materialId: string): string {
  return exchangeSharedCaption(materialId);
}

export function performCaption(playingCount: number, laneTotal = 7): string {
  return `Perform · Shared Master · ${playingCount}/${laneTotal}`;
}

export function recallCaption(draftId: string, role = "new role"): string {
  return `Recall · ${draftId} → ${role}`;
}

export function promoteCaption(forkDraftId: string, parentTitle: string): string {
  return `Promote · ${forkDraftId} ← ${parentTitle}`;
}

export function projectionCaption(state: ShellState): string | null {
  const active =
    state.participants.find((p) => p.active) ??
    state.participants.find((p) => p.id === state.selectedParticipantId);
  if (!active) return null;

  if (state.room === "participant") {
    const draftId = state.workspaceDraftId;
    if (draftId) return deskEditCaption(draftId);
    return `At ${active.name} Desk / ${state.participantTab}`;
  }

  if (state.room === "global") {
    const playing = countPlayingLanes(state.arrangementSlots);
    if (playing > 0) {
      const latestLane = state.activityFeed.find((entry) => entry.startsWith("Lane: Launch "));
      if (latestLane) return latestLane;
      const lastPlaying = state.arrangementSlots.find((slot) => slot.state === "playing");
      if (lastPlaying?.label) return laneLaunchCaption(lastPlaying.label, playing);
    }
    if (state.followActive) return `${active.name} → Shared Master`;
    return "Shared Master · sparse";
  }

  if (state.room === "mixer") {
    return `Shared Mixer · ${active.name} at ${active.taskProfile} desk`;
  }

  return null;
}

export function shouldUseAuthoredExchangeTitles(): boolean {
  return resolveShellPackMode() === "live-collab";
}

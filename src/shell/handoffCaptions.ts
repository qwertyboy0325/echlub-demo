import { resolveShellPackMode } from "../domain/liveCollabPack";
import { countPlayingLanes } from "./laneSlotSemantics";
import type { ShellState } from "./domain/shellTypes";

/** Authored unit id is the exchange title in live-collab; phase-4 keeps draft id over pulse-rN. */
export function exchangeTitleForDraft(draftId: string): string {
  return draftId;
}

export function deskEditCaption(draftId: string, tab = "Create"): string {
  if (tab === "Create") return `Private desk · shaping ${draftId}`;
  return `Private desk · ${draftId}`;
}

export function deskCreateCaption(draftId: string, verb = "shaping"): string {
  return `Private desk · ${verb} ${draftId}`;
}

export function privateDeskHandoffCaption(name: string, taskProfile: string, tab: string): string {
  const desk = taskProfile === "Rhythm" ? "Rhythm" : taskProfile === "Keys" ? "Keys" : taskProfile === "Horns" ? "Horns" : taskProfile === "Guitar" ? "Guitar" : taskProfile;
  if (tab === "Create") return `Private desk · ${name}'s ${desk} · shaping clip`;
  return `Private desk · ${name}'s ${desk} · ${tab}`;
}

export function librarySavedCaption(title: string): string {
  return `Saved to library · ${title}`;
}

export function exchangeSharedCaption(title: string): string {
  return `Shared to Exchange · ${title}`;
}

export function laneLaunchCaption(title: string, playingCount: number, laneTotal = 7): string {
  return `Lane: Launch ${title} · ${playingCount}/${laneTotal}`;
}

export function preloadExchangeCaption(materialId: string): string {
  return exchangeSharedCaption(materialId);
}

export function performCaption(playingCount: number, laneTotal = 7): string {
  if (playingCount >= laneTotal) return "Shared song · all lanes live";
  return `Perform · Shared Master · ${playingCount}/${laneTotal}`;
}

export function combinedSongCaption(): string {
  return "Shared song · all lanes live";
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
    if (state.participantTab === "Create") {
      if (draftId) return deskEditCaption(draftId, "Create");
      return privateDeskHandoffCaption(active.name, active.taskProfile, "Create");
    }
    if (draftId) return deskEditCaption(draftId, state.participantTab);
    return privateDeskHandoffCaption(active.name, active.taskProfile, state.participantTab);
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
    return "Shared Master · branchable";
  }

  if (state.room === "mixer") {
    return `Shared Mixer · ${active.name} at ${active.taskProfile} desk`;
  }

  return null;
}

export function shouldUseAuthoredExchangeTitles(): boolean {
  return resolveShellPackMode() === "live-collab";
}

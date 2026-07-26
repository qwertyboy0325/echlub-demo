import { resolveShellPackMode } from "../domain/liveCollabPack";
import type { ExchangeClip, ShellState } from "../shell/domain/shellTypes";

export function readyClipForStage(state: ShellState): ExchangeClip | null {
  const selected = state.selectedExchangeClipId
    ? state.exchangeClips.find((clip) => clip.id === state.selectedExchangeClipId)
    : null;
  if (selected?.lifecycle === "Ready") return selected;
  return state.exchangeClips.find((clip) => clip.lifecycle === "Ready") ?? null;
}

export function stagingSlotForClip(state: ShellState, clip: ExchangeClip): string | null {
  const isLiveCollab = resolveShellPackMode() === "live-collab";
  const forkSlot = state.arrangementSlots.find((slot) => slot.clipId === clip.id);
  if (forkSlot) return forkSlot.id;
  if (isLiveCollab) {
    const empty = state.arrangementSlots.find((slot) => slot.state === "empty");
    if (empty) return empty.id;
    const loaded = state.arrangementSlots.find((slot) => slot.state === "loaded" && !slot.clipId);
    if (loaded) return loaded.id;
  }
  const staged = state.arrangementSlots.find((slot) => slot.state === "empty" || slot.state === "staged");
  return staged?.id ?? null;
}

export function primaryExchangeAction(clip: ExchangeClip): {
  label: string;
  kind: "fork" | "claim" | "accept" | "preview" | "open";
} {
  switch (clip.lifecycle) {
    case "Available":
      return clip.contributorId
        ? { label: "Claim", kind: "claim" }
        : { label: "Fork", kind: "fork" };
    case "In Progress":
      return { label: "Open work", kind: "open" };
    case "Review":
      return { label: "Accept", kind: "accept" };
    case "Ready":
      return { label: "Preview", kind: "preview" };
  }
}

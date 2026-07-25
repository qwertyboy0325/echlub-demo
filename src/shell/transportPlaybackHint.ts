import { resolveShellPackMode } from "../domain/liveCollabPack";
import type { ShellState } from "./domain/shellTypes";

/** Human-facing playback mode — avoids implying 7-track payoff before lanes are launched. */
export function transportPlaybackHint(
  state: ShellState,
  musicalReady: boolean,
  audioReady: boolean,
  activeLaneCount = 0,
  packMode: "public" | "live-collab" = "public",
): { text: string; attention: boolean } {
  if (!musicalReady) return { text: "loading pack…", attention: false };
  if (!audioReady) return { text: "preparing audio…", attention: false };

  if (packMode === "live-collab") {
    if (activeLaneCount > 0) {
      return {
        text: `Shared Master · ${activeLaneCount}/7 lanes active`,
        attention: false,
      };
    }
    if (state.transportPlaying) {
      return {
        text: "transport running · silent until you Launch a lane in Global Arrangement",
        attention: true,
      };
    }
    return {
      text: "Launch lanes in Global Arrangement — sparse start, layers accumulate on Shared Master",
      attention: false,
    };
  }

  if (state.activeMasterDraftId) {
    return {
      text: `Shared Master active · ${state.activeMasterDraftId}`,
      attention: false,
    };
  }
  if (state.transportPlaying) {
    return {
      text: "transport running · silent until a Ready clip is staged & activated on Shared Master",
      attention: true,
    };
  }
  return {
    text: "Play only advances transport — stage → Activate for 7-track audio",
    attention: false,
  };
}

/** Display bar index aligned with arrangement ruler (1-based). */
export function displayTransportBar(transportBar: number): number {
  return Math.max(1, transportBar);
}

export function resolveTransportPackMode(): "public" | "live-collab" {
  return resolveShellPackMode();
}

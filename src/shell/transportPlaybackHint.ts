import type { ShellState } from "./domain/shellTypes";

/** Human-facing playback mode — avoids implying 7-track payoff before Shared Master is assigned. */
export function transportPlaybackHint(
  state: ShellState,
  musicalReady: boolean,
  audioReady: boolean,
): { text: string; attention: boolean } {
  if (!musicalReady) return { text: "loading pack…", attention: false };
  if (!audioReady) return { text: "preparing audio…", attention: false };
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
    text: "Play only advances transport — Alex/Jordan/Sam act via Participant & Exchange, then stage → Activate for 7-track audio",
    attention: false,
  };
}

/** Display bar index aligned with arrangement ruler (1-based). */
export function displayTransportBar(transportBar: number): number {
  return Math.max(1, transportBar);
}

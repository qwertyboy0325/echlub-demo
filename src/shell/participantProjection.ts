import type { ShellState } from "./domain/shellTypes";
import { projectionCaption as handoffProjectionCaption } from "./handoffCaptions";

export {
  deskEditCaption,
  exchangeSharedCaption,
  exchangeTitleForDraft,
  laneLaunchCaption,
  performCaption,
  preloadExchangeCaption,
  projectionCaption,
  promoteCaption,
  recallCaption,
  shouldUseAuthoredExchangeTitles,
} from "./handoffCaptions";

export function participantDeskShortLabel(state: ShellState): string | null {
  const selected = state.participants.find((p) => p.id === state.selectedParticipantId);
  if (!selected) return null;
  return `${selected.name} Desk`;
}

export function followBannerText(state: ShellState): string | null {
  if (!state.followActive) return null;
  return handoffProjectionCaption(state);
}

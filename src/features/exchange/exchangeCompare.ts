import type { ExchangeClip, ShellState } from "../../shell/domain/shellTypes";

export interface ExchangeComparePair {
  parent: ExchangeClip;
  fork: ExchangeClip;
}

export function resolveExchangeComparePair(state: ShellState): ExchangeComparePair | null {
  const selected = state.selectedExchangeClipId
    ? state.exchangeClips.find((clip) => clip.id === state.selectedExchangeClipId)
    : null;
  if (!selected?.forkOf) return null;
  const parent = state.exchangeClips.find((clip) => clip.id === selected.forkOf);
  if (!parent) return null;
  return { parent, fork: selected };
}

import type { MixParams } from "../../types";
import type { ShellState } from "../domain/shellTypes";

export function mixPatchFromDockParam(
  sourceParam: string,
  value: number,
): Partial<MixParams> | null {
  const label = sourceParam.toLowerCase();
  if (label.includes("cutoff") || label.includes("filter")) return { filter: 200 + value * 7800 };
  if (label.includes("delay") || label.includes("wet")) return { delayWet: value * 0.65 };
  if (label.includes("reverb") || label.includes("send")) return { reverbWet: value * 0.85 };
  if (label.includes("level")) return { masterGain: -24 + value * 18 };
  return null;
}

export function dockValueFromMixParam(sourceParam: string, mix: MixParams): number | null {
  const label = sourceParam.toLowerCase();
  if (label.includes("cutoff") || label.includes("filter")) {
    return Math.max(0, Math.min(1, (mix.filter - 200) / 7800));
  }
  if (label.includes("delay") || label.includes("wet")) {
    return Math.max(0, Math.min(1, mix.delayWet / 0.65));
  }
  if (label.includes("reverb") || label.includes("send")) {
    return Math.max(0, Math.min(1, mix.reverbWet / 0.85));
  }
  if (label.includes("level")) {
    return Math.max(0, Math.min(1, (mix.masterGain + 24) / 18));
  }
  return null;
}

export function dockUpdatesFromMix(
  state: ShellState,
  mix: MixParams,
  epsilon = 0.002,
): { index: number; value: number }[] {
  const updates: { index: number; value: number }[] = [];
  for (const slot of state.dockSlots) {
    if (!slot.mapped || !slot.sourceParam) continue;
    const next = dockValueFromMixParam(slot.sourceParam, mix);
    if (next === null) continue;
    if (Math.abs(next - slot.value) > epsilon) {
      updates.push({ index: slot.index, value: Number(next.toFixed(4)) });
    }
  }
  return updates;
}

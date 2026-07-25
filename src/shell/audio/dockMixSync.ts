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
  if (label.includes("rhythm") && label.includes("delay")) return { desk: { rhythm: { delaySend: value * 0.35 } } };
  if (label.includes("keys") && label.includes("delay")) return { desk: { keys: { delaySend: value * 0.45 } } };
  if (label.includes("horns") && label.includes("delay")) return { desk: { horns: { delaySend: value * 0.65 } } };
  if (label.includes("guitar") && label.includes("delay")) return { desk: { guitar: { delaySend: value * 0.55 } } };
  if (label.includes("horns") && label.includes("reverb")) return { desk: { horns: { reverbSend: value * 0.5 } } };
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
  if (label.includes("rhythm") && label.includes("delay")) {
    return Math.max(0, Math.min(1, (mix.desk?.rhythm?.delaySend ?? 0) / 0.35));
  }
  if (label.includes("keys") && label.includes("delay")) {
    return Math.max(0, Math.min(1, (mix.desk?.keys?.delaySend ?? 0) / 0.45));
  }
  if (label.includes("horns") && label.includes("delay")) {
    return Math.max(0, Math.min(1, (mix.desk?.horns?.delaySend ?? 0) / 0.65));
  }
  if (label.includes("guitar") && label.includes("delay")) {
    return Math.max(0, Math.min(1, (mix.desk?.guitar?.delaySend ?? 0) / 0.55));
  }
  if (label.includes("horns") && label.includes("reverb")) {
    return Math.max(0, Math.min(1, (mix.desk?.horns?.reverbSend ?? 0) / 0.5));
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

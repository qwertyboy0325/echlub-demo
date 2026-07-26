import type { MixParams } from "../../types";
import type { ShellState } from "../domain/shellTypes";

type DeskSendParam = "filter" | "delay" | "reverb";

const DESK_DELAY_SCALE: Record<string, number> = {
  rhythm: 0.35,
  keys: 0.45,
  horns: 0.65,
  guitar: 0.55,
};

const DESK_REVERB_SCALE = 0.5;

function deskLabelMatch(label: string, desk: string, param: DeskSendParam): boolean {
  return label.includes(desk) && label.includes(param);
}

function deskMixPatchFromLabel(label: string, value: number): Partial<MixParams> | null {
  const desks: Array<import("../../types").DeskBusId> = ["rhythm", "keys", "horns", "guitar"];
  for (const desk of desks) {
    if (deskLabelMatch(label, desk, "filter")) {
      return { desk: { [desk]: { filterHz: 200 + value * 7800 } } };
    }
    if (deskLabelMatch(label, desk, "delay")) {
      return { desk: { [desk]: { delaySend: value * DESK_DELAY_SCALE[desk] } } };
    }
    if (deskLabelMatch(label, desk, "reverb")) {
      return { desk: { [desk]: { reverbSend: value * DESK_REVERB_SCALE } } };
    }
  }
  return null;
}

function deskValueFromLabel(label: string, mix: MixParams): number | null {
  const desks: Array<import("../../types").DeskBusId> = ["rhythm", "keys", "horns", "guitar"];
  for (const desk of desks) {
    const deskMix = mix.desk?.[desk];
    if (deskLabelMatch(label, desk, "filter")) {
      const hz = deskMix?.filterHz ?? 6400;
      return Math.max(0, Math.min(1, (hz - 200) / 7800));
    }
    if (deskLabelMatch(label, desk, "delay")) {
      return Math.max(0, Math.min(1, (deskMix?.delaySend ?? 0) / DESK_DELAY_SCALE[desk]));
    }
    if (deskLabelMatch(label, desk, "reverb")) {
      return Math.max(0, Math.min(1, (deskMix?.reverbSend ?? 0) / DESK_REVERB_SCALE));
    }
  }
  return null;
}

export function mixPatchFromDockParam(
  sourceParam: string,
  value: number,
): Partial<MixParams> | null {
  const label = sourceParam.toLowerCase();
  const deskPatch = deskMixPatchFromLabel(label, value);
  if (deskPatch) return deskPatch;
  if (label.includes("cutoff") || label.includes("filter")) return { filter: 200 + value * 7800 };
  if (label.includes("delay") || label.includes("wet")) return { delayWet: value * 0.65 };
  if (label.includes("reverb") || label.includes("send")) return { reverbWet: value * 0.85 };
  if (label.includes("level")) return { masterGain: -24 + value * 18 };
  return null;
}

export function dockValueFromMixParam(sourceParam: string, mix: MixParams): number | null {
  const label = sourceParam.toLowerCase();
  const deskValue = deskValueFromLabel(label, mix);
  if (deskValue !== null) return deskValue;
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

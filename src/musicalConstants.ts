import type { MixParams } from "./types";

export const BPM = 92;
export const TOTAL_BARS = 40;

export const DEFAULT_MIX: MixParams = {
  filter: 1200,
  delayWet: 0.2,
  reverbWet: 0.42,
  masterGain: -3,
  faders: { groove: 64, harmony: 48, melody: 28, texture: 58 },
};

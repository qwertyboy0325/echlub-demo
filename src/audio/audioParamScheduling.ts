import * as Tone from "tone";

/** Stable cross-browser ramp floor avoids audible parameter steps. */
export const MIN_AUDIO_RAMP_SECONDS = 0.04;

/** Baseline reset uses a short ramp so active delay/reverb tails are not hard-cut. */
export const BASELINE_RESET_RAMP_SECONDS = 0.05;

export interface RampableAudioParam {
  setRampPoint(time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
}

export function audioNow(): number {
  return Tone.now();
}

export function clampAudioTime(time: number): number {
  const floor = audioNow() + 0.003;
  return Math.max(time, floor);
}

export function effectiveRampDuration(requested: number): number {
  return Math.max(MIN_AUDIO_RAMP_SECONDS, requested);
}

export function rampLinear(
  param: RampableAudioParam,
  value: number,
  startTime: number,
  rampDuration: number,
): void {
  const t = clampAudioTime(startTime);
  const duration = effectiveRampDuration(rampDuration);
  param.setRampPoint(t);
  param.linearRampToValueAtTime(value, t + duration);
}

/** Use one filter-ramp curve on every browser for matching automation tone. */
export function rampFilterFrequency(
  param: RampableAudioParam,
  hz: number,
  startTime: number,
  rampDuration: number,
): void {
  rampLinear(param, Math.max(80, hz), startTime, rampDuration);
}

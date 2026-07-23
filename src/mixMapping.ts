import type { MixParams } from "./types";
import { defaultMix } from "./musicData";

export type FaderKey = "groove" | "harmony" | "melody" | "texture";

export const FADER_KEYS: FaderKey[] = ["groove", "harmony", "melody", "texture"];

export interface MixControlMapping {
  controlId: string;
  runtimePath: string;
  audioTarget: string;
  mapping: string;
  initial: number;
  reset: number;
}

export const MIX_CONTROL_MAPPINGS: MixControlMapping[] = [
  { controlId: "fader-groove", runtimePath: "mix.faders.groove", audioTarget: "grooveGain.volume", mapping: "faderUiToDb", initial: defaultMix.faders.groove, reset: defaultMix.faders.groove },
  { controlId: "fader-harmony", runtimePath: "mix.faders.harmony", audioTarget: "harmonyGain.volume", mapping: "faderUiToDb", initial: defaultMix.faders.harmony, reset: defaultMix.faders.harmony },
  { controlId: "fader-melody", runtimePath: "mix.faders.melody", audioTarget: "melodyGain.volume", mapping: "faderUiToDb", initial: defaultMix.faders.melody, reset: defaultMix.faders.melody },
  { controlId: "fader-texture", runtimePath: "mix.faders.texture", audioTarget: "textureGain.volume", mapping: "faderUiToDb", initial: defaultMix.faders.texture, reset: defaultMix.faders.texture },
  { controlId: "filter-knob", runtimePath: "mix.filter", audioTarget: "masterFilter.frequency", mapping: "filterUiToHz", initial: defaultMix.filter, reset: defaultMix.filter },
  { controlId: "delay-knob", runtimePath: "mix.delayWet", audioTarget: "delay.wet", mapping: "delayUiToWet", initial: defaultMix.delayWet, reset: defaultMix.delayWet },
];

export function faderUiToDb(ui: number): number {
  const normalized = Math.min(1, Math.max(0, ui / 100));
  return normalized === 0 ? -60 : 20 * Math.log10(normalized);
}

export function faderUiToGain(ui: number): number {
  return Math.pow(10, faderUiToDb(ui) / 20);
}

export function filterUiToHz(ui: number): number {
  return Math.max(80, ui);
}

export function delayUiToWet(ui: number): number {
  return Math.min(1, Math.max(0, ui));
}

export function knobRotationForFilter(hz: number): number {
  return Math.min(135, -120 + hz / 15);
}

export function knobRotationForDelay(wet: number): number {
  return -120 + wet * 260;
}

export function applyFaderToMix(mix: MixParams, key: FaderKey, ui: number): MixParams {
  return { ...mix, faders: { ...mix.faders, [key]: ui } };
}

export function computeRampTargetTime(startTime: number, rampDuration: number): number {
  return startTime + rampDuration;
}

export function mixEquals(a: MixParams, b: MixParams): boolean {
  return a.filter === b.filter
    && a.delayWet === b.delayWet
    && a.reverbWet === b.reverbWet
    && a.masterGain === b.masterGain
    && a.drumFilter === b.drumFilter
    && a.drumReverbWet === b.drumReverbWet
    && a.drumTrimDb === b.drumTrimDb
    && a.bassTrimDb === b.bassTrimDb
    && FADER_KEYS.every((k) => a.faders[k] === b.faders[k]);
}

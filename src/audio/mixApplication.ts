import * as Tone from "tone";
import { delayUiToWet, faderUiToDb, filterUiToHz } from "../mixMapping";
import type { MixParams, SceneDefinition } from "../types";
import {
  resolveMixDrumDefaults,
  resolveMixSubgroupTrims,
  type MixAutomationEvent,
  type SoundDesignPreset,
} from "../domain/reconstructionPack";
import type { MasterAudioGraph } from "./masterAudioGraph";
import {
  audioNow,
  BASELINE_RESET_RAMP_SECONDS,
  rampFilterFrequency,
  rampLinear,
} from "./audioParamScheduling";

function resolveStartTime(atTime?: number): number {
  return atTime ?? audioNow();
}

export function applyMixParamsToGraph(
  graph: MasterAudioGraph,
  currentMix: MixParams,
  params: Partial<MixParams>,
  rampTime = 0.18,
  atTime?: number,
): MixParams {
  const startTime = resolveStartTime(atTime);
  if (params.filter !== undefined) {
    currentMix.filter = params.filter;
    rampFilterFrequency(graph.masterFilter.frequency, filterUiToHz(params.filter), startTime, rampTime);
  }
  if (params.delayWet !== undefined) {
    currentMix.delayWet = params.delayWet;
    rampLinear(graph.delaySend.gain, delayUiToWet(params.delayWet), startTime, rampTime);
  }
  if (params.reverbWet !== undefined) {
    currentMix.reverbWet = params.reverbWet;
    rampLinear(graph.reverbSend.gain, params.reverbWet, startTime, rampTime);
  }
  if (params.masterGain !== undefined) {
    currentMix.masterGain = params.masterGain;
    rampLinear(graph.master.volume, params.masterGain, startTime, rampTime);
  }
  if (params.faders) {
    const map: Record<string, Tone.Volume> = {
      groove: graph.grooveGain,
      harmony: graph.harmonyGain,
      melody: graph.melodyGain,
      texture: graph.textureGain,
    };
    for (const [key, ui] of Object.entries(params.faders)) {
      currentMix.faders[key] = ui;
      const gain = map[key];
      if (gain) rampLinear(gain.volume, faderUiToDb(ui), startTime, rampTime);
    }
  }
  if (params.drumFilter !== undefined) {
    currentMix.drumFilter = params.drumFilter;
    rampFilterFrequency(graph.drumFilter.frequency, params.drumFilter, startTime, rampTime);
  }
  if (params.drumReverbWet !== undefined) {
    currentMix.drumReverbWet = params.drumReverbWet;
    rampLinear(graph.drumReverbSend.gain, params.drumReverbWet, startTime, rampTime);
  }
  if (params.drumTrimDb !== undefined) {
    currentMix.drumTrimDb = params.drumTrimDb;
    rampLinear(graph.drumTrim.volume, params.drumTrimDb, startTime, rampTime);
  }
  if (params.bassTrimDb !== undefined) {
    currentMix.bassTrimDb = params.bassTrimDb;
    rampLinear(graph.bassTrim.volume, params.bassTrimDb, startTime, rampTime);
  }
  return currentMix;
}

export function applySceneFxToGraph(
  graph: MasterAudioGraph,
  soundDesign: SoundDesignPreset,
  scene: SceneDefinition,
  startTime: number,
  includeFaders: boolean,
): MixParams {
  const rampDuration = 0.12;
  const drumDefaults = resolveMixDrumDefaults(scene.fx, soundDesign);
  const subgroupTrims = resolveMixSubgroupTrims(scene.fx);
  const currentMix: MixParams = {
    ...scene.fx,
    faders: { ...scene.fx.faders },
    drumFilter: scene.fx.drumFilter,
    drumReverbWet: scene.fx.drumReverbWet,
    drumTrimDb: subgroupTrims.drumTrimDb,
    bassTrimDb: subgroupTrims.bassTrimDb,
  };
  rampFilterFrequency(graph.masterFilter.frequency, filterUiToHz(scene.fx.filter), startTime, rampDuration);
  rampLinear(graph.delaySend.gain, delayUiToWet(scene.fx.delayWet), startTime, rampDuration);
  rampLinear(graph.reverbSend.gain, scene.fx.reverbWet, startTime, rampDuration);
  rampLinear(graph.master.volume, scene.fx.masterGain, startTime, rampDuration);
  rampFilterFrequency(graph.drumFilter.frequency, drumDefaults.drumFilter, startTime, rampDuration);
  rampLinear(graph.drumReverbSend.gain, drumDefaults.drumReverbWet, startTime, rampDuration);
  rampLinear(graph.drumTrim.volume, subgroupTrims.drumTrimDb, startTime, rampDuration);
  rampLinear(graph.bassTrim.volume, subgroupTrims.bassTrimDb, startTime, rampDuration);
  if (includeFaders) {
    applyMixParamsToGraph(graph, currentMix, { faders: scene.fx.faders }, rampDuration, startTime);
  }
  return currentMix;
}

export function resetMixToBaseline(
  graph: MasterAudioGraph,
  mix: MixParams,
  soundDesign: SoundDesignPreset,
  atTime: number,
): void {
  const drumDefaults = resolveMixDrumDefaults(mix, soundDesign);
  const subgroupTrims = resolveMixSubgroupTrims(mix);
  const rampDuration = BASELINE_RESET_RAMP_SECONDS;
  rampFilterFrequency(graph.masterFilter.frequency, filterUiToHz(mix.filter), atTime, rampDuration);
  rampLinear(graph.delaySend.gain, delayUiToWet(mix.delayWet), atTime, rampDuration);
  rampLinear(graph.reverbSend.gain, mix.reverbWet, atTime, rampDuration);
  rampLinear(graph.master.volume, mix.masterGain, atTime, rampDuration);
  rampLinear(graph.grooveGain.volume, faderUiToDb(mix.faders.groove), atTime, rampDuration);
  rampLinear(graph.harmonyGain.volume, faderUiToDb(mix.faders.harmony), atTime, rampDuration);
  rampLinear(graph.melodyGain.volume, faderUiToDb(mix.faders.melody), atTime, rampDuration);
  rampLinear(graph.textureGain.volume, faderUiToDb(mix.faders.texture), atTime, rampDuration);
  rampFilterFrequency(graph.drumFilter.frequency, drumDefaults.drumFilter, atTime, rampDuration);
  rampLinear(graph.drumReverbSend.gain, drumDefaults.drumReverbWet, atTime, rampDuration);
  rampLinear(graph.drumTrim.volume, subgroupTrims.drumTrimDb, atTime, rampDuration);
  rampLinear(graph.bassTrim.volume, subgroupTrims.bassTrimDb, atTime, rampDuration);
}

export function applyMixAutomationEventToGraph(
  graph: MasterAudioGraph,
  currentMix: MixParams,
  event: MixAutomationEvent,
  atTime: number,
): MixParams {
  const patch: Partial<MixParams> = { ...event.patch };
  if (event.patch.faders) {
    patch.faders = { ...currentMix.faders, ...event.patch.faders };
  }
  return applyMixParamsToGraph(graph, currentMix, patch, event.rampSeconds, atTime);
}

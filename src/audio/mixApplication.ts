import * as Tone from "tone";
import { computeRampTargetTime, delayUiToWet, faderUiToDb, filterUiToHz } from "../mixMapping";
import type { MixParams, SceneDefinition } from "../types";
import {
  resolveMixDrumDefaults,
  resolveMixSubgroupTrims,
  type MixAutomationEvent,
  type SoundDesignPreset,
} from "../domain/reconstructionPack";
import type { MasterAudioGraph } from "./masterAudioGraph";

export function applyMixParamsToGraph(
  graph: MasterAudioGraph,
  currentMix: MixParams,
  params: Partial<MixParams>,
  rampTime = 0.18,
  atTime?: number,
): MixParams {
  const startTime = atTime ?? Tone.getTransport().seconds;
  const targetTime = computeRampTargetTime(startTime, rampTime);
  if (params.filter !== undefined) {
    currentMix.filter = params.filter;
    graph.masterFilter.frequency.exponentialRampToValueAtTime(filterUiToHz(params.filter), targetTime);
  }
  if (params.delayWet !== undefined) {
    currentMix.delayWet = params.delayWet;
    graph.delaySend.gain.linearRampToValueAtTime(delayUiToWet(params.delayWet), targetTime);
  }
  if (params.reverbWet !== undefined) {
    currentMix.reverbWet = params.reverbWet;
    graph.reverbSend.gain.linearRampToValueAtTime(params.reverbWet, targetTime);
  }
  if (params.masterGain !== undefined) {
    currentMix.masterGain = params.masterGain;
    graph.master.volume.linearRampToValueAtTime(params.masterGain, targetTime);
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
      if (gain) gain.volume.linearRampToValueAtTime(faderUiToDb(ui), targetTime);
    }
  }
  if (params.drumFilter !== undefined) {
    currentMix.drumFilter = params.drumFilter;
    graph.drumFilter.frequency.exponentialRampToValueAtTime(params.drumFilter, targetTime);
  }
  if (params.drumReverbWet !== undefined) {
    currentMix.drumReverbWet = params.drumReverbWet;
    graph.drumReverbSend.gain.linearRampToValueAtTime(params.drumReverbWet, targetTime);
  }
  if (params.drumTrimDb !== undefined) {
    currentMix.drumTrimDb = params.drumTrimDb;
    graph.drumTrim.volume.linearRampToValueAtTime(params.drumTrimDb, targetTime);
  }
  if (params.bassTrimDb !== undefined) {
    currentMix.bassTrimDb = params.bassTrimDb;
    graph.bassTrim.volume.linearRampToValueAtTime(params.bassTrimDb, targetTime);
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
  const targetTime = computeRampTargetTime(startTime, rampDuration);
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
  graph.masterFilter.frequency.exponentialRampToValueAtTime(filterUiToHz(scene.fx.filter), targetTime);
  graph.delaySend.gain.linearRampToValueAtTime(delayUiToWet(scene.fx.delayWet), targetTime);
  graph.reverbSend.gain.linearRampToValueAtTime(scene.fx.reverbWet, targetTime);
  graph.master.volume.linearRampToValueAtTime(scene.fx.masterGain, targetTime);
  graph.drumFilter.frequency.exponentialRampToValueAtTime(drumDefaults.drumFilter, targetTime);
  graph.drumReverbSend.gain.linearRampToValueAtTime(drumDefaults.drumReverbWet, targetTime);
  graph.drumTrim.volume.linearRampToValueAtTime(subgroupTrims.drumTrimDb, targetTime);
  graph.bassTrim.volume.linearRampToValueAtTime(subgroupTrims.bassTrimDb, targetTime);
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
  graph.masterFilter.frequency.setValueAtTime(mix.filter, atTime);
  graph.delaySend.gain.setValueAtTime(delayUiToWet(mix.delayWet), atTime);
  graph.reverbSend.gain.setValueAtTime(mix.reverbWet, atTime);
  graph.master.volume.setValueAtTime(mix.masterGain, atTime);
  graph.grooveGain.volume.setValueAtTime(faderUiToDb(mix.faders.groove), atTime);
  graph.harmonyGain.volume.setValueAtTime(faderUiToDb(mix.faders.harmony), atTime);
  graph.melodyGain.volume.setValueAtTime(faderUiToDb(mix.faders.melody), atTime);
  graph.textureGain.volume.setValueAtTime(faderUiToDb(mix.faders.texture), atTime);
  graph.drumFilter.frequency.setValueAtTime(drumDefaults.drumFilter, atTime);
  graph.drumReverbSend.gain.setValueAtTime(drumDefaults.drumReverbWet, atTime);
  graph.drumTrim.volume.setValueAtTime(subgroupTrims.drumTrimDb, atTime);
  graph.bassTrim.volume.setValueAtTime(subgroupTrims.bassTrimDb, atTime);
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

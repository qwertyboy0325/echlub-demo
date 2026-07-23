import * as Tone from "tone";
import type { MixParams, SceneDefinition } from "../types";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import type { MasterAudioGraph } from "../audio/masterAudioGraph";
import { applyMixAutomationEventToGraph, applySceneFxToGraph } from "../audio/mixApplication";
import { playStepOnGraph } from "../audio/voicePlayback";
import type { SoundDesignPreset } from "../domain/reconstructionPack";
import type { MixAutomationEvent } from "../domain/reconstructionPack";
import type { AutomationTimelineEntry, CanonicalRenderPlan } from "./renderPlanning";

type OfflineTransport = ReturnType<typeof Tone.getTransport>;

export interface CanonicalPlaybackScheduleInput {
  transport: OfflineTransport;
  graph: MasterAudioGraph;
  materialBank: SessionMaterialBank;
  soundDesign: SoundDesignPreset;
  plan: CanonicalRenderPlan;
  onSceneChange?: (scene: SceneDefinition, time: number) => void;
}

export function scheduleCanonicalOfflinePlayback(input: CanonicalPlaybackScheduleInput): {
  currentMix: MixParams;
  playingScene: SceneDefinition;
} {
  const { transport, graph, materialBank, soundDesign, plan } = input;
  const mixState = { current: structuredClone(plan.session.mix) };
  let playingScene = plan.sceneBoundaries[0]?.scene;
  if (!playingScene) throw new Error("Canonical render plan has no scenes");

  transport.bpm.value = plan.tempoMap[0]?.bpm ?? plan.pack.metadata.bpm;
  transport.timeSignature = 4;
  transport.loop = false;

  for (const boundary of plan.sceneBoundaries) {
    transport.schedule((time: number) => {
      playingScene = boundary.scene;
      mixState.current = applySceneFxToGraph(graph, soundDesign, boundary.scene, time, true);
      input.onSceneChange?.(boundary.scene, time);
    }, boundary.startPosition);
  }

  for (const event of plan.automationEvents) {
    scheduleAutomationEvent(transport, graph, mixState, event);
  }

  let transportSixteenthCounter = 0;
  let baseBpm = plan.tempoMap[0]?.bpm ?? plan.pack.metadata.bpm;
  transport.scheduleRepeat((time: number) => {
    const totalSixteenths = transportSixteenthCounter;
    transportSixteenthCounter += 1;
    const bar = Math.floor(totalSixteenths / 16);
    const beat = Math.floor((totalSixteenths % 16) / 4);
    const sixteenth = totalSixteenths % 4;
    const step = beat * 4 + sixteenth;
    if (beat === 0 && sixteenth === 0) {
      const tempoChange = plan.tempoMap.find((entry) => entry.bar === bar);
      if (tempoChange) {
        baseBpm = tempoChange.bpm;
        transport.bpm.setValueAtTime(baseBpm, time);
      }
    }
    playStepOnGraph(graph, materialBank, playingScene, bar, step, time);
  }, "16n", 0, `${plan.totalBars}:0:0`);

  return { currentMix: mixState.current, playingScene };
}

function scheduleAutomationEvent(
  transport: OfflineTransport,
  graph: MasterAudioGraph,
  mixState: { current: MixParams },
  event: AutomationTimelineEntry,
): void {
  transport.schedule((time: number) => {
    mixState.current = applyMixAutomationEventToGraph(graph, mixState.current, {
      id: event.id,
      act: "canonicalPlayback",
      at: event.at,
      rampSeconds: event.rampSeconds,
      patch: event.patch,
    }, time);
  }, event.at);
}

export function schedulePackMixAutomationOnTransport(
  transport: OfflineTransport,
  graph: MasterAudioGraph,
  currentMix: MixParams,
  events: readonly MixAutomationEvent[] | undefined,
): void {
  for (const event of events ?? []) {
    if (event.act !== "canonicalPlayback" && event.act !== "both") continue;
    transport.schedule((time: number) => {
      applyMixAutomationEventToGraph(graph, currentMix, event, time);
    }, event.at);
  }
}

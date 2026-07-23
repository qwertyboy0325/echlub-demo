import type { MixAutomationEvent, ReconstructionPack } from "../domain/reconstructionPack";
import type { ProductionSession } from "../domain/sessionTypes";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import { compileSessionMaterialBank } from "../domain/sessionMaterialBank";
import { createCompletedProductionSession } from "../demo/productionMutations";
import { filterMixAutomationEvents } from "../demo/mixAutomationSchedule";
import { formatPosition, parsePosition, positionToTicks } from "../musicalPosition";
import type { MixParams, SceneDefinition } from "../types";
import { resolveMixDrumDefaults, resolveMixSubgroupTrims } from "../domain/reconstructionPack";

export const RENDER_EVIDENCE_FORMAT_VERSION = "echlub-render-evidence/1";
export const DEFAULT_RENDER_TAIL_SECONDS = 6;
export const DEFAULT_RENDER_SAMPLE_RATE = 48000;
export const DEFAULT_RENDER_CHANNELS = 2;

export interface SceneBoundaryPlan {
  sceneId: string;
  scene: SceneDefinition;
  startBar: number;
  startPosition: string;
  endBar: number;
  endPosition: string;
}

export interface AutomationTimelineEntry {
  id: string;
  at: string;
  atTicks: number;
  rampSeconds: number;
  patch: MixAutomationEvent["patch"];
}

export interface CanonicalRenderPlan {
  pack: ReconstructionPack;
  session: ProductionSession;
  materialBank: SessionMaterialBank;
  totalBars: number;
  tempoMap: { bar: number; bpm: number }[];
  sceneBoundaries: SceneBoundaryPlan[];
  automationEvents: AutomationTimelineEntry[];
  musicalDurationSeconds: number;
  tailSeconds: number;
  totalDurationSeconds: number;
  sampleRate: number;
  channels: number;
}

export function ticksToSeconds(ticks: number, tempoMap: readonly { bar: number; bpm: number }[]): number {
  if (ticks <= 0) return 0;
  const sorted = [...tempoMap].sort((a, b) => a.bar - b.bar);
  let seconds = 0;
  let cursorTicks = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const entry = sorted[i]!;
    const nextEntry = sorted[i + 1];
    const segmentStartBar = entry.bar;
    const segmentEndBar = nextEntry?.bar ?? Number.POSITIVE_INFINITY;
    const segmentStartTicks = segmentStartBar * 16;
    const segmentEndTicks = segmentEndBar * 16;
    if (ticks <= segmentStartTicks) break;
    const segmentTicks = Math.min(ticks, segmentEndTicks) - Math.max(cursorTicks, segmentStartTicks);
    if (segmentTicks > 0) {
      const bpm = entry.bpm;
      seconds += (segmentTicks / 16) * (60 / bpm) * 4;
      cursorTicks += segmentTicks;
    }
    if (cursorTicks >= ticks) break;
  }
  return seconds;
}

export function positionToSeconds(position: string, tempoMap: readonly { bar: number; bpm: number }[]): number {
  return ticksToSeconds(positionToTicks(parsePosition(position)), tempoMap);
}

export function buildSceneBoundaryPlans(session: ProductionSession): SceneBoundaryPlan[] {
  const refs = [...session.arrangement.scenes].sort((a, b) => a.startBar - b.startBar);
  return refs.map((ref, index) => {
    const scene = session.scenes.find((s) => s.id === ref.sceneId);
    if (!scene) throw new Error(`Missing scene ${ref.sceneId}`);
    const next = refs[index + 1];
    const endBar = next?.startBar ?? session.arrangement.totalBars;
    return {
      sceneId: scene.id,
      scene,
      startBar: ref.startBar,
      startPosition: `${ref.startBar}:0:0`,
      endBar,
      endPosition: `${endBar}:0:0`,
    };
  });
}

export function buildAutomationTimeline(
  events: readonly MixAutomationEvent[] | undefined,
  act: "canonicalPlayback",
): AutomationTimelineEntry[] {
  return filterMixAutomationEvents(events ?? [], act).map((event) => ({
    id: event.id,
    at: event.at,
    atTicks: positionToTicks(parsePosition(event.at)),
    rampSeconds: event.rampSeconds,
    patch: structuredClone(event.patch),
  }));
}

export function resolveEffectiveSceneMix(scene: SceneDefinition, soundDesign: ReconstructionPack["soundDesign"]): MixParams {
  const drumDefaults = resolveMixDrumDefaults(scene.fx, soundDesign);
  const subgroupTrims = resolveMixSubgroupTrims(scene.fx);
  return {
    ...scene.fx,
    faders: { ...scene.fx.faders },
    drumFilter: drumDefaults.drumFilter,
    drumReverbWet: drumDefaults.drumReverbWet,
    drumTrimDb: subgroupTrims.drumTrimDb,
    bassTrimDb: subgroupTrims.bassTrimDb,
  };
}

export function activeMaterialIdsForScene(scene: SceneDefinition): string[] {
  const ids = new Set<string>();
  for (const ref of [
    ...Object.values(scene.layers),
    ...Object.values(scene.layerStacks ?? {}).flat(),
  ]) {
    if (ref) ids.add(`${ref.draftId}@r${ref.revision}`);
  }
  return [...ids].sort();
}

export function buildCanonicalRenderPlan(
  pack: ReconstructionPack,
  options?: {
    tailSeconds?: number;
    sampleRate?: number;
    channels?: number;
    session?: ProductionSession;
    materialBank?: SessionMaterialBank;
  },
): CanonicalRenderPlan {
  const session = options?.session ?? createCompletedProductionSession(pack);
  const materialBank = options?.materialBank ?? compileSessionMaterialBank(session);
  const tempoMap = pack.tempoMap.length ? pack.tempoMap : [{ bar: 0, bpm: pack.metadata.bpm }];
  const totalBars = session.arrangement.totalBars;
  const tailSeconds = options?.tailSeconds ?? DEFAULT_RENDER_TAIL_SECONDS;
  const sampleRate = options?.sampleRate ?? DEFAULT_RENDER_SAMPLE_RATE;
  const channels = options?.channels ?? DEFAULT_RENDER_CHANNELS;
  const musicalDurationSeconds = positionToSeconds(`${totalBars}:0:0`, tempoMap);
  const sceneBoundaries = buildSceneBoundaryPlans(session);
  const automationEvents = buildAutomationTimeline(pack.mixAutomation, "canonicalPlayback");
  return {
    pack,
    session,
    materialBank,
    totalBars,
    tempoMap,
    sceneBoundaries,
    automationEvents,
    musicalDurationSeconds,
    tailSeconds,
    totalDurationSeconds: musicalDurationSeconds + tailSeconds,
    sampleRate,
    channels,
  };
}

export function offlineSchedulingStepCount(plan: CanonicalRenderPlan): number {
  return plan.totalBars * 16;
}

export function sceneBoundaryAtBar(plan: CanonicalRenderPlan, bar: number): SceneBoundaryPlan | undefined {
  return [...plan.sceneBoundaries].reverse().find((boundary) => bar >= boundary.startBar);
}

export function formatMusicalPosition(bar: number, beat = 0, sixteenth = 0): string {
  return formatPosition({ bar, beat, sixteenth });
}

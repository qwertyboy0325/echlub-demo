import { DEFAULT_MIX } from "./musicalConstants";
import { performanceScript } from "./performanceScript";
import { boundaryIdForScene } from "./boundaryIds";
import type { PerformanceScriptEvent, SceneDefinition } from "./types";
import { formatPosition, parsePosition, positionFromBarBeat, positionToTicks, type MusicalPosition } from "./musicalPosition";

export interface SceneExecutionTransaction {
  boundaryId: string;
  sceneId: string;
  sceneExecutionId: string;
  queuedAt: string;
  executeAt: string;
  transportObservedAt: string;
  authorityActivatedAt: string;
  audioActivatedAt: string;
  runtimeActivatedAt: string;
  queueUpdatedAt: string;
  jamMemoryCapturedAt?: string;
  executionCount: number;
}

export interface SceneExecutionRecord {
  sceneId: string;
  queuedAt: MusicalPosition;
  executeAt: MusicalPosition;
  audioActivatedAt: MusicalPosition | null;
  runtimeActivatedAt: MusicalPosition | null;
  memoryRecordedAt: MusicalPosition | null;
  boundaryId: string;
  transaction: SceneExecutionTransaction;
}

export const IDLE_SCENE_ID = "idle";

let sessionSceneResolver: ((id: string) => SceneDefinition | undefined) | null = null;

export function setSceneResolver(resolver: (id: string) => SceneDefinition | undefined): void {
  sessionSceneResolver = resolver;
}

export function createIdleScene(): SceneDefinition {
  return {
    id: IDLE_SCENE_ID,
    title: "Prelude",
    bars: 6,
    startBar: 0,
    description: "Master silent until the first scene executes at a musical boundary.",
    layers: { drums: null, bass: null, harmony: null, melody: null, texture: null },
    fx: { ...DEFAULT_MIX, faders: { ...DEFAULT_MIX.faders } },
  };
}

export function sceneById(id: string): SceneDefinition | undefined {
  if (id === IDLE_SCENE_ID) return createIdleScene();
  return sessionSceneResolver?.(id);
}

export class SceneExecutionAuthority {
  private masterSceneId = IDLE_SCENE_ID;
  private records: SceneExecutionRecord[] = [];
  private executedBoundaryIds = new Set<string>();
  private executionCounter = 0;

  get playingSceneId(): string {
    return this.masterSceneId;
  }

  get playingScene(): SceneDefinition {
    return sceneById(this.masterSceneId) ?? createIdleScene();
  }

  get executionRecords(): readonly SceneExecutionRecord[] {
    return this.records;
  }

  get transactions(): readonly SceneExecutionTransaction[] {
    return this.records.map((r) => r.transaction);
  }

  reset(): void {
    this.masterSceneId = IDLE_SCENE_ID;
    this.records = [];
    this.executedBoundaryIds.clear();
    this.executionCounter = 0;
  }

  canExecuteBoundary(boundaryId: string): boolean {
    return !this.executedBoundaryIds.has(boundaryId);
  }

  canExecute(sceneId: string, position: MusicalPosition): boolean {
    return this.canExecuteBoundary(boundaryIdForScene(sceneId, position.bar));
  }

  executeScene(
    sceneId: string,
    position: MusicalPosition,
    queuedAt?: MusicalPosition,
    hooks?: {
      onAudio?: (tx: SceneExecutionTransaction) => void;
      onRuntime?: (tx: SceneExecutionTransaction) => void;
      onQueue?: (tx: SceneExecutionTransaction) => void;
      onMemory?: (tx: SceneExecutionTransaction) => void;
    },
  ): SceneExecutionRecord {
    const boundaryId = boundaryIdForScene(sceneId, position.bar);
    if (this.executedBoundaryIds.has(boundaryId)) {
      throw new Error(`Duplicate scene execution: ${boundaryId}`);
    }
    this.executedBoundaryIds.add(boundaryId);
    this.masterSceneId = sceneId;
    this.executionCounter += 1;

    const queued = queuedAt ?? position;
    const tx: SceneExecutionTransaction = {
      boundaryId,
      sceneId,
      sceneExecutionId: `exec-${this.executionCounter}`,
      queuedAt: formatPosition(queued),
      executeAt: formatPosition(position),
      transportObservedAt: formatPosition(position),
      authorityActivatedAt: formatPosition(position),
      audioActivatedAt: "",
      runtimeActivatedAt: "",
      queueUpdatedAt: "",
      executionCount: 0,
    };

    hooks?.onAudio?.(tx);
    hooks?.onRuntime?.(tx);
    hooks?.onQueue?.(tx);
    hooks?.onMemory?.(tx);

    const formatted = formatPosition(position);
    if (!tx.audioActivatedAt) tx.audioActivatedAt = formatted;
    if (!tx.runtimeActivatedAt) tx.runtimeActivatedAt = formatted;
    if (!tx.queueUpdatedAt) tx.queueUpdatedAt = formatted;
    tx.executionCount = 1;

    const record: SceneExecutionRecord = {
      sceneId,
      queuedAt: queued,
      executeAt: position,
      audioActivatedAt: position,
      runtimeActivatedAt: position,
      memoryRecordedAt: tx.jamMemoryCapturedAt ? position : null,
      boundaryId,
      transaction: tx,
    };
    this.records.push(record);
    return record;
  }

  validateLaunchAlignment(allScenes: SceneDefinition[]): string[] {
    const errors: string[] = [];
    for (const event of performanceScript) {
      if (event.action !== "queue" || !event.target) continue;
      const isScene = allScenes.some((s) => s.id === event.target);
      if (!isScene) continue;
      const launch = performanceScript.find((e) => e.action === "launch" && e.target === event.target);
      if (!launch) {
        errors.push(`Queue ${event.id} missing launch for ${event.target}`);
        continue;
      }
      const launchBar = parsePosition(launch.at).bar;
      const queueBar = event.boundary?.bar;
      if (queueBar !== undefined && queueBar > launchBar) {
        errors.push(`Queue ${event.id} boundary bar ${queueBar} must be on or before launch bar ${launchBar}`);
      }
    }
    return errors;
  }
}

export function buildLaunchBoundaryMap(): Map<number, string> {
  const map = new Map<number, string>();
  for (const event of performanceScript) {
    if (event.action === "launch" && event.target) {
      map.set(parsePosition(event.at).bar, event.target);
    }
  }
  return map;
}

export function buildQueuePlan(): Map<string, { queueEvent: PerformanceScriptEvent; launchEvent: PerformanceScriptEvent; executeAtBar: number }> {
  const plan = new Map<string, { queueEvent: PerformanceScriptEvent; launchEvent: PerformanceScriptEvent; executeAtBar: number }>();
  for (const event of performanceScript) {
    if (event.action !== "launch" || !event.target) continue;
    const queueEvent = [...performanceScript].reverse().find(
      (e) => (e.action === "queue" || e.action === "dragToQueue") && e.target === event.target,
    );
    if (queueEvent) {
      plan.set(event.target, {
        queueEvent,
        launchEvent: event,
        executeAtBar: parsePosition(event.at).bar,
      });
    }
  }
  return plan;
}

export function positionsEqual(a: MusicalPosition, b: MusicalPosition): boolean {
  return positionToTicks(a) === positionToTicks(b);
}

export function barPosition(bar: number, beat = 0, sixteenth = 0): MusicalPosition {
  return positionFromBarBeat(bar, beat, sixteenth);
}

import type { SceneExecutionRecord } from "./sceneExecution";
import type { PerformanceScriptEvent } from "./types";
import { formatPosition, type MusicalPosition } from "./musicalPosition";

export interface RunSnapshot {
  eventIds: string[];
  sceneExecutions: string[];
  queueLength: number;
  historyIds: string[];
  mixFilter: number;
  mixDelayWet: number;
  faders: Record<string, number>;
  scheduleCount: number;
  gsapTweenCount: number;
}

export class RuntimeInstrumentation {
  private eventLog: string[] = [];
  private sceneLog: string[] = [];
  private scheduleCount = 0;
  private gsapTweenCount = 0;

  logEvent(event: PerformanceScriptEvent): void {
    this.eventLog.push(event.id);
  }

  logSceneExecution(record: SceneExecutionRecord): void {
    this.sceneLog.push(record.boundaryId);
  }

  setScheduleCount(n: number): void {
    this.scheduleCount = n;
  }

  setGsapTweenCount(n: number): void {
    this.gsapTweenCount = n;
  }

  snapshot(state: {
    queue: { status: string }[];
    history: { id: string }[];
    mix: { filter: number; delayWet: number; faders: Record<string, number> };
  }): RunSnapshot {
    return {
      eventIds: [...this.eventLog],
      sceneExecutions: [...this.sceneLog],
      queueLength: state.queue.filter((q) => q.status === "queued").length,
      historyIds: state.history.map((h) => h.id),
      mixFilter: state.mix.filter,
      mixDelayWet: state.mix.delayWet,
      faders: { ...state.mix.faders },
      scheduleCount: this.scheduleCount,
      gsapTweenCount: this.gsapTweenCount,
    };
  }

  reset(): void {
    this.eventLog = [];
    this.sceneLog = [];
    this.scheduleCount = 0;
    this.gsapTweenCount = 0;
  }

  compareRuns(a: RunSnapshot, b: RunSnapshot): string[] {
    const diffs: string[] = [];
    if (a.eventIds.join(",") !== b.eventIds.join(",")) diffs.push("event order/count mismatch");
    if (a.sceneExecutions.join(",") !== b.sceneExecutions.join(",")) diffs.push("scene execution mismatch");
    if (a.scheduleCount !== b.scheduleCount) diffs.push(`schedule count ${a.scheduleCount} vs ${b.scheduleCount}`);
    return diffs;
  }
}

export function logLine(position: MusicalPosition, tag: string, detail: string): string {
  return `[${formatPosition(position)}] ${tag}: ${detail}`;
}

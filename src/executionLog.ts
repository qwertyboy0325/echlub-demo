import type { MusicalPosition } from "./musicalPosition";
import { formatPosition } from "./musicalPosition";
import type { SceneExecutionTransaction } from "./sceneExecution";

export interface CueExecutionRecord {
  runId: string;
  draftId: string;
  cueStartedAt: string;
  cueStoppedAt: string;
  masterSceneBefore: string;
  masterSceneDuring: string;
  masterStepCountAtStart: number;
  masterStepCountAtStop: number;
  cueNoteCount: number;
}

export type RestartPhase = "beforeClear" | "afterClear" | "afterReschedule";

export interface RestartPhaseRecord {
  phase: RestartPhase;
  runId: string;
  semanticEventCount: number;
  transportScriptSchedules: number;
  cueSchedules: number;
  registeredNativeTimers: number;
  activeGsapTimelines: number;
  cueActive: boolean;
  queueEmpty: boolean;
  jamMemoryEmpty: boolean;
  sceneAuthorityEmpty: boolean;
}

export class ExecutionLog {
  private runId = "run-1";
  private transactionsLog: SceneExecutionTransaction[] = [];
  private cueRecords: CueExecutionRecord[] = [];
  private restartPhaseRecords: RestartPhaseRecord[] = [];
  private lines: string[] = [];

  setRunId(id: string): void {
    this.runId = id;
  }

  get run(): string {
    return this.runId;
  }

  logTransaction(tx: SceneExecutionTransaction): void {
    this.transactionsLog.push(tx);
    this.lines.push(JSON.stringify({ type: "scene-transaction", ...tx, runId: this.runId }));
  }

  logCue(record: CueExecutionRecord): void {
    this.cueRecords.push(record);
    this.lines.push(JSON.stringify({ type: "cue", ...record }));
  }

  logRestartPhase(record: RestartPhaseRecord): void {
    this.restartPhaseRecords.push(record);
    this.lines.push(JSON.stringify({ type: "restart-phase", ...record }));
  }

  markField(boundaryId: string, field: keyof SceneExecutionTransaction, position: MusicalPosition): void {
    const tx = [...this.transactionsLog].reverse().find((t) => t.boundaryId === boundaryId);
    if (!tx) return;
    const formatted = formatPosition(position);
    (tx as unknown as Record<string, unknown>)[field] = formatted;
    if (field === "audioActivatedAt") tx.executionCount = 1;
  }

  get transactions(): readonly SceneExecutionTransaction[] {
    return this.transactionsLog;
  }

  get cues(): readonly CueExecutionRecord[] {
    return this.cueRecords;
  }

  get restartPhases(): readonly RestartPhaseRecord[] {
    return this.restartPhaseRecords;
  }

  exportJsonl(): string {
    return this.lines.join("\n") + (this.lines.length ? "\n" : "");
  }

  reset(): void {
    this.transactionsLog = [];
    this.cueRecords = [];
    this.lines = [];
  }
}

export const executionLog = new ExecutionLog();

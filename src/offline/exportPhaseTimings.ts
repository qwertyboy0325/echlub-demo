export interface ExportPhaseTimingsMs {
  planning: number;
  graphInitialization: number;
  offlineRendering: number;
  wavEncoding: number;
  audioAnalysis: number;
  hashing: number;
  zipPackaging: number;
  downloadPreparation: number;
  total: number;
}

export const EXPORT_PHASE_KEYS = [
  "planning",
  "graphInitialization",
  "offlineRendering",
  "wavEncoding",
  "audioAnalysis",
  "hashing",
  "zipPackaging",
  "downloadPreparation",
  "total",
] as const satisfies readonly (keyof ExportPhaseTimingsMs)[];

export type ExportPhaseKey = typeof EXPORT_PHASE_KEYS[number];

export type ActiveExportPhase = Exclude<ExportPhaseKey, "total">;

export function createEmptyPhaseTimings(): ExportPhaseTimingsMs {
  return {
    planning: 0,
    graphInitialization: 0,
    offlineRendering: 0,
    wavEncoding: 0,
    audioAnalysis: 0,
    hashing: 0,
    zipPackaging: 0,
    downloadPreparation: 0,
    total: 0,
  };
}

export class ExportPhaseTimer {
  private timings = createEmptyPhaseTimings();
  private exportStart = 0;
  private phaseStart = 0;
  private activePhase: ActiveExportPhase | null = null;

  beginExport(): void {
    this.exportStart = performance.now();
    this.timings = createEmptyPhaseTimings();
    this.activePhase = null;
    this.phaseStart = 0;
  }

  startPhase(phase: ActiveExportPhase): void {
    this.endActivePhase();
    this.activePhase = phase;
    this.phaseStart = performance.now();
  }

  recordPhase(phase: ActiveExportPhase, durationMs: number): void {
    this.timings[phase] += Math.max(0, durationMs);
  }

  endActivePhase(): void {
    if (this.activePhase && this.phaseStart > 0) {
      this.timings[this.activePhase] += performance.now() - this.phaseStart;
    }
    this.activePhase = null;
    this.phaseStart = 0;
  }

  getActivePhase(): ActiveExportPhase | null {
    return this.activePhase;
  }

  getElapsedMs(): number {
    if (this.exportStart === 0) return 0;
    return performance.now() - this.exportStart;
  }

  getPhaseElapsedMs(): number {
    if (!this.activePhase || this.phaseStart === 0) return 0;
    return performance.now() - this.phaseStart;
  }

  finalize(): ExportPhaseTimingsMs {
    this.endActivePhase();
    this.timings.total = Math.max(0, performance.now() - this.exportStart);
    return { ...this.timings };
  }

  peek(): ExportPhaseTimingsMs {
    const snapshot = { ...this.timings };
    if (this.activePhase && this.phaseStart > 0) {
      snapshot[this.activePhase] += performance.now() - this.phaseStart;
    }
    snapshot.total = this.getElapsedMs();
    return snapshot;
  }
}

export function finalizePhaseTimingsTotal(timings: ExportPhaseTimingsMs): ExportPhaseTimingsMs {
  const total = EXPORT_PHASE_KEYS
    .filter((key): key is Exclude<ExportPhaseKey, "total"> => key !== "total")
    .reduce((sum, key) => sum + timings[key], 0);
  return { ...timings, total };
}

export function formatElapsedDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

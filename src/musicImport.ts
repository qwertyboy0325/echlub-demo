/**
 * Import boundary for future reference reconstruction (e.g. 四季ノ唄).
 * Round 2 does not populate this data — schema and adapter contract only.
 */

import type { BrainId, LayerId, MixParams, NoteEvent } from "./types";

export interface TempoMapEntry {
  bar: number;
  bpm: number;
}

export interface SectionDefinition {
  id: string;
  title: string;
  startBar: number;
  bars: number;
}

export interface ImportedPhrase {
  id: string;
  owner: BrainId;
  kind: LayerId;
  notes: NoteEvent[];
}

export interface ImportedPattern {
  id: string;
  owner: BrainId;
  kind: LayerId;
  steps: number[];
}

export interface ImportedFxState {
  id: string;
  params: MixParams;
}

export interface ImportedPerformanceDecision {
  id: string;
  at: string;
  brain: BrainId;
  action: string;
  target?: string;
  value?: string | number;
}

export interface ReconstructionImport {
  version: string;
  tempoMap: TempoMapEntry[];
  sections: SectionDefinition[];
  midiPhrases: ImportedPhrase[];
  drumPatterns: ImportedPattern[];
  bassPatterns: ImportedPattern[];
  harmonyVoicings: Record<string, string[][]>;
  instrumentDefinitions: Record<string, unknown>;
  fxStates: ImportedFxState[];
  automation: Record<string, number[]>;
  performanceDecisions: ImportedPerformanceDecision[];
}

export interface ReconstructionAdapter {
  validate(data: unknown): data is ReconstructionImport;
  apply(data: ReconstructionImport): void;
}

export const reconstructionAdapter: ReconstructionAdapter = {
  validate(data: unknown): data is ReconstructionImport {
    if (!data || typeof data !== "object") return false;
    const d = data as Record<string, unknown>;
    return typeof d.version === "string" && Array.isArray(d.sections);
  },
  apply(): void {
    throw new Error("Reconstruction import not implemented in Round 2 prototype");
  },
};

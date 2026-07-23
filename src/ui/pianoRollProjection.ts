import type { PatternDraft, NoteEvent } from "../types";

const DISPLAY_ROWS = 4;
const PITCH_PADDING = 2;
const FALLBACK_MIN = 48;
const FALLBACK_MAX = 72;

export interface PianoRollProjection {
  minPitch: number;
  maxPitch: number;
  displayRows: number;
}

export function computePianoRollProjection(draft: PatternDraft | undefined): PianoRollProjection {
  const pitches = (draft?.notes ?? []).map((n) => n.pitch);
  if (!pitches.length) {
    return { minPitch: FALLBACK_MIN, maxPitch: FALLBACK_MAX, displayRows: DISPLAY_ROWS };
  }
  const rawMin = Math.min(...pitches);
  const rawMax = Math.max(...pitches);
  return {
    minPitch: Math.max(0, rawMin - PITCH_PADDING),
    maxPitch: Math.min(127, rawMax + PITCH_PADDING),
    displayRows: DISPLAY_ROWS,
  };
}

/** Map MIDI pitch to a visible row; higher pitch → lower row index (visually higher). */
export function pitchToDisplayRow(pitch: number, projection: PianoRollProjection): number {
  const { minPitch, maxPitch, displayRows } = projection;
  if (maxPitch === minPitch) return 0;
  const normalized = (maxPitch - pitch) / (maxPitch - minPitch);
  return Math.round(normalized * (displayRows - 1));
}

export function pianoNoteInlineStyle(note: NoteEvent, draft: PatternDraft | undefined): string {
  const projection = computePianoRollProjection(draft);
  const row = pitchToDisplayRow(note.pitch, projection);
  return `--step:${note.step};--pitch-row:${row};--pitch-rows:${projection.displayRows}`;
}

export function pianoRollDataAttributes(draft: PatternDraft | undefined): string {
  const projection = computePianoRollProjection(draft);
  return `data-pitch-rows="${projection.displayRows}" data-pitch-min="${projection.minPitch}" data-pitch-max="${projection.maxPitch}"`;
}

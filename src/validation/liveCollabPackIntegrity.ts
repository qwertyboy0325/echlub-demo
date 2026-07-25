import { createHash } from "node:crypto";
import type { ReconstructionPack } from "../domain/reconstructionPack";
import type { LiveCollabPack, LoopUnitEvent } from "../domain/liveCollabPack";

function roundVelocity(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function draftToLoopEvents(
  pack: ReconstructionPack,
  draftId: string,
  maxBars: number,
): LoopUnitEvent[] {
  const draft = pack.drafts.find((d) => d.id === draftId);
  if (!draft) return [];

  const events: LoopUnitEvent[] = [];
  for (const note of draft.notes ?? []) {
    if ((note.bar ?? 0) >= maxBars) continue;
    events.push({
      type: "note",
      bar: note.bar ?? 0,
      step: note.step,
      pitch: note.pitch,
      duration: note.duration,
      velocity: roundVelocity(note.velocity),
      instrument: note.instrument,
    });
  }
  for (const chord of draft.harmonyChords ?? []) {
    if (chord.bar >= maxBars) continue;
    events.push({
      type: "chord",
      bar: chord.bar,
      step: chord.step ?? 0,
      notes: [...chord.notes],
      duration: chord.duration,
      velocity: chord.velocity,
    });
  }
  for (const hit of draft.drumHits ?? []) {
    if (hit.bar >= maxBars) continue;
    events.push({
      type: "drum",
      bar: hit.bar,
      step: hit.step,
      voice: hit.voice,
      duration: hit.duration,
      velocity: roundVelocity(hit.velocity),
    });
  }
  return events;
}

export function expectedVerbatimEvents(
  sourcePack: ReconstructionPack,
  sourceDraftId: string,
  patternBars: number,
): LoopUnitEvent[] {
  return draftToLoopEvents(sourcePack, sourceDraftId, patternBars);
}

export function loopUnitInventorySummary(pack: LiveCollabPack): Array<{
  id: string;
  desk: string;
  role: string;
  patternBars: number;
  eventCount: number;
  method: string;
  loop: boolean;
}> {
  return pack.loopUnits.map((unit) => ({
    id: unit.id,
    desk: unit.desk,
    role: unit.role,
    patternBars: unit.patternBars,
    eventCount: unit.events.length,
    method: unit.provenance.method,
    loop: unit.loop,
  }));
}

export function loopEventsFingerprint(events: LoopUnitEvent[]): string {
  return createHash("sha256").update(JSON.stringify(events)).digest("hex");
}

export function eventsMatchSourceNotes(
  unitEvents: LoopUnitEvent[],
  sourceEvents: LoopUnitEvent[],
): boolean {
  const notes = unitEvents.filter((e) => e.type === "note");
  const sourceNotes = sourceEvents.filter((e) => e.type === "note");
  if (notes.length !== sourceNotes.length) return false;
  return notes.every((note, index) => {
    const source = sourceNotes[index];
    return note.bar === source.bar
      && note.step === source.step
      && note.pitch === source.pitch
      && note.duration === source.duration
      && note.velocity === source.velocity;
  });
}

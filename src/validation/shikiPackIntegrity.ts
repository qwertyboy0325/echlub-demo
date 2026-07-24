import { createHash } from "node:crypto";
import type { ReconstructionPack } from "../domain/reconstructionPack";

export const SHIKI_PUBLIC_PACK_PATH = "public/shiki-no-uta.demo.pack.json";
export const SHIKI_PUBLIC_PACK_ID = "shiki-no-uta-cover-public-demo-v1";
export const SHIKI_PRIVATE_PACK_RELATIVE = "local-reconstruction/shiki-no-uta.midi-only.pack.json";

export interface ShikiMusicalEvent {
  bar?: number;
  step?: number;
  pitch?: number | string;
  duration?: string;
  velocity: number;
}

function roundVelocity(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function draftEventCount(draft: ReconstructionPack["drafts"][number]): number {
  if (draft.notes?.length) return draft.notes.length;
  if (draft.drumHits?.length) return draft.drumHits.length;
  if (draft.harmonyChords?.length) {
    return draft.harmonyChords.reduce((sum, chord) => sum + chord.notes.length, 0);
  }
  return 0;
}

export function collectTrackMusicalEvents(
  pack: ReconstructionPack,
  trackId: string,
): ShikiMusicalEvent[] {
  const track = pack.tracks.find(({ id }) => id === trackId);
  if (!track) return [];

  const events: ShikiMusicalEvent[] = [];
  for (const draftId of track.draftIds) {
    const draft = pack.drafts.find(({ id }) => id === draftId);
    if (!draft) continue;

    for (const note of draft.notes ?? []) {
      events.push({
        bar: note.bar,
        step: note.step,
        pitch: note.pitch,
        duration: note.duration,
        velocity: roundVelocity(note.velocity),
      });
    }

    for (const chord of draft.harmonyChords ?? []) {
      for (const _noteName of chord.notes) {
        events.push({
          bar: chord.bar,
          step: chord.step,
          pitch: undefined,
          duration: undefined,
          velocity: roundVelocity(Number.NaN),
        });
      }
    }

    for (const hit of draft.drumHits ?? []) {
      events.push({
        bar: hit.bar,
        step: hit.step,
        pitch: hit.voice,
        duration: "drum",
        velocity: roundVelocity(hit.velocity),
      });
    }
  }

  return events;
}

export function buildTrackEventCounts(pack: ReconstructionPack): Record<string, number> {
  return Object.fromEntries(
    pack.tracks.map((track) => [
      track.id,
      track.draftIds.reduce((sum, draftId) => {
        const draft = pack.drafts.find(({ id }) => id === draftId);
        return sum + (draft ? draftEventCount(draft) : 0);
      }, 0),
    ]),
  );
}

export function buildTrackFingerprints(pack: ReconstructionPack): Record<string, string> {
  return Object.fromEntries(
    pack.tracks.map((track) => [
      track.id,
      createHash("sha256")
        .update(JSON.stringify(collectTrackMusicalEvents(pack, track.id)))
        .digest("hex"),
    ]),
  );
}

export function buildClipRevisionSnapshot(pack: ReconstructionPack): Record<string, number> {
  return Object.fromEntries(pack.drafts.map(({ id, revision }) => [id, revision]));
}

export function buildTrackAssignmentSnapshot(
  pack: ReconstructionPack,
): Record<string, { label: string; layerKind: string; draftIds: string[] }> {
  return Object.fromEntries(
    pack.tracks.map(({ id, label, layerKind, draftIds }) => [
      id,
      { label, layerKind, draftIds: [...draftIds] },
    ]),
  );
}

export function buildTempoSnapshot(pack: ReconstructionPack): {
  bpm: number;
  tempoMap: ReconstructionPack["tempoMap"];
  timeSignatures: ReconstructionPack["timeSignatures"];
} {
  return {
    bpm: pack.metadata.bpm,
    tempoMap: pack.tempoMap,
    timeSignatures: pack.timeSignatures,
  };
}

export function buildArrangementSectionSnapshot(
  pack: ReconstructionPack,
): Array<{ id: string; startBar: number; bars: number }> {
  return pack.sections.map(({ id, startBar, bars }) => ({ id, startBar, bars }));
}

export function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

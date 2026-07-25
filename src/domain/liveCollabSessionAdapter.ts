import type { LayerId, NoteEvent, PatternDraft } from "../types";
import type { BrainId } from "../types";
import type { ReconstructionPack, SceneLayerStackMap, ScenePlacementMap } from "./reconstructionPack";
import { RECONSTRUCTION_PACK_SCHEMA_VERSION } from "./reconstructionPack";
import type { LiveCollabDeskId, LiveCollabPack, LoopUnit, LoopUnitEvent } from "./liveCollabPack";
import { SHIKI_LIVE_COLLAB_PACK_ID } from "./liveCollabPack";
import {
  SHIKI_SEVEN_TRACK_IDS,
  SHIKI_SEVEN_TRACK_INSTRUMENTS,
  type ShikiSevenTrackId,
} from "./shikiSevenTracks";
import type { ProductionRoleId } from "./sessionTypes";

export type TrackPlacementMap = Record<string, Partial<Record<ShikiSevenTrackId, string>>>;

function deskToBrain(desk: LiveCollabDeskId): BrainId {
  switch (desk) {
    case "rhythm":
      return "pulse";
    case "keys":
      return "blend";
    case "horns":
      return "memory";
    case "guitar":
      return "story";
  }
}

function deskToRoleId(desk: LiveCollabDeskId): ProductionRoleId {
  switch (desk) {
    case "rhythm":
      return "rhythm";
    case "keys":
      return "harmony";
    case "horns":
      return "melody";
    case "guitar":
      return "melody";
  }
}

function noteInstrument(value: string | undefined): NoteEvent["instrument"] | undefined {
  if (value === "reed" || value === "reed-alto" || value === "reed-tenor" || value === "guitar") return value;
  if (value === "default") return "default";
  return undefined;
}

const MELODY_TRACKS: ShikiSevenTrackId[] = [
  "track-tenor",
  "track-guitar",
  "track-alto",
];

const ALTO_PRIMARY_SECTIONS = new Set([
  "lead-a",
  "lead-c",
  "lead-d",
  "return-a",
  "return-b",
  "outro",
  "interlude",
]);

export const LIVE_COLLAB_LAUNCH_ORDER: readonly ShikiSevenTrackId[] = [
  "track-piano-lh",
  "track-bass",
  "track-drums",
  "track-piano-rh",
  "track-guitar",
  "track-alto",
  "track-tenor",
] as const;

export const LIVE_COLLAB_SLOT_TRACKS: Record<string, ShikiSevenTrackId> = Object.fromEntries(
  LIVE_COLLAB_LAUNCH_ORDER.map((trackId, index) => [`lane-${index + 1}`, trackId]),
) as Record<string, ShikiSevenTrackId>;

function layerKindForTrack(trackId: ShikiSevenTrackId): LayerId {
  switch (trackId) {
    case "track-drums":
      return "drums";
    case "track-piano-rh":
      return "harmony";
    case "track-bass":
    case "track-piano-lh":
      return "bass";
    default:
      return "melody";
  }
}

function pitchToName(pitch: number | string): string {
  if (typeof pitch === "string") return pitch;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(pitch / 12) - 1;
  return `${names[pitch % 12]}${octave}`;
}

function loopEventToNote(event: LoopUnitEvent, unitId: string, index: number): NoteEvent {
  const pitch = typeof event.pitch === "number" ? event.pitch : 60;
  return {
    id: `${unitId}-n${index}`,
    bar: event.bar,
    step: event.step,
    pitch,
    note: pitchToName(pitch),
    duration: event.duration ?? "4n",
    velocity: event.velocity ?? 0.7,
    instrument: noteInstrument(event.instrument),
  };
}

export function loopUnitToDraft(unit: LoopUnit, trackId: ShikiSevenTrackId): PatternDraft {
  const kind = layerKindForTrack(trackId);
  const base = {
    id: unit.id,
    title: unit.id,
    kind,
    status: "ready" as const,
    revision: 0,
    patternBars: unit.patternBars,
    owner: deskToBrain(unit.desk),
  };

  if (kind === "drums") {
    return {
      ...base,
      kind: "drums",
      drumHits: unit.events
        .filter((event) => event.type === "drum")
        .map((event) => ({
          bar: event.bar,
          step: event.step,
          voice: (event.voice ?? "kick") as "kick" | "snare" | "hat",
          duration: event.duration,
          velocity: event.velocity ?? 0.7,
        })),
    };
  }

  if (kind === "harmony") {
    const chords = unit.events
      .filter((event) => event.type === "chord")
      .map((event, index) => ({
        id: `${unit.id}-c${index}`,
        bar: event.bar,
        step: event.step ?? 0,
        notes: (event.notes ?? []).map((note) => (typeof note === "number" ? pitchToName(note) : note)),
        duration: event.duration ?? "4n",
        velocity: event.velocity ?? 0.7,
      }));
    if (chords.length) return { ...base, kind: "harmony", harmonyChords: chords };
    const notes = unit.events.filter((event) => event.type === "note");
    return {
      ...base,
      kind: "harmony",
      harmonyChords: notes.map((event, index) => ({
        id: `${unit.id}-c${index}`,
        bar: event.bar,
        step: event.step,
        notes: [pitchToName(event.pitch ?? 60)],
        duration: event.duration ?? "4n",
        velocity: event.velocity ?? 0.7,
      })),
    };
  }

  const notes = unit.events
    .filter((event) => event.type === "note")
    .map((event, index) => loopEventToNote(event, unit.id, index));
  return { ...base, notes };
}

function primaryMelodyTrack(
  sectionId: string,
  placements: Partial<Record<ShikiSevenTrackId, string>>,
): ShikiSevenTrackId | null {
  const has = (trackId: ShikiSevenTrackId) => Boolean(placements[trackId]);
  if (sectionId === "trade" && has("track-tenor")) return "track-tenor";
  if (ALTO_PRIMARY_SECTIONS.has(sectionId) && has("track-alto")) return "track-alto";
  for (const trackId of MELODY_TRACKS) {
    if (has(trackId)) return trackId;
  }
  return null;
}

export function sectionPlacementsToSceneLayers(
  sectionId: string,
  placements: Partial<Record<ShikiSevenTrackId, string>>,
): {
  layers: Partial<Record<LayerId, string>>;
  stacks: Partial<Record<LayerId, string[]>>;
} {
  const layers: Partial<Record<LayerId, string>> = {};
  const stacks: Partial<Record<LayerId, string[]>> = {};
  const addStack = (layer: LayerId, unitId: string) => {
    stacks[layer] = [...(stacks[layer] ?? []), unitId];
  };

  if (placements["track-drums"]) layers.drums = placements["track-drums"];
  if (placements["track-bass"]) layers.bass = placements["track-bass"];
  if (placements["track-piano-lh"]) addStack("bass", placements["track-piano-lh"]!);
  if (placements["track-piano-rh"]) {
    layers.harmony = placements["track-piano-rh"];
    addStack("harmony", placements["track-piano-rh"]!);
  }

  const primary = primaryMelodyTrack(sectionId, placements);
  if (primary) {
    layers.melody = placements[primary]!;
    for (const trackId of MELODY_TRACKS) {
      if (trackId !== primary && placements[trackId]) addStack("melody", placements[trackId]!);
    }
  }

  return { layers, stacks };
}

export function buildTrackPlacementMap(livePack: LiveCollabPack): TrackPlacementMap {
  const map: TrackPlacementMap = {};
  for (const entry of livePack.arrangementMap) {
    map[entry.sectionId] = { ...entry.placements } as Partial<Record<ShikiSevenTrackId, string>>;
  }
  return map;
}

export function buildScenePlacementMaps(
  trackPlacements: TrackPlacementMap,
): { scenePlacements: ScenePlacementMap; sceneLayerStacks: SceneLayerStackMap } {
  const scenePlacements: ScenePlacementMap = {};
  const sceneLayerStacks: SceneLayerStackMap = {};
  for (const [sectionId, placements] of Object.entries(trackPlacements)) {
    const { layers, stacks } = sectionPlacementsToSceneLayers(sectionId, placements);
    scenePlacements[sectionId] = layers;
    if (Object.keys(stacks).length) sceneLayerStacks[sectionId] = stacks;
  }
  return { scenePlacements, sceneLayerStacks };
}

function defaultFx() {
  return {
    filter: 6400,
    delayWet: 0.08,
    reverbWet: 0.12,
    masterGain: 4,
    faders: { groove: 71, harmony: 51, melody: 77, texture: 0 },
  };
}

export function adaptLiveCollabPack(livePack: LiveCollabPack): {
  pack: ReconstructionPack;
  trackPlacements: TrackPlacementMap;
} {
  const trackPlacements = buildTrackPlacementMap(livePack);
  const { scenePlacements, sceneLayerStacks } = buildScenePlacementMaps(trackPlacements);
  const unitById = new Map(livePack.loopUnits.map((unit) => [unit.id, unit]));
  const draftKinds = new Map<string, LayerId>();

  for (const placements of Object.values(trackPlacements)) {
    for (const [trackId, unitId] of Object.entries(placements)) {
      if (!unitId) continue;
      draftKinds.set(unitId, layerKindForTrack(trackId as ShikiSevenTrackId));
    }
  }

  const drafts: PatternDraft[] = livePack.loopUnits.map((unit) => {
    const trackId = (unit.trackIds[0] ?? "track-bass") as ShikiSevenTrackId;
    const kind = draftKinds.get(unit.id) ?? layerKindForTrack(trackId);
    return loopUnitToDraft(unit, kind === layerKindForTrack(trackId) ? trackId : (
      SHIKI_SEVEN_TRACK_IDS.find((id) => layerKindForTrack(id) === kind) ?? trackId
    ));
  });

  const pack: ReconstructionPack = {
    schemaVersion: RECONSTRUCTION_PACK_SCHEMA_VERSION,
    metadata: {
      id: SHIKI_LIVE_COLLAB_PACK_ID,
      title: livePack.metadata.title,
      bpm: livePack.metadata.bpm,
      prototypeOnly: true,
      source: "public-demo",
    },
    provenance: {
      createdBy: "live-collab-adapter",
      sourceDescription: `Derived from ${livePack.derivedFrom.packId}`,
      rightsBasis: "owner-authorized-public-cover",
      referenceAssetIds: [],
    },
    confidence: {
      overall: 1,
      rhythm: 1,
      harmony: 1,
      melody: 1,
      arrangement: 1,
      notes: ["live-collab derived pack"],
    },
    tempoMap: [{ bar: 0, bpm: livePack.metadata.bpm }],
    timeSignatures: [{ bar: 0, numerator: 4, denominator: 4 }],
    sections: livePack.sections,
    participants: livePack.participants.map((participant) => ({
      id: participant.id,
      roleId: deskToRoleId(participant.desk),
      displayName: participant.name,
      performanceBrain: deskToBrain(participant.desk),
      workspaceIds: [`ws-${participant.id}`],
    })),
    workspaces: [],
    tracks: SHIKI_SEVEN_TRACK_IDS.map((trackId) => ({
      id: trackId,
      label: SHIKI_SEVEN_TRACK_INSTRUMENTS[trackId],
      layerKind: layerKindForTrack(trackId),
      draftIds: livePack.loopUnits
        .filter((unit) => unit.trackIds.includes(trackId))
        .map((unit) => unit.id),
      gain: 0.7,
    })),
    drafts,
    scenes: livePack.sections.map((section) => ({
      id: section.id,
      title: section.label,
      bars: section.bars,
      startBar: section.startBar,
      description: section.label,
      layers: { drums: null, bass: null, harmony: null, melody: null, texture: null },
      layerStacks: {},
      fx: defaultFx(),
    })),
    scenePlacements,
    sceneLayerStacks,
    defaultMix: livePack.defaultMix,
    soundDesign: livePack.soundDesign,
    arrangement: {
      id: "live-collab-arrangement",
      title: livePack.metadata.title,
      totalBars: livePack.metadata.totalBars,
      scenes: [],
    },
    productionChoreography: [],
    livePerformanceChoreography: [],
    liveStructuralOperations: [],
    performanceViews: [],
  };

  void unitById;
  return { pack, trackPlacements };
}

export function filterTrackPlacements(
  trackPlacements: TrackPlacementMap,
  activeTracks: ReadonlySet<ShikiSevenTrackId>,
): TrackPlacementMap {
  const filtered: TrackPlacementMap = {};
  for (const [sectionId, placements] of Object.entries(trackPlacements)) {
    const next: Partial<Record<ShikiSevenTrackId, string>> = {};
    for (const trackId of activeTracks) {
      const unitId = placements[trackId];
      if (unitId) next[trackId] = unitId;
    }
    filtered[sectionId] = next;
  }
  return filtered;
}

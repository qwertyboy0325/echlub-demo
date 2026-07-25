#!/usr/bin/env node
/**
 * Derives public/shiki-no-uta.live-collab.pack.json from the read-only public cover pack.
 * Methods: extract | collapse | verbatim | mutate-fork only — no AI melody rewrite.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_PATH = resolve("public/shiki-no-uta.demo.pack.json");
const OUTPUT_PATH = resolve("public/shiki-no-uta.live-collab.pack.json");
const SOURCE_SHA = "85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af";
const SOURCE_PACK_ID = "shiki-no-uta-cover-public-demo-v1";
const DERIVED_PACK_ID = "shiki-no-uta-live-collab-demo-v1";

const sourceRaw = readFileSync(SOURCE_PATH, "utf8");
const sourceSha = createHash("sha256").update(sourceRaw).digest("hex");
if (sourceSha !== SOURCE_SHA) {
  throw new Error(`Source pack SHA mismatch: expected ${SOURCE_SHA}, got ${sourceSha}`);
}
const source = JSON.parse(sourceRaw);

function draftById(id) {
  const draft = source.drafts.find((d) => d.id === id);
  if (!draft) throw new Error(`Missing source draft: ${id}`);
  return structuredClone(draft);
}

function inBarRange(bar, maxBars) {
  return bar >= 0 && bar < maxBars;
}

function extractNotes(notes, maxBars) {
  return (notes ?? []).filter((n) => inBarRange(n.bar ?? 0, maxBars));
}

function extractDrumHits(hits, maxBars) {
  return (hits ?? []).filter((h) => inBarRange(h.bar, maxBars));
}

function extractChords(chords, maxBars) {
  return (chords ?? []).filter((c) => inBarRange(c.bar, maxBars));
}

function buildEventsFromDraft(draft, maxBars) {
  const events = [];
  for (const note of extractNotes(draft.notes, maxBars)) {
    events.push({
      type: "note",
      bar: note.bar ?? 0,
      step: note.step,
      pitch: note.pitch ?? note.note,
      duration: note.duration,
      velocity: note.velocity,
      instrument: note.instrument,
    });
  }
  for (const chord of extractChords(draft.harmonyChords, maxBars)) {
    events.push({
      type: "chord",
      bar: chord.bar,
      step: chord.step ?? 0,
      notes: chord.notes,
      duration: chord.duration,
      velocity: chord.velocity,
    });
  }
  for (const hit of extractDrumHits(draft.drumHits, maxBars)) {
    events.push({
      type: "drum",
      bar: hit.bar,
      step: hit.step,
      voice: hit.voice,
      duration: hit.duration,
      velocity: hit.velocity,
    });
  }
  return events;
}

function verbatimEvents(draftId, patternBars) {
  const draft = draftById(draftId);
  return buildEventsFromDraft(draft, patternBars ?? draft.patternBars ?? 8);
}

function collapseEvents(primaryDraftId, maxBars) {
  const draft = draftById(primaryDraftId);
  return buildEventsFromDraft(draft, maxBars);
}

function mutateForkGuitar(draftId, maxBars) {
  const events = collapseEvents(draftId, maxBars);
  return events.map((event, index) => {
    if (event.type !== "note" || index % 4 !== 0) return event;
    return {
      ...event,
      pitch: typeof event.pitch === "number" ? event.pitch + 2 : event.pitch,
      velocity: Math.min(1, (event.velocity ?? 0.6) * 1.08),
    };
  });
}

/** @type {import("../src/domain/liveCollabPack.ts").LoopUnitSpec[]} */
const UNIT_SPECS = [
  { id: "ryo-bass-sparse-4", desk: "rhythm", role: "bed", patternBars: 4, trackIds: ["track-bass"], sourceDraftIds: ["midi-opening-bass", "midi-entry-bass", "midi-bridge-bass"], method: "extract", loop: true, build: () => collapseEvents("midi-opening-bass", 4) },
  { id: "ryo-bass-2", desk: "rhythm", role: "groove", patternBars: 2, trackIds: ["track-bass"], sourceDraftIds: ["midi-lead-a-bass", "midi-trade-bass", "midi-lead-c-bass", "midi-lead-d-bass", "midi-return-a-bass", "midi-return-b-bass", "midi-instrumental-a-bass", "midi-instrumental-b-bass"], method: "collapse", loop: true, build: () => collapseEvents("midi-lead-a-bass", 2) },
  { id: "ryo-entry-4", desk: "rhythm", role: "light groove", patternBars: 4, trackIds: ["track-drums"], sourceDraftIds: ["midi-entry-drums"], method: "extract", loop: true, build: () => collapseEvents("midi-entry-drums", 4) },
  { id: "ryo-groove-4", desk: "rhythm", role: "main groove", patternBars: 4, trackIds: ["track-drums"], sourceDraftIds: ["midi-trade-drums", "midi-lead-c-drums"], method: "collapse", loop: true, build: () => collapseEvents("midi-trade-drums", 4) },
  { id: "ryo-break-4", desk: "rhythm", role: "fill", patternBars: 4, trackIds: ["track-drums"], sourceDraftIds: ["midi-interlude-drums"], method: "extract", loop: false, build: () => collapseEvents("midi-interlude-drums", 4) },

  { id: "kai-lh-sparse-4", desk: "keys", role: "bed", patternBars: 4, trackIds: ["track-piano-lh"], sourceDraftIds: ["midi-opening-piano-lh"], method: "extract", loop: true, build: () => collapseEvents("midi-opening-piano-lh", 4) },
  { id: "kai-lh-pulse-2", desk: "keys", role: "groove", patternBars: 2, trackIds: ["track-piano-lh"], sourceDraftIds: ["midi-lead-a-piano-lh", "midi-trade-piano-lh"], method: "collapse", loop: true, build: () => collapseEvents("midi-lead-a-piano-lh", 2) },
  { id: "kai-lh-walk-4", desk: "keys", role: "groove", patternBars: 4, trackIds: ["track-piano-lh"], sourceDraftIds: ["midi-lead-c-piano-lh", "midi-return-a-piano-lh"], method: "collapse", loop: true, build: () => collapseEvents("midi-lead-c-piano-lh", 4) },
  { id: "kai-rh-pad-4", desk: "keys", role: "bed", patternBars: 4, trackIds: ["track-piano-rh"], sourceDraftIds: ["midi-entry-piano-rh"], method: "extract", loop: true, build: () => collapseEvents("midi-entry-piano-rh", 4) },
  // lead-a RH bars 0-4 are byte-identical to entry RH (pad); the only real RH lift
  // material in the source is the interlude broken-chord densification.
  { id: "kai-rh-lift-4", desk: "keys", role: "harmony lift", patternBars: 4, trackIds: ["track-piano-rh"], sourceDraftIds: ["midi-interlude-piano-rh"], method: "extract", loop: true, build: () => collapseEvents("midi-interlude-piano-rh", 4) },

  { id: "mei-tenor-entry-8", desk: "horns", role: "identity", patternBars: 8, trackIds: ["track-tenor"], sourceDraftIds: ["midi-entry-tenor"], method: "verbatim", loop: true, build: () => verbatimEvents("midi-entry-tenor", 8) },
  { id: "mei-alto-themeA-8", desk: "horns", role: "hook", patternBars: 8, trackIds: ["track-alto"], sourceDraftIds: ["midi-lead-a-alto"], method: "verbatim", loop: true, build: () => verbatimEvents("midi-lead-a-alto", 8) },
  { id: "mei-alto-themeB-8", desk: "horns", role: "hook", patternBars: 8, trackIds: ["track-alto"], sourceDraftIds: ["midi-lead-c-alto"], method: "verbatim", loop: true, build: () => verbatimEvents("midi-lead-c-alto", 8) },
  { id: "mei-alto-trade-8", desk: "horns", role: "hook", patternBars: 8, trackIds: ["track-alto"], sourceDraftIds: ["midi-trade-alto"], method: "verbatim", loop: false, build: () => verbatimEvents("midi-trade-alto", 8) },
  { id: "mei-tenor-answer-8", desk: "horns", role: "answer", patternBars: 8, trackIds: ["track-tenor"], sourceDraftIds: ["midi-lead-a-tenor", "midi-trade-tenor"], method: "collapse", loop: true, build: () => collapseEvents("midi-lead-a-tenor", 8) },
  { id: "mei-outro-4", desk: "horns", role: "cadence", patternBars: 4, trackIds: ["track-alto"], sourceDraftIds: ["midi-outro-alto"], method: "extract", loop: true, build: () => collapseEvents("midi-outro-alto", 4) },

  { id: "ren-open-4", desk: "guitar", role: "thin color", patternBars: 4, trackIds: ["track-guitar"], sourceDraftIds: ["midi-opening-guitar"], method: "extract", loop: true, build: () => collapseEvents("midi-opening-guitar", 4) },
  { id: "ren-comp-2", desk: "guitar", role: "bed", patternBars: 2, trackIds: ["track-guitar"], sourceDraftIds: ["midi-lead-a-guitar"], method: "extract", loop: true, build: () => collapseEvents("midi-lead-a-guitar", 2) },
  { id: "ren-fork-alt-2", desk: "guitar", role: "demo fork", patternBars: 2, trackIds: ["track-guitar"], sourceDraftIds: ["midi-trade-guitar"], method: "mutate-fork", loop: true, build: () => mutateForkGuitar("midi-trade-guitar", 2) },
];

const loopUnits = UNIT_SPECS.map((spec) => ({
  id: spec.id,
  desk: spec.desk,
  role: spec.role,
  patternBars: spec.patternBars,
  trackIds: spec.trackIds,
  events: spec.build(),
  provenance: {
    sourceDraftIds: spec.sourceDraftIds,
    method: spec.method,
  },
  loop: spec.loop,
}));

const arrangementMap = [
  { sectionId: "opening", placements: { "track-piano-lh": "kai-lh-sparse-4", "track-bass": "ryo-bass-sparse-4", "track-guitar": "ren-open-4" } },
  { sectionId: "entry", placements: { "track-piano-lh": "kai-lh-sparse-4", "track-bass": "ryo-bass-sparse-4", "track-drums": "ryo-entry-4", "track-piano-rh": "kai-rh-pad-4", "track-tenor": "mei-tenor-entry-8" } },
  { sectionId: "lead-a", placements: { "track-piano-lh": "kai-lh-pulse-2", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-comp-2", "track-alto": "mei-alto-themeA-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "trade", placements: { "track-piano-lh": "kai-lh-walk-4", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-comp-2", "track-alto": "mei-alto-trade-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "lead-c", placements: { "track-piano-lh": "kai-lh-walk-4", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-comp-2", "track-alto": "mei-alto-themeB-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "lead-d", placements: { "track-piano-lh": "kai-lh-walk-4", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-comp-2", "track-alto": "mei-alto-themeA-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "interlude", placements: { "track-piano-lh": "kai-lh-sparse-4", "track-bass": "ryo-bass-sparse-4", "track-drums": "ryo-break-4", "track-piano-rh": "kai-rh-lift-4", "track-guitar": "ren-open-4", "track-alto": "mei-alto-themeA-8" } },
  { sectionId: "instrumental-a", placements: { "track-piano-lh": "kai-lh-pulse-2", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-comp-2", "track-alto": "mei-alto-themeB-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "instrumental-b", placements: { "track-piano-lh": "kai-lh-walk-4", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-comp-2", "track-alto": "mei-alto-themeA-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "bridge", placements: { "track-piano-lh": "kai-lh-sparse-4", "track-bass": "ryo-bass-sparse-4", "track-drums": "ryo-entry-4", "track-piano-rh": "kai-rh-pad-4", "track-alto": "mei-alto-themeB-8" } },
  { sectionId: "return-a", placements: { "track-piano-lh": "kai-lh-pulse-2", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-comp-2", "track-alto": "mei-alto-themeA-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "return-b", placements: { "track-piano-lh": "kai-lh-walk-4", "track-bass": "ryo-bass-2", "track-drums": "ryo-groove-4", "track-piano-rh": "kai-rh-pad-4", "track-guitar": "ren-fork-alt-2", "track-alto": "mei-alto-trade-8", "track-tenor": "mei-tenor-answer-8" } },
  { sectionId: "outro", placements: { "track-piano-lh": "kai-lh-sparse-4", "track-bass": "ryo-bass-sparse-4", "track-piano-rh": "kai-rh-pad-4", "track-alto": "mei-outro-4", "track-tenor": "mei-tenor-entry-8" } },
];

const defaultMix = {
  ...structuredClone(source.defaultMix),
  desk: {
    rhythm: { gainDb: 0, mute: false, delaySend: 0, reverbSend: 0.05 },
    keys: { gainDb: 0, mute: false, delaySend: 0.15, reverbSend: 0.2 },
    horns: { gainDb: 0, mute: false, delaySend: 0.45, reverbSend: 0.25 },
    guitar: { gainDb: 0, mute: false, delaySend: 0.3, reverbSend: 0.1 },
  },
};

const derived = {
  schemaVersion: 1,
  id: DERIVED_PACK_ID,
  derivedFrom: {
    packId: SOURCE_PACK_ID,
    packSha256: SOURCE_SHA,
  },
  metadata: {
    title: "Shiki No Uta · Live-collab demo materials",
    bpm: source.metadata.bpm,
    totalBars: source.arrangement.totalBars,
    sectionCount: source.sections.length,
  },
  deskBus: { enabled: true, version: 1 },
  participants: [
    { id: "p1", name: "Ryo", desk: "rhythm", trackIds: ["track-drums", "track-bass"] },
    { id: "p2", name: "Kai", desk: "keys", trackIds: ["track-piano-lh", "track-piano-rh"] },
    { id: "p3", name: "Mei", desk: "horns", trackIds: ["track-alto", "track-tenor"] },
    { id: "p4", name: "Ren", desk: "guitar", trackIds: ["track-guitar"] },
  ],
  loopUnits,
  arrangementMap,
  soundDesign: structuredClone(source.soundDesign),
  defaultMix,
  sections: source.sections.map(({ id, label, startBar, bars }) => ({ id, label, startBar, bars })),
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(derived, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_PATH} · ${loopUnits.length} loop units · derived from ${SOURCE_PACK_ID}`);

#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const midiPath = path.resolve(process.argv[2] ?? "");
const basePackPath = path.resolve(process.env.BASE_PACK_PATH ?? path.join(root, "public/shiki-no-uta.demo.pack.json"));
const outputPath = path.resolve(process.env.OUTPUT_PATH ?? path.join(root, "local-reconstruction/shiki-no-uta.midi-only.pack.json"));

if (!midiPath) {
  throw new Error("Usage: node scripts/generate-midi-only-cover.mjs /absolute/path/to/file.mid");
}

const analyzerPath = path.join(root, "scripts/analyze-midi-authority.mjs");
const midi = JSON.parse(execFileSync(process.execPath, [analyzerPath, midiPath], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
}));
const base = JSON.parse(await readFile(basePackPath, "utf8"));

if (midi.format !== 1 || midi.ticksPerQuarter <= 0 || midi.trackCount !== 7) {
  throw new Error("Expected the owner-provided Format 1, seven-track MIDI authority");
}

const ticksPerBar = midi.ticksPerQuarter * 4;
const tonePpq = 192;
const sections = [
  { id: "opening", label: "MIDI bars 1–4 · opening", startBar: 0, bars: 4 },
  { id: "entry", label: "MIDI bars 5–12 · rhythm and tenor entry", startBar: 4, bars: 8 },
  { id: "lead-a", label: "MIDI bars 13–20 · first lead statement", startBar: 12, bars: 8 },
  { id: "trade", label: "MIDI bars 21–28 · sax exchange", startBar: 20, bars: 8 },
  { id: "lead-c", label: "MIDI bars 29–36 · lead variation", startBar: 28, bars: 8 },
  { id: "lead-d", label: "MIDI bars 37–44 · second lead statement", startBar: 36, bars: 8 },
  { id: "interlude", label: "MIDI bars 45–52 · drum-led interlude", startBar: 44, bars: 8 },
  { id: "instrumental-a", label: "MIDI bars 53–60 · instrumental pass one", startBar: 52, bars: 8 },
  { id: "instrumental-b", label: "MIDI bars 61–68 · instrumental pass two", startBar: 60, bars: 8 },
  { id: "bridge", label: "MIDI bars 69–72 · sparse bridge", startBar: 68, bars: 4 },
  { id: "return-a", label: "MIDI bars 73–80 · return one", startBar: 72, bars: 8 },
  { id: "return-b", label: "MIDI bars 81–88 · return two", startBar: 80, bars: 8 },
  { id: "outro", label: "MIDI bars 89–104 · stripped outro", startBar: 88, bars: 16 },
];

const trackRoles = [
  { index: 0, suffix: "alto", kind: "melody", owner: "memory", instrument: "reed-alto", trackId: "track-alto", label: "Alto Saxophone" },
  { index: 1, suffix: "tenor", kind: "melody", owner: "memory", instrument: "reed-tenor", trackId: "track-tenor", label: "Tenor Saxophone" },
  { index: 2, suffix: "piano-rh", kind: "harmony", owner: "story", trackId: "track-piano-rh", label: "Piano RH" },
  { index: 3, suffix: "piano-lh", kind: "bass", owner: "pulse", instrument: "default", trackId: "track-piano-lh", label: "Piano LH" },
  { index: 4, suffix: "guitar", kind: "melody", owner: "memory", instrument: "guitar", trackId: "track-guitar", label: "Guitar" },
  { index: 5, suffix: "bass", kind: "bass", owner: "pulse", instrument: "default", trackId: "track-bass", label: "Bass Guitar" },
  { index: 6, suffix: "drums", kind: "drums", owner: "pulse", trackId: "track-drums", label: "Drumset" },
];

const pitchNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const noteName = (midiNote) => `${pitchNames[midiNote % 12]}${Math.floor(midiNote / 12) - 1}`;
const toneDuration = (durationTicks) => `${Math.max(1, Math.round(durationTicks * tonePpq / midi.ticksPerQuarter))}i`;
const velocity = (raw) => Number(Math.max(0.02, Math.min(1, raw / 127)).toFixed(4));

function gridPosition(relativeTick) {
  const exact = relativeTick / (midi.ticksPerQuarter / 4);
  // Attach the event to the preceding sixteenth and schedule forward from it.
  // This preserves the exact MIDI tick without asking Tone to schedule into
  // the past from a later transport callback.
  const rounded = Math.floor(exact + 1e-9);
  const timingOffset = Number(Math.max(0, Math.min(0.99, exact - rounded)).toFixed(4));
  return {
    bar: Math.floor(rounded / 16),
    step: ((rounded % 16) + 16) % 16,
    ...(Math.abs(timingOffset) >= 0.0001 ? { timingOffset } : {}),
  };
}

function notesInSection(track, section) {
  const startTick = section.startBar * ticksPerBar;
  const endTick = (section.startBar + section.bars) * ticksPerBar;
  return track.notes.filter(({ tick }) => tick >= startTick && tick < endTick);
}

function noteDraft(role, track, section, id) {
  const source = notesInSection(track, section);
  const notes = source.map((event, index) => {
    const previous = source[index - 1];
    const connected = previous
      && previous.tick + previous.durationTicks >= event.tick
      && previous.midi !== event.midi;
    return {
      id: `${id}-${index}`,
      ...gridPosition(event.tick - section.startBar * ticksPerBar),
      pitch: event.midi,
      note: noteName(event.midi),
      duration: toneDuration(event.durationTicks),
      velocity: velocity(event.velocity),
      articulation: connected ? "legato" : "normal",
      instrument: role.instrument,
      ...(connected ? { glideFrom: noteName(previous.midi) } : {}),
    };
  });
  return {
    id,
    owner: role.owner,
    title: `${section.label} · ${role.label}`,
    kind: role.kind,
    status: "editing",
    revision: 0,
    patternBars: section.bars,
    notes,
  };
}

function harmonyDraft(role, track, section, id) {
  const byTick = new Map();
  for (const event of notesInSection(track, section)) {
    const group = byTick.get(event.tick) ?? [];
    group.push(event);
    byTick.set(event.tick, group);
  }
  const harmonyChords = [...byTick.entries()].map(([tick, events]) => ({
    ...gridPosition(tick - section.startBar * ticksPerBar),
    notes: events.map(({ midi: midiNote }) => noteName(midiNote)),
    duration: toneDuration(Math.max(...events.map(({ durationTicks }) => durationTicks))),
    velocity: Number((events.reduce((sum, event) => sum + velocity(event.velocity), 0) / events.length).toFixed(4)),
    articulation: "held",
  }));
  return {
    id,
    owner: role.owner,
    title: `${section.label} · ${role.label}`,
    kind: "harmony",
    status: "editing",
    revision: 0,
    patternBars: section.bars,
    harmonyChords,
  };
}

function drumVoice(midiNote) {
  if (midiNote === 35 || midiNote === 36) return "kick";
  if (midiNote === 37) return "rim";
  if (midiNote === 38 || midiNote === 39 || midiNote === 40) return "snare";
  if (midiNote === 41 || midiNote === 43 || midiNote === 45) return "tomLow";
  if (midiNote === 47 || midiNote === 48) return "tomMid";
  if (midiNote === 50) return "tomHigh";
  if (midiNote === 49 || midiNote === 52) return "crash";
  if (midiNote === 51 || midiNote === 53) return "ride";
  return "hat";
}

function drumDraft(role, track, section, id) {
  const drumHits = notesInSection(track, section).map((event) => ({
    ...gridPosition(event.tick - section.startBar * ticksPerBar),
    voice: drumVoice(event.midi),
    velocity: velocity(event.velocity),
    duration: toneDuration(event.durationTicks),
  }));
  return {
    id,
    owner: role.owner,
    title: `${section.label} · ${role.label}`,
    kind: "drums",
    status: "editing",
    revision: 0,
    patternBars: section.bars,
    drumHits,
  };
}

const tracksByIndex = new Map(midi.tracks.map((track) => [track.index, track]));
const drafts = [];
const draftBySectionAndRole = new Map();

for (const section of sections) {
  for (const role of trackRoles) {
    const track = tracksByIndex.get(role.index);
    if (!track || notesInSection(track, section).length === 0) continue;
    const id = section.id === "opening" && role.suffix === "tenor"
      ? "memory-opening"
      : `midi-${section.id}-${role.suffix}`;
    const draft = role.kind === "drums"
      ? drumDraft(role, track, section, id)
      : role.kind === "harmony"
        ? harmonyDraft(role, track, section, id)
        : noteDraft(role, track, section, id);
    drafts.push(draft);
    draftBySectionAndRole.set(`${section.id}:${role.suffix}`, draft);
  }
}

const scenePlacements = {};
const sceneLayerStacks = {};
const scenes = sections.map((section) => {
  const draftFor = (suffix) => draftBySectionAndRole.get(`${section.id}:${suffix}`)?.id;
  const placement = {};
  if (draftFor("drums")) placement.drums = draftFor("drums");
  if (draftFor("bass")) placement.bass = draftFor("bass");
  if (draftFor("piano-rh")) placement.harmony = draftFor("piano-rh");

  const melodyCandidates = ["alto", "tenor", "guitar"]
    .map((suffix) => draftBySectionAndRole.get(`${section.id}:${suffix}`))
    .filter(Boolean)
    .sort((a, b) => (b.notes?.length ?? 0) - (a.notes?.length ?? 0))
    .map(({ id }) => id);
  if (section.id === "opening" && melodyCandidates.includes("memory-opening")) {
    melodyCandidates.splice(melodyCandidates.indexOf("memory-opening"), 1);
    melodyCandidates.unshift("memory-opening");
  }
  if (melodyCandidates.length) placement.melody = melodyCandidates[0];
  scenePlacements[section.id] = placement;

  const stacks = {};
  if (draftFor("piano-lh")) stacks.bass = [draftFor("piano-lh")];
  if (melodyCandidates.length > 1) stacks.melody = melodyCandidates.slice(1);
  if (Object.keys(stacks).length) sceneLayerStacks[section.id] = stacks;

  return {
    id: section.id,
    title: section.label,
    bars: section.bars,
    startBar: section.startBar,
    description: `Generated only from MIDI ticks ${section.startBar * ticksPerBar}–${(section.startBar + section.bars) * ticksPerBar}.`,
    layers: { drums: null, bass: null, harmony: null, melody: null, texture: null },
    layerStacks: {},
    fx: {
      filter: section.id === "outro" ? 4300 : section.id === "opening" ? 5200 : 7200,
      delayWet: section.id === "outro" ? 0.2 : 0.1,
      reverbWet: section.id === "opening" || section.id === "outro" ? 0.24 : 0.16,
      masterGain: 4.5,
      faders: { groove: 68, harmony: 58, melody: 68, texture: 0 },
    },
  };
});

const trackDefinitions = trackRoles.map((role) => ({
  id: role.trackId,
  label: role.label,
  layerKind: role.kind,
  draftIds: drafts
    .filter((draft) => draft.id.endsWith(`-${role.suffix}`) || (role.suffix === "tenor" && draft.id === "memory-opening"))
    .map(({ id }) => id),
  gain: role.kind === "drums" ? -2 : role.kind === "bass" ? -5 : role.kind === "harmony" ? -8 : -6,
}));

const allTrackIds = trackDefinitions.map(({ id }) => id);
const workspaces = base.workspaces.map((workspace) => ({
  ...workspace,
  trackIds: workspace.id === "ws-rhythm" || workspace.id === "ws-perc"
    ? ["track-drums"]
    : workspace.id === "ws-bass"
      ? ["track-bass", "track-piano-lh"]
      : workspace.id === "ws-harmony"
        ? ["track-piano-rh"]
        : workspace.id === "ws-melody"
          ? ["track-alto", "track-tenor", "track-guitar"]
          : workspace.id === "ws-texture"
            ? []
            : allTrackIds,
}));

const producerForDraft = (draft) => {
  if (draft.kind === "drums") return { participantId: "p-rhythm", workspaceId: "ws-rhythm" };
  if (draft.kind === "bass") return { participantId: "p-bass", workspaceId: "ws-bass" };
  if (draft.kind === "harmony") return { participantId: "p-harmony", workspaceId: "ws-harmony" };
  return { participantId: "p-melody", workspaceId: "ws-melody" };
};

const productionChoreography = [];
let actionOrder = 0;
const openingDraft = drafts.find(({ id }) => id === "memory-opening");
if (!openingDraft) throw new Error("MIDI opening did not produce memory-opening");
productionChoreography.push({
  id: "midi-build-opening",
  atBeat: actionOrder++,
  ...producerForDraft(openingDraft),
  kind: "createDraft",
  target: openingDraft.id,
  label: "Build opening from MIDI",
});
productionChoreography.push({
  id: "midi-preview-opening",
  atBeat: actionOrder++,
  ...producerForDraft(openingDraft),
  kind: "previewDraft",
  target: openingDraft.id,
  label: "Private cue MIDI opening",
});
productionChoreography.push({
  id: "midi-offer-opening",
  atBeat: actionOrder++,
  ...producerForDraft(openingDraft),
  kind: "offerDraft",
  target: openingDraft.id,
  label: "Offer MIDI opening",
});

for (const draft of drafts.filter(({ id }) => id !== "memory-opening")) {
  productionChoreography.push({
    id: `midi-build-${draft.id}`,
    atBeat: actionOrder++,
    ...producerForDraft(draft),
    kind: "createDraft",
    target: draft.id,
    label: `Build ${draft.title}`,
  });
}
for (const section of sections) {
  productionChoreography.push({
    id: `midi-place-${section.id}`,
    atBeat: actionOrder++,
    participantId: "p-arrange",
    workspaceId: "ws-arrange",
    kind: "placeInScene",
    target: section.id,
    label: `Place MIDI clips in ${section.label}`,
  });
}
productionChoreography.push({
  id: "midi-assemble-form",
  atBeat: actionOrder++,
  participantId: "p-arrange",
  workspaceId: "ws-arrange",
  kind: "assembleArrangement",
  target: "midi-authority-arrangement",
  label: "Assemble the complete 104-bar MIDI form",
});

const livePerformanceChoreography = [
  { id: "launch-opening", at: "0:0:0", brain: "story", action: "launch", target: "opening", label: "Launch MIDI opening", detail: "Open the live take with the same MIDI-derived clips." },
  { id: "e03", at: "0:2:0", brain: "memory", action: "addNote", target: "memory-opening", value: JSON.stringify({ step: 9, pitch: 62, note: "D4" }), label: "Add live response", detail: "A single live-only note distinguishes the performance take." },
  { id: "e03b", at: "0:2:2", brain: "memory", action: "moveNote", target: "memory-opening", value: "note-memory-opening-9:14", label: "Move live response", detail: "Move the new note without changing the canonical snapshot." },
  { id: "cue-opening", at: "1:0:0", brain: "memory", action: "preview", target: "memory-opening", label: "Private cue opening", detail: "Audition the edited opening privately." },
  ...sections.slice(1).map((section) => ({
    id: `launch-${section.id}`,
    at: `${section.startBar}:0:0`,
    brain: "story",
    action: "launch",
    target: section.id,
    label: `Launch ${section.label}`,
    detail: "Launch the next MIDI-authority scene on its written boundary.",
  })),
];

const pack = {
  ...base,
  metadata: {
    id: "shiki-no-uta-midi-only-private-v1",
    title: "Shiki No Uta · MIDI-only rebuild",
    bpm: Number(midi.tempos[0].bpm.toFixed(6)),
    prototypeOnly: true,
    source: "local-private",
  },
  provenance: {
    createdBy: "EchLub MIDI-only reconstruction generator",
    sourceDescription: "Generated only from one owner-provided Standard MIDI file; no PDF, MP3, screenshot, prior transcription, or prior scene material was used as musical authority.",
    rightsBasis: "owner-provided-private-reference",
    referenceAssetIds: ["owner-midi-authority-v1"],
  },
  confidence: {
    overall: 0.99,
    rhythm: 0.99,
    harmony: 0.99,
    melody: 0.99,
    arrangement: 0.99,
    notes: [
      "All pitches, onsets, durations, velocities, tempo and instrument entrances are derived from MIDI events.",
      "Section names are descriptive labels inferred only from MIDI track activity; they do not import external song-form claims.",
      "The tablature track's MIDI pitches are retained exactly even though its narrow range may reflect the source export.",
    ],
  },
  tempoMap: midi.tempos
    .filter((tempo, index, all) => index === 0 || tempo.tick !== all[index - 1].tick)
    .map((tempo) => ({ bar: Math.floor(tempo.tick / ticksPerBar), bpm: Number(tempo.bpm.toFixed(6)) })),
  timeSignatures: midi.timeSignatures.map((signature) => ({
    bar: Math.floor(signature.tick / ticksPerBar),
    numerator: signature.numerator,
    denominator: signature.denominator,
  })),
  sections,
  workspaces,
  tracks: trackDefinitions,
  drafts,
  scenes,
  scenePlacements,
  sceneLayerStacks,
  defaultMix: {
    filter: 6500,
    delayWet: 0.1,
    reverbWet: 0.16,
    masterGain: 4.5,
    faders: { groove: 68, harmony: 58, melody: 68, texture: 0 },
  },
  soundDesign: {
    ...base.soundDesign,
    drums: { ...base.soundDesign.drums, drive: 0.025, filterFrequency: 10500 },
    bass: { ...base.soundDesign.bass, oscillator: "triangle", volume: -13, drive: 0.02 },
    harmony: { ...base.soundDesign.harmony, generator: "synth", oscillator: "triangle", volume: -17 },
    melody: { ...base.soundDesign.melody, generator: "synth", oscillator: "triangle", volume: -15 },
  },
  arrangement: {
    id: "midi-authority-arrangement",
    title: "Complete 104-bar MIDI authority form",
    totalBars: 104,
    scenes: sections.map(({ id: sceneId, startBar }) => ({ sceneId, startBar })),
  },
  productionChoreography,
  livePerformanceChoreography,
  liveStructuralOperations: [],
};

await writeFile(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath,
  bpm: pack.metadata.bpm,
  totalBars: pack.arrangement.totalBars,
  scenes: pack.scenes.length,
  drafts: pack.drafts.length,
  sourceNotes: midi.tracks.reduce((sum, track) => sum + track.noteCount, 0),
  generatedEvents: pack.drafts.reduce((sum, draft) =>
    sum + (draft.notes?.length ?? draft.harmonyChords?.reduce((count, chord) => count + chord.notes.length, 0) ?? draft.drumHits?.length ?? 0), 0),
}, null, 2));

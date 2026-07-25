import * as Tone from "tone";
import type { LayerId, MaterialRef, NoteEvent, SceneDefinition } from "../types";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import { resolveMaterial } from "../domain/sessionMaterialBank";
import type { MasterAudioGraph } from "./masterAudioGraph";

/** Shared monophonic sources require strictly increasing attack times. */
const MONO_VOICE_STAGGER_SEC = 0.004;

export type GuitarAttackSchedule = {
  attackTime: number;
  bodyTime: number;
  fretTime: number;
  stringTime: number;
  /** Last attack on monophonic MonoSynth / PluckSynth voices (reed, glide leads, guitar string). */
  monoVoiceTime: number;
};

export function createGuitarAttackSchedule(): GuitarAttackSchedule {
  return {
    attackTime: -Infinity,
    bodyTime: -Infinity,
    fretTime: -Infinity,
    stringTime: -Infinity,
    monoVoiceTime: -Infinity,
  };
}

function scheduleMonoVoiceTime(schedule: GuitarAttackSchedule, requested: number): number {
  const scheduled = Math.max(requested, schedule.monoVoiceTime + MONO_VOICE_STAGGER_SEC);
  schedule.monoVoiceTime = scheduled;
  return scheduled;
}

function scheduleGuitarMonoTime(
  schedule: GuitarAttackSchedule,
  key: "fretTime" | "stringTime" | "bodyTime",
  requested: number,
): number {
  const scheduled = Math.max(requested, schedule[key] + MONO_VOICE_STAGGER_SEC);
  schedule[key] = scheduled;
  return scheduled;
}

export function playLayerOnGraph(
  graph: MasterAudioGraph,
  materialBank: SessionMaterialBank,
  scene: SceneDefinition,
  layer: LayerId,
  ref: MaterialRef | null,
  localBar: number,
  globalStep: number,
  time: number,
  voiceIndex: number,
  options: { launchVelocityScale?: number; mutedLayers?: ReadonlySet<LayerId>; guitarSchedule?: GuitarAttackSchedule } = {},
): void {
  void scene;
  if (!ref) return;
  if (options.mutedLayers?.has(layer)) return;
  const velocityScale = options.launchVelocityScale ?? 1;
  const material = resolveMaterial(materialBank, ref);
  if (!material) return;

  const content = material.content;
  const patternStep = (patternBars: number) => (localBar % Math.max(1, patternBars)) * 16 + globalStep;
  if (content.kind === "drums") {
    const currentStep = patternStep(content.patternBars);
    const drumVoiceTimes: Partial<Record<string, number>> = {};
    for (const hit of content.hits) {
      if (hit.bar * 16 + hit.step !== currentStep) continue;
      let scheduledTime = time + (hit.timingOffset ?? 0) * Tone.Time("16n").toSeconds();
      const prior = drumVoiceTimes[hit.voice];
      if (prior != null) {
        scheduledTime = Math.max(scheduledTime, prior + MONO_VOICE_STAGGER_SEC);
      }
      drumVoiceTimes[hit.voice] = scheduledTime;
      if (hit.voice === "kick") graph.kick.triggerAttackRelease("C1", hit.duration ?? "8n", scheduledTime, hit.velocity * velocityScale);
      else if (hit.voice === "snare") graph.snare.triggerAttackRelease(hit.duration ?? "16n", scheduledTime, hit.velocity * 0.35 * velocityScale);
      else if (hit.voice === "rim") graph.rim.triggerAttackRelease(hit.duration ?? "32n", scheduledTime, hit.velocity * 0.5 * velocityScale);
      else if (hit.voice === "tomLow") graph.tomLow.triggerAttackRelease("D2", hit.duration ?? "8n", scheduledTime, hit.velocity * 0.7 * velocityScale);
      else if (hit.voice === "tomMid") graph.tomMid.triggerAttackRelease("G2", hit.duration ?? "8n", scheduledTime, hit.velocity * 0.65 * velocityScale);
      else if (hit.voice === "tomHigh") graph.tomHigh.triggerAttackRelease("C3", hit.duration ?? "8n", scheduledTime, hit.velocity * 0.6 * velocityScale);
      else if (hit.voice === "crash") graph.crash.triggerAttackRelease("16n", scheduledTime, hit.velocity * 0.45 * velocityScale);
      else if (hit.voice === "ride") graph.ride.triggerAttackRelease("32n", scheduledTime, hit.velocity * 0.42 * velocityScale);
      else graph.hat.triggerAttackRelease(hit.duration ?? "32n", scheduledTime, hit.velocity * 0.5 * velocityScale);
    }
  } else if (content.kind === "bass") {
    const currentStep = patternStep(content.patternBars);
    const notes = content.notes.filter((n) => (n.bar ?? 0) * 16 + n.step === currentStep);
    for (const note of notes) playExpressiveNoteOnGraph(graph, "bass", note, voiceIndex, time, velocityScale);
  } else if (content.kind === "harmony") {
    const currentStep = patternStep(content.patternBars);
    const chords = content.chords.filter((chord) => chord.bar * 16 + (chord.step ?? 0) === currentStep);
    for (const chord of chords) {
      const durationSeconds = Math.max(0.03, Tone.Time(chord.duration ?? "1m").toSeconds() - 0.012);
      const scheduledTime = time + (chord.timingOffset ?? 0) * Tone.Time("16n").toSeconds();
      (voiceIndex > 0 ? graph.harmonyComp : graph.harmony)
        .triggerAttackRelease(chord.notes, durationSeconds, scheduledTime, (chord.velocity ?? 0.3) * velocityScale);
    }
  } else if (content.kind === "melody") {
    const currentStep = patternStep(content.patternBars);
    const notes = content.notes.filter((n) => (n.bar ?? 0) * 16 + n.step === currentStep);
    let guitarVoiceOffset = 0;
    for (const note of notes) {
      const voiceAttackOffset = note.instrument === "guitar" ? guitarVoiceOffset : 0;
      if (note.instrument === "guitar") guitarVoiceOffset += MONO_VOICE_STAGGER_SEC;
      playExpressiveNoteOnGraph(graph, "melody", note, voiceIndex, time, velocityScale, voiceAttackOffset, options.guitarSchedule);
    }
  } else if (content.kind === "texture") {
    if (globalStep !== 0) return;
    graph.texture.triggerAttackRelease(content.duration, time, content.level);
  }
}

export function playStepOnGraph(
  graph: MasterAudioGraph,
  materialBank: SessionMaterialBank,
  scene: SceneDefinition,
  bar: number,
  step: number,
  time: number,
  options: { launchVelocityScale?: number; mutedLayers?: ReadonlySet<LayerId> } = {},
): void {
  const localBar = Math.max(0, bar - scene.startBar);
  for (const layer of ["drums", "bass", "harmony", "melody", "texture"] as const) {
    playLayerOnGraph(graph, materialBank, scene, layer, scene.layers[layer], localBar, step, time, 0, options);
    for (const [index, ref] of (scene.layerStacks?.[layer] ?? []).entries()) {
      playLayerOnGraph(graph, materialBank, scene, layer, ref, localBar, step, time, index + 1, options);
    }
  }
}

function playExpressiveNoteOnGraph(
  graph: MasterAudioGraph,
  layer: "bass" | "melody",
  note: NoteEvent,
  voiceIndex: number,
  time: number,
  launchVelocityScale = 1,
  voiceAttackOffset = 0,
  guitarSchedule?: GuitarAttackSchedule,
): void {
  const sixteenth = Tone.Time("16n").toSeconds();
  let scheduledTime = time + (note.timingOffset ?? 0) * sixteenth + voiceAttackOffset;
  if (layer === "melody" && note.instrument === "guitar" && guitarSchedule) {
    scheduledTime = Math.max(scheduledTime, guitarSchedule.stringTime + MONO_VOICE_STAGGER_SEC);
    guitarSchedule.attackTime = scheduledTime;
  }
  const durationSeconds = Math.max(0.03, Tone.Time(note.duration).toSeconds());
  const velocityScale = note.articulation === "ghost" ? 0.5 : note.articulation === "accent" ? 1.12 : 1;
  const velocity = Math.max(0.02, Math.min(1, note.velocity * velocityScale * launchVelocityScale));

  if (layer === "melody" && note.instrument === "guitar") {
    playGuitarNoteOnGraph(graph, note, scheduledTime, durationSeconds, velocity, guitarSchedule);
    return;
  }

  if (note.articulation === "muted") {
    (layer === "bass" ? graph.bassMute : graph.melodyMute).triggerAttackRelease("32n", scheduledTime, velocity);
    return;
  }

  if (layer === "melody" && (
    note.instrument === "reed"
    || note.instrument === "reed-alto"
    || note.instrument === "reed-tenor"
  )) {
    playReedNoteOnGraph(graph, note, voiceIndex, scheduledTime, durationSeconds, velocity, guitarSchedule);
    return;
  }

  if (note.articulation === "slide" || note.articulation === "legato") {
    const voice = layer === "bass"
      ? (voiceIndex > 0 ? graph.bassAccent : graph.bass)
      : (voiceIndex > 0 ? graph.melodyLeadAlt : graph.melodyLead);
    const attackTime = guitarSchedule
      ? scheduleMonoVoiceTime(guitarSchedule, scheduledTime)
      : scheduledTime;
    voice.triggerAttack(note.glideFrom ?? note.note, attackTime, velocity);
    voice.setNote(note.note, attackTime + Math.min(sixteenth * 0.55, durationSeconds * 0.4));
    voice.triggerRelease(attackTime + durationSeconds);
    return;
  }

  const collisionSafeDuration = Math.max(0.03, durationSeconds - 0.012);
  if (layer === "bass") {
    (voiceIndex > 0 ? graph.bassAccent : graph.bass).triggerAttackRelease(note.note, collisionSafeDuration, scheduledTime, velocity);
  } else {
    (voiceIndex > 0 ? graph.melodyCounter : graph.melody).triggerAttackRelease(note.note, collisionSafeDuration, scheduledTime, velocity);
  }
}

function playReedNoteOnGraph(
  graph: MasterAudioGraph,
  note: NoteEvent,
  voiceIndex: number,
  scheduledTime: number,
  durationSeconds: number,
  velocity: number,
  guitarSchedule?: GuitarAttackSchedule,
): void {
  if (guitarSchedule) scheduledTime = scheduleMonoVoiceTime(guitarSchedule, scheduledTime);
  const useAltVoice = note.instrument === "reed-tenor"
    || (note.instrument === "reed" && voiceIndex > 0);
  const voice = useAltVoice ? graph.reedLeadAlt : graph.reedLead;
  const breath = useAltVoice ? graph.reedBreathAlt : graph.reedBreath;
  const isConnected = note.articulation === "slide" || note.articulation === "legato";
  if (!isConnected && durationSeconds >= Tone.Time("8n").toSeconds() * 0.9) {
    breath.triggerAttackRelease("32n", scheduledTime, velocity * 0.24);
  }
  const releaseAt = scheduledTime + durationSeconds;
  const shouldScoop = isConnected || note.articulation === "accent";
  if (!shouldScoop) {
    voice.triggerAttackRelease(note.note, durationSeconds, scheduledTime, velocity);
    return;
  }

  const startPitch = note.glideFrom ?? Tone.Frequency(note.note).transpose(-0.45).toFrequency();
  voice.triggerAttack(startPitch, scheduledTime, velocity);
  voice.setNote(note.note, scheduledTime + Math.min(0.055, durationSeconds * 0.22));
  voice.triggerRelease(releaseAt);
}

function playGuitarNoteOnGraph(
  graph: MasterAudioGraph,
  note: NoteEvent,
  scheduledTime: number,
  durationSeconds: number,
  velocity: number,
  guitarSchedule?: GuitarAttackSchedule,
): void {
  const releaseAt = scheduledTime + durationSeconds;
  const isMuted = note.articulation === "muted";
  const isSlide = note.articulation === "slide" || note.articulation === "legato";
  const releaseLead = MONO_VOICE_STAGGER_SEC * 0.25;
  const fretTime = guitarSchedule
    ? scheduleGuitarMonoTime(guitarSchedule, "fretTime", scheduledTime)
    : scheduledTime;
  const stringTime = guitarSchedule
    ? scheduleGuitarMonoTime(guitarSchedule, "stringTime", scheduledTime)
    : scheduledTime;
  const bodyTime = guitarSchedule
    ? scheduleGuitarMonoTime(guitarSchedule, "bodyTime", scheduledTime + MONO_VOICE_STAGGER_SEC)
    : scheduledTime + MONO_VOICE_STAGGER_SEC;
  if (guitarSchedule) {
    guitarSchedule.attackTime = stringTime;
    guitarSchedule.monoVoiceTime = Math.max(guitarSchedule.monoVoiceTime, stringTime);
  }

  graph.guitarFretNoise.triggerRelease(fretTime - releaseLead);
  graph.guitarFretNoise.triggerAttackRelease(isSlide ? "16n" : "32n", fretTime, velocity * (isSlide ? 0.62 : 0.38));

  const stringPitch = note.glideFrom ?? note.note;
  graph.guitarString.triggerRelease(stringTime - releaseLead);
  graph.guitarString.triggerAttack(stringPitch, stringTime);
  graph.guitarString.triggerRelease(stringTime + Math.min(durationSeconds, isMuted ? 0.055 : 0.34));
  if (isMuted) return;

  if (isSlide) {
    graph.guitarBody.triggerRelease(bodyTime - releaseLead);
    graph.guitarBody.triggerAttack(stringPitch, bodyTime, velocity);
    graph.guitarBody.setNote(note.note, bodyTime + Math.min(0.052, durationSeconds * 0.22));
    graph.guitarBody.triggerRelease(releaseAt);
    return;
  }
  graph.guitarBody.triggerRelease(bodyTime - releaseLead);
  graph.guitarBody.triggerAttackRelease(note.note, durationSeconds, bodyTime, velocity * 0.72);
}

import * as Tone from "tone";
import type { LayerId, MaterialRef, NoteEvent, SceneDefinition } from "../types";
import type { SessionMaterialBank } from "../domain/sessionMaterialBank";
import { resolveMaterial } from "../domain/sessionMaterialBank";
import type { MasterAudioGraph } from "./masterAudioGraph";

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
  options: { launchVelocityScale?: number; mutedLayers?: ReadonlySet<LayerId> } = {},
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
    for (const hit of content.hits) {
      if (hit.bar * 16 + hit.step !== currentStep) continue;
      const scheduledTime = time + (hit.timingOffset ?? 0) * Tone.Time("16n").toSeconds();
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
    for (const note of notes) playExpressiveNoteOnGraph(graph, "melody", note, voiceIndex, time, velocityScale);
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
): void {
  const sixteenth = Tone.Time("16n").toSeconds();
  const scheduledTime = time + (note.timingOffset ?? 0) * sixteenth;
  const durationSeconds = Math.max(0.03, Tone.Time(note.duration).toSeconds());
  const velocityScale = note.articulation === "ghost" ? 0.5 : note.articulation === "accent" ? 1.12 : 1;
  const velocity = Math.max(0.02, Math.min(1, note.velocity * velocityScale * launchVelocityScale));

  if (layer === "melody" && note.instrument === "guitar") {
    playGuitarNoteOnGraph(graph, note, scheduledTime, durationSeconds, velocity);
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
    playReedNoteOnGraph(graph, note, voiceIndex, scheduledTime, durationSeconds, velocity);
    return;
  }

  if (note.articulation === "slide" || note.articulation === "legato") {
    const voice = layer === "bass"
      ? (voiceIndex > 0 ? graph.bassAccent : graph.bass)
      : (voiceIndex > 0 ? graph.melodyLeadAlt : graph.melodyLead);
    voice.triggerAttack(note.glideFrom ?? note.note, scheduledTime, velocity);
    voice.setNote(note.note, scheduledTime + Math.min(sixteenth * 0.55, durationSeconds * 0.4));
    voice.triggerRelease(scheduledTime + durationSeconds);
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
): void {
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
): void {
  const releaseAt = scheduledTime + durationSeconds;
  const isMuted = note.articulation === "muted";
  const isSlide = note.articulation === "slide" || note.articulation === "legato";
  graph.guitarFretNoise.triggerAttackRelease(isSlide ? "16n" : "32n", scheduledTime, velocity * (isSlide ? 0.62 : 0.38));

  const stringPitch = note.glideFrom ?? note.note;
  graph.guitarString.triggerAttack(stringPitch, scheduledTime);
  graph.guitarString.triggerRelease(scheduledTime + Math.min(durationSeconds, isMuted ? 0.055 : 0.34));
  if (isMuted) return;

  if (isSlide) {
    graph.guitarBody.triggerAttack(stringPitch, scheduledTime, velocity);
    graph.guitarBody.setNote(note.note, scheduledTime + Math.min(0.052, durationSeconds * 0.22));
    graph.guitarBody.triggerRelease(releaseAt);
    return;
  }
  graph.guitarBody.triggerAttackRelease(note.note, durationSeconds, scheduledTime, velocity * 0.72);
}

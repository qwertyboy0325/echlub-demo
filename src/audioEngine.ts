import * as Tone from "tone";
import { BPM, defaultMix, initialDrafts, TOTAL_BARS } from "./musicData";
import { createIdleScene, IDLE_SCENE_ID, type SceneExecutionAuthority } from "./sceneExecution";
import { computeRampTargetTime, delayUiToWet, faderUiToDb, filterUiToHz } from "./mixMapping";
import type { MixParams, NoteEvent, SceneDefinition } from "./types";
import {
  addMeasures,
  addSixteenths,
  formatPosition,
  parseTransportPosition,
  positionToTicks,
  type MusicalPosition,
} from "./musicalPosition";

export function computeCueStopPosition(start: MusicalPosition, durationMeasures: number): MusicalPosition {
  return addMeasures(start, durationMeasures);
}

export interface CueCompletionEvidence {
  draftId: string;
  cueStartedAt: string;
  cueStoppedAt: string;
  masterSceneBefore: string;
  masterSceneDuring: string;
  masterStepCountAtStart: number;
  masterStepCountAtStop: number;
  cueNoteCount: number;
}

interface AudioCallbacks {
  onStep: (bar: number, beat: number, sixteenth: number) => void;
  onFinished: () => void;
  onBoundary?: (bar: number) => void;
  onLaunchAtBar?: (bar: number, sceneId: string, time: number) => void;
  onCueComplete?: (evidence: CueCompletionEvidence) => void;
}

const harmonyVoicings: Record<string, string[][]> = {
  "harmony-soft": [["A3", "E4", "B4"], ["F3", "C4", "G4"], ["C4", "G4", "D5"], ["G3", "D4", "A4"]],
  "harmony-main": [["A3", "C4", "E4", "B4"], ["F3", "A3", "C4", "G4"], ["C4", "E4", "G4", "D5"], ["G3", "B3", "D4", "A4"]],
  "harmony-open": [["A2", "E3", "C4", "B4"], ["F2", "C3", "A3", "G4"], ["C3", "G3", "E4", "D5"], ["G2", "D3", "B3", "A4"]],
};

const bassPatterns: Record<string, string[]> = {
  "bass-main": ["A2", "A2", "F2", "F2", "C3", "C3", "G2", "G2"],
  "bass-alt": ["A2", "C3", "F2", "A2", "C3", "E3", "G2", "B2"],
};

const melodyPatterns: Record<string, NoteEvent[]> = {
  "memory-opening": [
    { id: "n1", step: 0, pitch: 0, note: "E4", duration: "8n", velocity: 0.62 },
    { id: "n2", step: 3, pitch: 0, note: "G4", duration: "8n", velocity: 0.58 },
    { id: "n3", step: 6, pitch: 0, note: "A4", duration: "4n", velocity: 0.68 },
    { id: "n4", step: 12, pitch: 0, note: "G4", duration: "8n", velocity: 0.52 },
  ],
  "memory-main": [
    { id: "n5", step: 0, pitch: 0, note: "A4", duration: "8n", velocity: 0.72 },
    { id: "n6", step: 2, pitch: 0, note: "C5", duration: "8n", velocity: 0.68 },
    { id: "n7", step: 4, pitch: 0, note: "B4", duration: "8n", velocity: 0.64 },
    { id: "n8", step: 6, pitch: 0, note: "G4", duration: "4n", velocity: 0.66 },
    { id: "n9", step: 10, pitch: 0, note: "E4", duration: "8n", velocity: 0.55 },
    { id: "n10", step: 12, pitch: 0, note: "G4", duration: "8n", velocity: 0.62 },
    { id: "n11", step: 14, pitch: 0, note: "A4", duration: "4n", velocity: 0.74 },
  ],
  "memory-response": [
    { id: "n12", step: 1, pitch: 0, note: "C5", duration: "8n", velocity: 0.58 },
    { id: "n13", step: 5, pitch: 0, note: "B4", duration: "8n", velocity: 0.54 },
    { id: "n14", step: 9, pitch: 0, note: "A4", duration: "8n", velocity: 0.56 },
    { id: "n15", step: 13, pitch: 0, note: "E5", duration: "8n", velocity: 0.62 },
  ],
};

const drumPatterns: Record<string, number[]> = {
  "pulse-sparse": [0, 6, 8, 14],
  "pulse-full": [0, 3, 6, 8, 11, 14],
  "pulse-break": [4, 8, 11, 14],
};

export class AudioEngine {
  private readonly callbacks: AudioCallbacks;
  private sceneAuthority: SceneExecutionAuthority | null = null;
  private initialized = false;
  private scheduledId: number | null = null;
  private lastBar = -1;
  private currentMix: MixParams = structuredClone(defaultMix);
  private playingScene: SceneDefinition = createIdleScene();
  private launchAtBar = new Map<number, string>();
  private masterStepCount = 0;
  private cueNoteCount = 0;
  private cueActive = false;
  private cueDraftId: string | null = null;
  private cueScheduleIds: number[] = [];
  private cueStopScheduleId: number | null = null;
  private masterSceneAtCueStart = IDLE_SCENE_ID;
  private masterStepCountAtCueStart = 0;
  private cueStartedAtTransportPosition = "0:0:0";
  private cueStopsAtTransportPosition = "0:0:0";
  private readonly cueDurationMeasures = 2;

  private master!: Tone.Volume;
  private limiter!: Tone.Limiter;
  private masterFilter!: Tone.Filter;
  private delay!: Tone.FeedbackDelay;
  private reverb!: Tone.Reverb;
  private grooveGain!: Tone.Volume;
  private harmonyGain!: Tone.Volume;
  private melodyGain!: Tone.Volume;
  private textureGain!: Tone.Volume;
  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hat!: Tone.MetalSynth;
  private bass!: Tone.MonoSynth;
  private harmony!: Tone.PolySynth;
  private melody!: Tone.Synth;
  private texture!: Tone.NoiseSynth;
  private cueMelody!: Tone.Synth;
  private cueHat!: Tone.MetalSynth;
  private cueKick!: Tone.MembraneSynth;
  private cueGain!: Tone.Volume;

  constructor(callbacks: AudioCallbacks) {
    this.callbacks = callbacks;
  }

  bindSceneAuthority(authority: SceneExecutionAuthority): void {
    this.sceneAuthority = authority;
  }

  setLaunchBoundaries(boundaries: Map<number, string>): void {
    this.launchAtBar = boundaries;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    this.master = new Tone.Volume(defaultMix.masterGain);
    this.limiter = new Tone.Limiter(-1);
    this.masterFilter = new Tone.Filter({ frequency: defaultMix.filter, type: "lowpass", rolloff: -24 });
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.26, wet: defaultMix.delayWet });
    this.reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.03, wet: defaultMix.reverbWet });
    this.grooveGain = new Tone.Volume(faderUiToDb(defaultMix.faders.groove));
    this.harmonyGain = new Tone.Volume(faderUiToDb(defaultMix.faders.harmony));
    this.melodyGain = new Tone.Volume(faderUiToDb(defaultMix.faders.melody));
    this.textureGain = new Tone.Volume(faderUiToDb(defaultMix.faders.texture));

    this.master.chain(this.masterFilter, this.limiter, Tone.getDestination());
    this.delay.connect(this.master);
    this.reverb.connect(this.master);

    this.kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 5, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.08 } });
    this.snare = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 } });
    this.hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.045, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 24, resonance: 4200, octaves: 1.5, volume: -18,
    } as Tone.MetalSynthOptions);
    this.bass = new Tone.MonoSynth({ oscillator: { type: "fatsawtooth", count: 2, spread: 10 }, filter: { Q: 2, type: "lowpass", rolloff: -24 }, envelope: { attack: 0.01, decay: 0.18, sustain: 0.32, release: 0.2 }, filterEnvelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.25, baseFrequency: 100, octaves: 2.3 }, volume: -11 });
    this.harmony = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.08, decay: 0.25, sustain: 0.45, release: 1.2 }, volume: -16 });
    this.melody = new Tone.Synth({ oscillator: { type: "fatsine", count: 2, spread: 8 }, envelope: { attack: 0.02, decay: 0.16, sustain: 0.25, release: 0.5 }, volume: -13 });
    this.texture = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.2, decay: 0.8, sustain: 0.1, release: 1.8 }, volume: -31 });

    this.kick.connect(this.grooveGain);
    this.snare.connect(this.grooveGain);
    this.hat.connect(this.grooveGain);
    this.bass.connect(this.grooveGain);
    this.grooveGain.connect(this.master);
    this.harmony.connect(this.harmonyGain);
    this.harmonyGain.connect(this.reverb);
    this.melody.connect(this.melodyGain);
    this.melodyGain.connect(this.delay);
    this.melodyGain.connect(this.reverb);
    this.texture.connect(this.textureGain);
    this.textureGain.connect(this.reverb);

    this.cueGain = new Tone.Volume(-8);
    this.cueMelody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.35 },
      volume: -10,
    });
    this.cueHat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 24,
      resonance: 4200,
      octaves: 1.5,
      volume: -22,
    } as Tone.MetalSynthOptions);
    this.cueKick = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.06 },
      volume: -14,
    });
    this.cueMelody.connect(this.cueGain);
    this.cueHat.connect(this.cueGain);
    this.cueKick.connect(this.cueGain);
    this.cueGain.connect(Tone.getDestination());

    const transport = Tone.getTransport();
    transport.bpm.value = BPM;
    transport.timeSignature = 4;
    transport.loop = false;

    this.scheduledId = transport.scheduleRepeat((time: number) => {
      const position = transport.position.toString().split(":").map(Number);
      const bar = Number.isFinite(position[0]) ? position[0] : 0;
      const beat = Number.isFinite(position[1]) ? position[1] : 0;
      const sixteenth = Number.isFinite(position[2]) ? Math.floor(position[2]) : 0;
      const step = beat * 4 + sixteenth;
      if (beat === 0 && sixteenth === 0) {
        const launchSceneId = this.launchAtBar.get(bar);
        if (launchSceneId) this.callbacks.onLaunchAtBar?.(bar, launchSceneId, time);
      }
      const scene = this.sceneAuthority?.playingScene ?? this.playingScene;

      this.playStep(scene, bar, step, time);
      this.masterStepCount += 1;

      Tone.getDraw().schedule(() => {
        if (bar !== this.lastBar && beat === 0 && sixteenth === 0) {
          this.lastBar = bar;
          this.callbacks.onBoundary?.(bar);
        }
        this.callbacks.onStep(bar, beat, sixteenth);
        if (bar >= TOTAL_BARS) {
          this.stop();
          this.callbacks.onFinished();
        }
      }, time);
    }, "16n");

    this.initialized = true;
  }

  getMix(): MixParams {
    return { ...this.currentMix, faders: { ...this.currentMix.faders } };
  }

  getPlayingSceneId(): string {
    return this.sceneAuthority?.playingSceneId ?? this.playingScene.id;
  }

  activateSceneAtBoundary(scene: SceneDefinition, time?: number): void {
    this.playingScene = scene;
    if (!this.initialized) return;
    const ramp = time ?? Tone.getTransport().seconds + 0.05;
    this.applySceneFx(scene, ramp, true);
  }

  setMixParams(params: Partial<MixParams>, rampTime = 0.18, atTime?: number): void {
    const startTime = atTime ?? Tone.getTransport().seconds;
    const targetTime = computeRampTargetTime(startTime, rampTime);
    if (params.filter !== undefined) {
      this.currentMix.filter = params.filter;
      this.masterFilter.frequency.exponentialRampToValueAtTime(filterUiToHz(params.filter), targetTime);
    }
    if (params.delayWet !== undefined) {
      this.currentMix.delayWet = params.delayWet;
      this.delay.wet.linearRampToValueAtTime(delayUiToWet(params.delayWet), targetTime);
    }
    if (params.reverbWet !== undefined) {
      this.currentMix.reverbWet = params.reverbWet;
      this.reverb.wet.linearRampToValueAtTime(params.reverbWet, targetTime);
    }
    if (params.masterGain !== undefined) {
      this.currentMix.masterGain = params.masterGain;
      this.master.volume.linearRampToValueAtTime(params.masterGain, targetTime);
    }
    if (params.faders) {
      const map: Record<string, Tone.Volume> = {
        groove: this.grooveGain,
        harmony: this.harmonyGain,
        melody: this.melodyGain,
        texture: this.textureGain,
      };
      for (const [key, ui] of Object.entries(params.faders)) {
        this.currentMix.faders[key] = ui;
        const gain = map[key];
        if (gain) gain.volume.linearRampToValueAtTime(faderUiToDb(ui), targetTime);
      }
    }
  }

  getMasterStepCount(): number {
    return this.masterStepCount;
  }

  getCueNoteCount(): number {
    return this.cueNoteCount;
  }

  isCueActive(): boolean {
    return this.cueActive;
  }

  getCueDraftId(): string | null {
    return this.cueDraftId;
  }

  getCueScheduleCount(): number {
    return this.cueScheduleIds.length + (this.cueStopScheduleId !== null ? 1 : 0);
  }

  getCueStartedAtTransportPosition(): string {
    return this.cueStartedAtTransportPosition;
  }

  getCueStopsAtTransportPosition(): string {
    return this.cueStopsAtTransportPosition;
  }

  startPrivateCue(draftId: string, atTransportPosition?: MusicalPosition): void {
    if (!this.initialized) return;
    this.stopPrivateCue();
    const draft = initialDrafts.find((d) => d.id === draftId);
    if (!draft) return;

    const transport = Tone.getTransport();
    const startPos = atTransportPosition ?? parseTransportPosition(transport.position.toString());
    const stopPos = computeCueStopPosition(startPos, this.cueDurationMeasures);

    this.cueActive = true;
    this.cueDraftId = draftId;
    this.cueNoteCount = 0;
    this.masterSceneAtCueStart = this.getPlayingSceneId();
    this.masterStepCountAtCueStart = this.masterStepCount;
    this.cueStartedAtTransportPosition = formatPosition(startPos);
    this.cueStopsAtTransportPosition = formatPosition(stopPos);

    const scheduleCueHit = (offsetSixteenths: number, play: (t: number) => void): void => {
      const notePos = addSixteenths(startPos, offsetSixteenths);
      const when = positionToTicks(notePos) <= positionToTicks(startPos)
        ? "+0"
        : formatPosition(notePos);
      const id = transport.schedule((t) => play(t), when);
      this.cueScheduleIds.push(id);
    };

    if (draft.kind === "melody" && draft.notes) {
      for (const note of draft.notes) {
        scheduleCueHit(note.step, (t) => {
          this.cueMelody.triggerAttackRelease(note.note, note.duration ?? "8n", t, note.velocity ?? 0.6);
          this.cueNoteCount += 1;
        });
      }
    } else if (draft.steps) {
      for (const step of draft.steps) {
        scheduleCueHit(step, (t) => {
          const isKick = step === 0 || step === 8 || step === 4;
          if (isKick) this.cueKick.triggerAttackRelease("C2", "8n", t, 0.7);
          else this.cueHat.triggerAttackRelease("32n", t, 0.35);
          this.cueNoteCount += 1;
        });
      }
    }

    const cueStartAudioTime = transport.seconds;
    this.cueGain.volume.setValueAtTime(-8, cueStartAudioTime);
    this.cueStopScheduleId = transport.schedule((t) => {
      this.stopPrivateCue(t, parseTransportPosition(formatPosition(stopPos)));
      this.cueStopScheduleId = null;
    }, formatPosition(stopPos));
  }

  stopPrivateCue(at?: number, atTransportPosition?: MusicalPosition): void {
    if (!this.initialized) return;
    const wasActive = this.cueActive;
    const draftId = this.cueDraftId;
    const transport = Tone.getTransport();
    const time = at ?? transport.seconds;
    const stoppedAt = atTransportPosition ?? parseTransportPosition(transport.position.toString());

    this.cueScheduleIds.forEach((id) => transport.clear(id));
    this.cueScheduleIds = [];
    if (this.cueStopScheduleId !== null) {
      transport.clear(this.cueStopScheduleId);
      this.cueStopScheduleId = null;
    }
    this.cueMelody.triggerRelease(time);
    this.cueGain.volume.linearRampToValueAtTime(-60, computeRampTargetTime(time, 0.08));

    if (wasActive && draftId) {
      this.callbacks.onCueComplete?.({
        draftId,
        cueStartedAt: this.cueStartedAtTransportPosition,
        cueStoppedAt: formatPosition(stoppedAt),
        masterSceneBefore: this.masterSceneAtCueStart,
        masterSceneDuring: this.getPlayingSceneId(),
        masterStepCountAtStart: this.masterStepCountAtCueStart,
        masterStepCountAtStop: this.masterStepCount,
        cueNoteCount: this.cueNoteCount,
      });
    }

    this.cueActive = false;
    this.cueDraftId = null;
  }

  resetPrivateCue(): void {
    this.stopPrivateCue();
    this.cueNoteCount = 0;
    this.masterSceneAtCueStart = IDLE_SCENE_ID;
    this.masterStepCountAtCueStart = 0;
    this.cueStartedAtTransportPosition = "0:0:0";
    this.cueStopsAtTransportPosition = "0:0:0";
  }

  resetAudioState(): void {
    this.playingScene = createIdleScene();
    this.currentMix = structuredClone(defaultMix);
    this.lastBar = -1;
    this.masterStepCount = 0;
    this.resetPrivateCue();
    if (!this.initialized) return;
    const t = Tone.getTransport().seconds + 0.01;
    this.masterFilter.frequency.setValueAtTime(defaultMix.filter, t);
    this.delay.wet.setValueAtTime(defaultMix.delayWet, t);
    this.reverb.wet.setValueAtTime(defaultMix.reverbWet, t);
    this.master.volume.setValueAtTime(defaultMix.masterGain, t);
    this.grooveGain.volume.setValueAtTime(faderUiToDb(defaultMix.faders.groove), t);
    this.harmonyGain.volume.setValueAtTime(faderUiToDb(defaultMix.faders.harmony), t);
    this.melodyGain.volume.setValueAtTime(faderUiToDb(defaultMix.faders.melody), t);
    this.textureGain.volume.setValueAtTime(faderUiToDb(defaultMix.faders.texture), t);
  }

  start(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = "0:0:0";
    this.lastBar = -1;
    this.masterStepCount = 0;
    this.resetPrivateCue();
    transport.start("+0.08");
  }

  pause(): void { Tone.getTransport().pause(); }
  resume(): void { Tone.getTransport().start("+0.08"); }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = "0:0:0";
    this.resetPrivateCue();
  }

  clearScript(ids: number[]): void {
    ids.forEach((id) => Tone.getTransport().clear(id));
  }

  get state(): string { return Tone.getTransport().state; }

  private applySceneFx(scene: SceneDefinition, startTime: number, includeFaders: boolean): void {
    const rampDuration = 0.12;
    const targetTime = computeRampTargetTime(startTime, rampDuration);
    this.currentMix = { ...scene.fx, faders: { ...scene.fx.faders } };
    this.masterFilter.frequency.exponentialRampToValueAtTime(filterUiToHz(scene.fx.filter), targetTime);
    this.delay.wet.linearRampToValueAtTime(delayUiToWet(scene.fx.delayWet), targetTime);
    this.reverb.wet.linearRampToValueAtTime(scene.fx.reverbWet, targetTime);
    this.master.volume.linearRampToValueAtTime(scene.fx.masterGain, targetTime);
    if (includeFaders) this.setMixParams({ faders: scene.fx.faders }, rampDuration, startTime);
  }

  private playStep(scene: SceneDefinition, bar: number, step: number, time: number): void {
    const localBar = Math.max(0, bar - scene.startBar);
    this.playDrums(scene.layers.drums, step, time);
    this.playBass(scene.layers.bass, localBar, step, time);
    this.playHarmony(scene.layers.harmony, localBar, step, time);
    this.playMelody(scene.layers.melody, step, time);
    this.playTexture(scene.layers.texture, step, time);
  }

  private playDrums(patternId: string | null, step: number, time: number): void {
    if (!patternId) return;
    const pattern = drumPatterns[patternId] ?? [];
    if (pattern.includes(step)) {
      const isKick = step === 0 || step === 8 || step === 4;
      if (isKick) this.kick.triggerAttackRelease("C1", "8n", time, 0.8);
      else this.hat.triggerAttackRelease("32n", time, 0.36);
    }
    if (step === 4 || step === 12) this.snare.triggerAttackRelease("16n", time, 0.28);
    if (step % 2 === 0 && patternId === "pulse-full") this.hat.triggerAttackRelease("32n", time, 0.18);
  }

  private playBass(patternId: string | null, localBar: number, step: number, time: number): void {
    if (!patternId || step % 2 !== 0) return;
    const pattern = bassPatterns[patternId] ?? bassPatterns["bass-main"];
    const index = (localBar * 8 + step / 2) % pattern.length;
    this.bass.triggerAttackRelease(pattern[index], "8n", time, 0.48);
  }

  private playHarmony(patternId: string | null, localBar: number, step: number, time: number): void {
    if (!patternId || step !== 0) return;
    const voicings = harmonyVoicings[patternId] ?? harmonyVoicings["harmony-main"];
    this.harmony.triggerAttackRelease(voicings[localBar % voicings.length], "1m", time, 0.3);
  }

  private playMelody(patternId: string | null, step: number, time: number): void {
    if (!patternId) return;
    const note = (melodyPatterns[patternId] ?? []).find((e) => e.step === step);
    if (note) this.melody.triggerAttackRelease(note.note, note.duration, time, note.velocity);
  }

  private playTexture(patternId: string | null, step: number, time: number): void {
    if (!patternId || step !== 0) return;
    this.texture.triggerAttackRelease("2n", time, patternId === "texture-dust" ? 0.16 : 0.1);
  }

  dispose(): void {
    if (this.scheduledId !== null) Tone.getTransport().clear(this.scheduledId);
    this.stop();
    [this.kick, this.snare, this.hat, this.bass, this.harmony, this.melody, this.texture,
      this.grooveGain, this.harmonyGain, this.melodyGain, this.textureGain,
      this.delay, this.reverb, this.masterFilter, this.master, this.limiter,
      this.cueMelody, this.cueHat, this.cueKick, this.cueGain]
      .filter(Boolean).forEach((n) => n.dispose());
  }
}

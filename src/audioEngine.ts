import * as Tone from "tone";
import { BPM, TOTAL_BARS } from "./musicalConstants";
import { createIdleScene, IDLE_SCENE_ID, type SceneExecutionAuthority } from "./sceneExecution";
import { computeRampTargetTime, delayUiToWet, faderUiToDb, filterUiToHz } from "./mixMapping";
import type { LayerId, MaterialRef, MixParams, SceneDefinition } from "./types";
import type { SessionMaterialBank } from "./domain/sessionMaterialBank";
import { resolveMaterial } from "./domain/sessionMaterialBank";
import type { MaterialResolutionEvidence, MissingMaterialDiagnostic } from "./domain/materialTypes";
import type { DemoAct } from "./domain/sessionTypes";
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
  act: DemoAct;
  draftId: string;
  revision: number;
  fingerprint: string;
  bankVersion: number;
  cueStartedAt: string;
  cueStoppedAt: string;
  masterSceneBefore: string;
  masterSceneDuring: string;
  masterStepCountAtStart: number;
  masterStepCountAtStop: number;
  cueNoteCount: number;
  transportStartedByCue: boolean;
}

interface AudioCallbacks {
  onStep: (bar: number, beat: number, sixteenth: number) => void;
  onFinished: () => void;
  onBoundary?: (bar: number) => void;
  onLaunchAtBar?: (bar: number, sceneId: string, time: number) => void;
  onCueComplete?: (evidence: CueCompletionEvidence) => void;
  onMaterialResolved?: (evidence: MaterialResolutionEvidence) => void;
  onMissingMaterial?: (diagnostic: MissingMaterialDiagnostic) => void;
}

export class AudioEngine {
  private readonly callbacks: AudioCallbacks;
  private sceneAuthority: SceneExecutionAuthority | null = null;
  private materialBank: SessionMaterialBank | null = null;
  private baselineMix: MixParams | null = null;
  private currentAct: DemoAct = "production";
  private initialized = false;
  private scheduledId: number | null = null;
  private lastBar = -1;
  private currentMix: MixParams = { filter: 1200, delayWet: 0.2, reverbWet: 0.42, masterGain: -3, faders: { groove: 64, harmony: 48, melody: 28, texture: 58 } };
  private playingScene: SceneDefinition = createIdleScene();
  private launchAtBar = new Map<number, string>();
  private masterStepCount = 0;
  private cueNoteCount = 0;
  private cueActive = false;
  private cueDraftId: string | null = null;
  private cueMaterialRef: MaterialRef | null = null;
  private cueScheduleIds: number[] = [];
  private cueStopScheduleId: number | null = null;
  private masterSceneAtCueStart = IDLE_SCENE_ID;
  private masterStepCountAtCueStart = 0;
  private cueStartedAtTransportPosition = "0:0:0";
  private cueStopsAtTransportPosition = "0:0:0";
  private cueOwnsTransport = false;
  private cueActAtStart: DemoAct = "production";
  private cueBankVersionAtStart = 0;
  private readonly cueDurationMeasures = 2;
  readonly materialResolutionLog: MaterialResolutionEvidence[] = [];
  readonly missingMaterialLog: MissingMaterialDiagnostic[] = [];
  readonly cueCompletionLog: CueCompletionEvidence[] = [];

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

  setMaterialBank(bank: SessionMaterialBank): void {
    this.materialBank = bank;
  }

  setBaselineMix(mix: MixParams): void {
    this.baselineMix = structuredClone(mix);
    this.currentMix = structuredClone(mix);
  }

  setCurrentAct(act: DemoAct): void {
    if (this.currentAct !== act && this.cueActive) this.stopPrivateCue();
    this.currentAct = act;
  }

  getMaterialBank(): SessionMaterialBank | null {
    return this.materialBank;
  }

  setLaunchBoundaries(boundaries: Map<number, string>): void {
    this.launchAtBar = boundaries;
  }

  clearLaunchBoundaries(): void {
    this.launchAtBar.clear();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    const initMix = this.baselineMix ?? this.currentMix;
    this.master = new Tone.Volume(initMix.masterGain);
    this.limiter = new Tone.Limiter(-1);
    this.masterFilter = new Tone.Filter({ frequency: initMix.filter, type: "lowpass", rolloff: -24 });
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.26, wet: initMix.delayWet });
    this.reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.03, wet: initMix.reverbWet });
    this.grooveGain = new Tone.Volume(faderUiToDb(initMix.faders.groove));
    this.harmonyGain = new Tone.Volume(faderUiToDb(initMix.faders.harmony));
    this.melodyGain = new Tone.Volume(faderUiToDb(initMix.faders.melody));
    this.textureGain = new Tone.Volume(faderUiToDb(initMix.faders.texture));

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
      const scene = this.currentAct === "livePerformance"
        ? (this.sceneAuthority?.playingScene ?? this.playingScene)
        : this.playingScene;

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
    return this.currentAct === "livePerformance"
      ? (this.sceneAuthority?.playingSceneId ?? this.playingScene.id)
      : this.playingScene.id;
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

  getMasterStepCount(): number { return this.masterStepCount; }
  getCueNoteCount(): number { return this.cueNoteCount; }
  isCueActive(): boolean { return this.cueActive; }
  getCueDraftId(): string | null { return this.cueDraftId; }
  getCueScheduleCount(): number { return this.cueScheduleIds.length + (this.cueStopScheduleId !== null ? 1 : 0); }
  getCueStartedAtTransportPosition(): string { return this.cueStartedAtTransportPosition; }
  getCueStopsAtTransportPosition(): string { return this.cueStopsAtTransportPosition; }
  cueStartedTransport(): boolean { return this.cueOwnsTransport; }

  startPrivateCue(materialRef: MaterialRef, atTransportPosition?: MusicalPosition): void {
    if (!this.materialBank) return;
    const material = resolveMaterial(this.materialBank, materialRef);
    if (!material) {
      this.emitMissing("cue", "", "cue", materialRef);
      return;
    }
    if (!this.initialized) return;
    this.stopPrivateCue();

    const transport = Tone.getTransport();
    const transportWasStarted = transport.state === "started";
    const startPos = atTransportPosition ?? parseTransportPosition(transport.position.toString());
    const stopPos = computeCueStopPosition(startPos, this.cueDurationMeasures);

    this.cueActive = true;
    this.cueDraftId = materialRef.draftId;
    this.cueMaterialRef = materialRef;
    this.cueNoteCount = 0;
    this.masterSceneAtCueStart = this.getPlayingSceneId();
    this.masterStepCountAtCueStart = this.masterStepCount;
    this.cueStartedAtTransportPosition = formatPosition(startPos);
    this.cueStopsAtTransportPosition = formatPosition(stopPos);
    this.cueOwnsTransport = this.currentAct === "production" && !transportWasStarted;
    this.cueActAtStart = this.currentAct;
    this.cueBankVersionAtStart = this.materialBank.version;
    this.cueGain.volume.setValueAtTime(-8, transport.seconds);

    this.logResolution("cue", "", "cue", materialRef);

    const scheduleCueHit = (offsetSixteenths: number, play: (t: number) => void): void => {
      const notePos = addSixteenths(startPos, offsetSixteenths);
      const when = positionToTicks(notePos) <= positionToTicks(startPos)
        ? "+0"
        : formatPosition(notePos);
      const id = transport.schedule((t) => play(t), when);
      this.cueScheduleIds.push(id);
    };

    this.scheduleMaterialHits(material, scheduleCueHit, true);

    this.cueStopScheduleId = transport.schedule((t) => {
      this.stopPrivateCue(t, parseTransportPosition(formatPosition(stopPos)));
      this.cueStopScheduleId = null;
    }, formatPosition(stopPos));

    if (this.cueOwnsTransport) transport.start("+0.02");
  }

  stopPrivateCue(at?: number, atTransportPosition?: MusicalPosition): void {
    if (!this.initialized) return;
    const wasActive = this.cueActive;
    const draftId = this.cueDraftId;
    const ref = this.cueMaterialRef;
    const transport = Tone.getTransport();
    const time = at ?? transport.seconds;
    const stoppedAt = atTransportPosition ?? parseTransportPosition(transport.position.toString());
    const transportStartedByCue = this.cueOwnsTransport;

    this.cueScheduleIds.forEach((id) => transport.clear(id));
    this.cueScheduleIds = [];
    if (this.cueStopScheduleId !== null) {
      transport.clear(this.cueStopScheduleId);
      this.cueStopScheduleId = null;
    }
    this.cueMelody.triggerRelease(time);
    this.cueGain.volume.linearRampToValueAtTime(-60, computeRampTargetTime(time, 0.08));

    if (wasActive && draftId && ref) {
      const evidence: CueCompletionEvidence = {
        act: this.cueActAtStart,
        draftId,
        revision: ref.revision,
        fingerprint: ref.fingerprint,
        bankVersion: this.cueBankVersionAtStart,
        cueStartedAt: this.cueStartedAtTransportPosition,
        cueStoppedAt: formatPosition(stoppedAt),
        masterSceneBefore: this.masterSceneAtCueStart,
        masterSceneDuring: this.getPlayingSceneId(),
        masterStepCountAtStart: this.masterStepCountAtCueStart,
        masterStepCountAtStop: this.masterStepCount,
        cueNoteCount: this.cueNoteCount,
        transportStartedByCue,
      };
      this.cueCompletionLog.push(evidence);
      this.callbacks.onCueComplete?.(evidence);
    }

    this.cueActive = false;
    this.cueDraftId = null;
    this.cueMaterialRef = null;
    this.cueOwnsTransport = false;
    this.cueBankVersionAtStart = 0;
    if (transportStartedByCue) {
      transport.stop();
      transport.position = "0:0:0";
    }
  }

  resetPrivateCue(): void {
    this.stopPrivateCue();
    this.cueNoteCount = 0;
    this.masterSceneAtCueStart = IDLE_SCENE_ID;
    this.masterStepCountAtCueStart = 0;
    this.cueStartedAtTransportPosition = "0:0:0";
    this.cueStopsAtTransportPosition = "0:0:0";
    this.cueOwnsTransport = false;
  }

  resetAudioState(): void {
    this.playingScene = createIdleScene();
    const mix = this.baselineMix ?? this.currentMix;
    this.currentMix = structuredClone(mix);
    this.lastBar = -1;
    this.masterStepCount = 0;
    this.resetPrivateCue();
    if (!this.initialized) return;
    const t = Tone.getTransport().seconds + 0.01;
    this.masterFilter.frequency.setValueAtTime(mix.filter, t);
    this.delay.wet.setValueAtTime(mix.delayWet, t);
    this.reverb.wet.setValueAtTime(mix.reverbWet, t);
    this.master.volume.setValueAtTime(mix.masterGain, t);
    this.grooveGain.volume.setValueAtTime(faderUiToDb(mix.faders.groove), t);
    this.harmonyGain.volume.setValueAtTime(faderUiToDb(mix.faders.harmony), t);
    this.melodyGain.volume.setValueAtTime(faderUiToDb(mix.faders.melody), t);
    this.textureGain.volume.setValueAtTime(faderUiToDb(mix.faders.texture), t);
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
    const consumer = this.currentAct === "canonicalPlayback" ? "canonical" : "live";
    this.playLayer(scene.id, "drums", scene.layers.drums, step, localBar, step, time, consumer);
    this.playLayer(scene.id, "bass", scene.layers.bass, step, localBar, step, time, consumer);
    this.playLayer(scene.id, "harmony", scene.layers.harmony, step, localBar, step, time, consumer);
    this.playLayer(scene.id, "melody", scene.layers.melody, step, localBar, step, time, consumer);
    this.playLayer(scene.id, "texture", scene.layers.texture, step, localBar, step, time, consumer);
  }

  private playLayer(
    sceneId: string,
    layer: LayerId,
    ref: MaterialRef | null,
    _step: number,
    localBar: number,
    globalStep: number,
    time: number,
    consumer: "canonical" | "live",
  ): void {
    if (!ref) return;
    if (!this.materialBank) {
      this.emitMissing(consumer, sceneId, layer, ref);
      return;
    }
    const material = resolveMaterial(this.materialBank, ref);
    if (!material) {
      this.emitMissing(consumer, sceneId, layer, ref);
      return;
    }
    this.logResolution(consumer, sceneId, layer, ref);

    const content = material.content;
    if (content.kind === "drums") {
      for (const hit of content.hits) {
        if (hit.step !== globalStep) continue;
        if (hit.voice === "kick") this.kick.triggerAttackRelease("C1", "8n", time, hit.velocity);
        else if (hit.voice === "snare") this.snare.triggerAttackRelease("16n", time, hit.velocity * 0.35);
        else this.hat.triggerAttackRelease("32n", time, hit.velocity * 0.5);
      }
    } else if (content.kind === "bass") {
      if (globalStep % 2 !== 0) return;
      const note = content.notes.find((n) => n.step === globalStep);
      if (note) this.bass.triggerAttackRelease(note.note, note.duration, time, note.velocity);
    } else if (content.kind === "harmony") {
      if (globalStep !== 0) return;
      const chord = content.chords[localBar % content.chords.length];
      if (chord) this.harmony.triggerAttackRelease(chord.notes, "1m", time, 0.3);
    } else if (content.kind === "melody") {
      const note = content.notes.find((n) => n.step === globalStep);
      if (note) this.melody.triggerAttackRelease(note.note, note.duration, time, note.velocity);
    } else if (content.kind === "texture") {
      if (globalStep !== 0) return;
      this.texture.triggerAttackRelease(content.duration, time, content.level);
    }
  }

  private scheduleMaterialHits(
    material: import("./domain/materialTypes").ProducedMaterial,
    schedule: (offset: number, play: (t: number) => void) => void,
    isCue: boolean,
  ): void {
    const content = material.content;
    if (content.kind === "melody" || content.kind === "bass") {
      for (const note of content.notes) {
        schedule(note.step, (t) => {
          if (isCue) {
            this.cueMelody.triggerAttackRelease(note.note, note.duration ?? "8n", t, note.velocity ?? 0.6);
            this.cueNoteCount += 1;
          }
        });
      }
    } else if (content.kind === "drums") {
      for (const hit of content.hits) {
        schedule(hit.step, (t) => {
          if (hit.voice === "kick") this.cueKick.triggerAttackRelease("C2", "8n", t, hit.velocity);
          else this.cueHat.triggerAttackRelease("32n", t, hit.velocity * 0.5);
          this.cueNoteCount += 1;
        });
      }
    } else if (content.kind === "harmony") {
      for (const chord of content.chords) {
        schedule(chord.bar * 16, (t) => {
          this.cueMelody.triggerAttackRelease(chord.notes[0] ?? "C4", "4n", t, 0.5);
          this.cueNoteCount += 1;
        });
      }
    }
  }

  private logResolution(consumer: "cue" | "canonical" | "live", sceneId: string, layer: string, ref: MaterialRef): void {
    const evidence: MaterialResolutionEvidence = {
      act: this.currentAct === "comparison" ? "livePerformance" : this.currentAct,
      consumer,
      sceneId,
      layer,
      draftId: ref.draftId,
      revision: ref.revision,
      fingerprint: ref.fingerprint,
      bankVersion: this.materialBank?.version ?? 0,
    };
    this.materialResolutionLog.push(evidence);
    this.callbacks.onMaterialResolved?.(evidence);
  }

  private emitMissing(consumer: string, sceneId: string, layer: string, ref: MaterialRef): void {
    const diagnostic: MissingMaterialDiagnostic = {
      act: this.currentAct,
      sceneId,
      layer,
      draftId: ref.draftId,
      revision: ref.revision,
      fingerprint: ref.fingerprint,
      message: `Missing material ${ref.draftId}@${ref.revision} for ${consumer}`,
    };
    this.missingMaterialLog.push(diagnostic);
    this.callbacks.onMissingMaterial?.(diagnostic);
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

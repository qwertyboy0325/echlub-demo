import * as Tone from "tone";
import { BPM, TOTAL_BARS } from "./musicalConstants";
import { createIdleScene, IDLE_SCENE_ID, type SceneExecutionAuthority } from "./sceneExecution";
import { computeRampTargetTime, delayUiToWet, faderUiToDb, filterUiToHz } from "./mixMapping";
import type { LayerId, MaterialRef, MixParams, NoteEvent, SceneDefinition } from "./types";
import type { SessionMaterialBank } from "./domain/sessionMaterialBank";
import { resolveMaterial } from "./domain/sessionMaterialBank";
import type { MaterialResolutionEvidence, MissingMaterialDiagnostic } from "./domain/materialTypes";
import type { DemoAct } from "./domain/sessionTypes";
import { DEFAULT_SOUND_DESIGN, type SoundDesignPreset } from "./domain/reconstructionPack";
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

export function shouldAudioEngineFinishAtStep(
  act: DemoAct,
  bar: number,
  totalBars: number,
  beat: number,
  sixteenth: number,
): boolean {
  return act !== "canonicalPlayback" && bar === totalBars && beat === 0 && sixteenth === 0;
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
  onBeforeBoundary?: (bar: number, time: number) => void;
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
  private totalBars = TOTAL_BARS;
  private tempoMultiplier = 1;
  private baseBpm = BPM;
  private tempoMap: { bar: number; bpm: number }[] = [{ bar: 0, bpm: BPM }];
  private soundDesign: SoundDesignPreset = structuredClone(DEFAULT_SOUND_DESIGN);
  private transportSixteenthCounter = 0;
  private playbackGeneration = 0;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
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
  private masterMeter!: Tone.Meter;
  private masterCompressor!: Tone.Compressor;
  private masterFilter!: Tone.Filter;
  private delay!: Tone.FeedbackDelay;
  private reverb!: Tone.Reverb;
  private delaySend!: Tone.Gain;
  private reverbSend!: Tone.Gain;
  private grooveGain!: Tone.Volume;
  private harmonyGain!: Tone.Volume;
  private melodyGain!: Tone.Volume;
  private textureGain!: Tone.Volume;
  private drumDrive!: Tone.Distortion;
  private drumFilter!: Tone.Filter;
  private bassDrive!: Tone.Distortion;
  private harmonyFilter!: Tone.Filter;
  private harmonyChorus!: Tone.Chorus;
  private melodyFilter!: Tone.Filter;
  private melodyChorus!: Tone.Chorus;
  private textureFilter!: Tone.Filter;
  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hat!: Tone.MetalSynth;
  private bass!: Tone.MonoSynth;
  private bassAccent!: Tone.MonoSynth;
  private bassMute!: Tone.NoiseSynth;
  private harmony!: Tone.PolySynth;
  private melody!: Tone.PolySynth;
  private melodyLead!: Tone.MonoSynth;
  private melodyMute!: Tone.NoiseSynth;
  private reedLead!: Tone.MonoSynth;
  private reedLeadAlt!: Tone.MonoSynth;
  private reedBreath!: Tone.NoiseSynth;
  private reedDrive!: Tone.Distortion;
  private reedBody!: Tone.Filter;
  private reedPresence!: Tone.Filter;
  private reedVibrato!: Tone.LFO;
  private guitarBody!: Tone.MonoSynth;
  private guitarString!: Tone.PluckSynth;
  private guitarFretNoise!: Tone.NoiseSynth;
  private guitarDrive!: Tone.Distortion;
  private guitarPresence!: Tone.Filter;
  private texture!: Tone.NoiseSynth;
  private cueMelody!: Tone.Synth;
  private cueReed!: Tone.MonoSynth;
  private cueGuitar!: Tone.PluckSynth;
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

  setSoundDesign(preset: SoundDesignPreset): void {
    if (this.initialized) throw new Error("Sound design must be selected before AudioEngine initialization");
    this.soundDesign = structuredClone(preset);
  }

  getSoundDesignPreset(): SoundDesignPreset {
    return structuredClone(this.soundDesign);
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
    if (!this.initializationPromise) this.initializationPromise = this.initializeOnce();
    try {
      await this.initializationPromise;
    } finally {
      if (!this.initialized) this.initializationPromise = null;
    }
  }

  private async initializeOnce(): Promise<void> {
    await Tone.start();

    const initMix = this.baselineMix ?? this.currentMix;
    const sound = this.soundDesign;
    this.master = new Tone.Volume(initMix.masterGain);
    this.limiter = new Tone.Limiter(-1);
    this.masterMeter = new Tone.Meter({ normalRange: false, smoothing: 0.8 });
    this.masterCompressor = new Tone.Compressor({ threshold: sound.master.compressorThreshold, ratio: sound.master.compressorRatio, attack: 0.03, release: 0.22 });
    this.masterFilter = new Tone.Filter({ frequency: initMix.filter, type: "lowpass", rolloff: sound.master.filterRolloff });
    this.delay = new Tone.FeedbackDelay({ delayTime: sound.master.delayTime, feedback: sound.master.delayFeedback, wet: 1 });
    this.reverb = new Tone.Reverb({ decay: sound.master.reverbDecay, preDelay: sound.master.reverbPreDelay, wet: 1 });
    this.delaySend = new Tone.Gain(delayUiToWet(initMix.delayWet));
    this.reverbSend = new Tone.Gain(initMix.reverbWet);
    this.grooveGain = new Tone.Volume(faderUiToDb(initMix.faders.groove));
    this.harmonyGain = new Tone.Volume(faderUiToDb(initMix.faders.harmony));
    this.melodyGain = new Tone.Volume(faderUiToDb(initMix.faders.melody));
    this.textureGain = new Tone.Volume(faderUiToDb(initMix.faders.texture));

    this.drumDrive = new Tone.Distortion({ distortion: sound.drums.drive, wet: sound.drums.drive > 0 ? 1 : 0 });
    this.drumFilter = new Tone.Filter({ frequency: sound.drums.filterFrequency, type: "lowpass", rolloff: -24 });
    this.bassDrive = new Tone.Distortion({ distortion: sound.bass.drive, wet: sound.bass.drive > 0 ? 1 : 0 });
    this.harmonyFilter = new Tone.Filter({ frequency: sound.harmony.filterFrequency, type: "lowpass", rolloff: -24 });
    this.harmonyChorus = new Tone.Chorus({ frequency: sound.harmony.chorusFrequency, delayTime: 3.5, depth: sound.harmony.chorusDepth, wet: sound.harmony.chorusWet }).start();
    this.melodyFilter = new Tone.Filter({ frequency: sound.melody.filterFrequency, type: "lowpass", rolloff: -24 });
    this.melodyChorus = new Tone.Chorus({ frequency: sound.melody.chorusFrequency, delayTime: 2.8, depth: sound.melody.chorusDepth, wet: sound.melody.chorusWet }).start();
    this.textureFilter = new Tone.Filter({ frequency: sound.texture.filterFrequency, type: "lowpass", rolloff: -24 });

    this.master.chain(this.masterFilter, this.masterCompressor, this.limiter, Tone.getDestination());
    this.limiter.connect(this.masterMeter);
    this.delaySend.chain(this.delay, this.master);
    this.reverbSend.chain(this.reverb, this.master);

    this.kick = new Tone.MembraneSynth({ pitchDecay: sound.drums.kickPitchDecay, octaves: sound.drums.kickOctaves, oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: sound.drums.kickDecay, sustain: 0, release: 0.08 } });
    this.snare = new Tone.NoiseSynth({ noise: { type: sound.drums.snareNoise }, envelope: { attack: 0.002, decay: sound.drums.snareDecay, sustain: 0, release: 0.05 } });
    this.hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: sound.drums.hatDecay, release: 0.01 },
      harmonicity: 5.1, modulationIndex: 24, resonance: sound.drums.hatResonance, octaves: 1.5, volume: -18,
    } as Tone.MetalSynthOptions);
    this.bass = new Tone.MonoSynth({ oscillator: { type: sound.bass.oscillator }, filter: { Q: sound.bass.filterQ, type: "lowpass", rolloff: -24 }, envelope: sound.bass.envelope, filterEnvelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.25, baseFrequency: sound.bass.filterBaseFrequency, octaves: sound.bass.filterOctaves }, volume: sound.bass.volume });
    this.bassAccent = new Tone.MonoSynth({ oscillator: { type: "triangle" }, filter: { Q: 1, type: "lowpass", rolloff: -24 }, envelope: { ...sound.bass.envelope, sustain: Math.min(0.35, sound.bass.envelope.sustain), release: Math.min(0.16, sound.bass.envelope.release) }, filterEnvelope: { attack: 0.003, decay: 0.1, sustain: 0.1, release: 0.14, baseFrequency: sound.bass.filterBaseFrequency * 1.8, octaves: 1 }, volume: sound.bass.volume - 5 });
    this.bassMute = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.015 }, volume: -27 });
    this.harmony = sound.harmony.generator === "fm"
      ? new Tone.PolySynth(Tone.FMSynth, { harmonicity: 1.5, modulationIndex: 1.2, oscillator: { type: sound.harmony.oscillator }, envelope: sound.harmony.envelope, modulationEnvelope: { attack: 0.002, decay: 0.08, sustain: 0.05, release: 0.15 }, volume: sound.harmony.volume })
      : new Tone.PolySynth(Tone.Synth, { oscillator: { type: sound.harmony.oscillator }, envelope: sound.harmony.envelope, volume: sound.harmony.volume });
    this.melody = sound.melody.generator === "fm"
      ? new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2, modulationIndex: 1.5, oscillator: { type: sound.melody.oscillator }, envelope: sound.melody.envelope, modulationEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.08, release: 0.2 }, volume: sound.melody.volume })
      : new Tone.PolySynth(Tone.Synth, { oscillator: { type: sound.melody.oscillator }, envelope: sound.melody.envelope, volume: sound.melody.volume });
    this.melodyLead = new Tone.MonoSynth({
      oscillator: { type: "triangle" }, portamento: 0.055,
      filter: { Q: 1.5, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.28, release: 0.16 },
      filterEnvelope: { attack: 0.003, decay: 0.1, sustain: 0.16, release: 0.15, baseFrequency: 260, octaves: 3.4 },
      volume: sound.melody.volume - 2,
    });
    this.melodyMute = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.012 }, volume: -30 });
    // Two browser-native reed voices are required for the score's alto/tenor
    // trading and unison passages. A triangle-rich body avoids the buzzy,
    // permanently-vibrating synth-sax character of the earlier fatsaw patch.
    // It is driven by NoteEvents and contains no sampled reference audio.
    this.reedLead = new Tone.MonoSynth({
      oscillator: { type: "fattriangle", count: 2, spread: 2 },
      portamento: 0.045,
      filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.018, decay: 0.11, sustain: 0.68, release: 0.18 },
      filterEnvelope: { attack: 0.012, decay: 0.14, sustain: 0.52, release: 0.17, baseFrequency: 360, octaves: 3.45 },
      volume: sound.melody.volume - 0.5,
    });
    this.reedLeadAlt = new Tone.MonoSynth({
      oscillator: { type: "fattriangle", count: 2, spread: 2 },
      portamento: 0.04,
      filter: { Q: 1.05, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.016, decay: 0.1, sustain: 0.64, release: 0.17 },
      filterEnvelope: { attack: 0.01, decay: 0.13, sustain: 0.5, release: 0.16, baseFrequency: 390, octaves: 3.3 },
      volume: sound.melody.volume - 2.5,
    });
    this.reedBreath = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.004, decay: 0.045, sustain: 0, release: 0.02 }, volume: -31 });
    this.reedDrive = new Tone.Distortion({ distortion: 0.095, wet: 0.24 });
    this.reedBody = new Tone.Filter({ type: "peaking", frequency: 690, Q: 0.72, gain: 3.2 });
    this.reedPresence = new Tone.Filter({ type: "peaking", frequency: 1850, Q: 0.95, gain: 1.2 });
    this.reedVibrato = new Tone.LFO({ frequency: 5.05, min: -3, max: 3 }).start();
    this.reedVibrato.connect(this.reedLead.detune);
    this.reedVibrato.connect(this.reedLeadAlt.detune);
    this.guitarBody = new Tone.MonoSynth({
      oscillator: { type: "fattriangle", count: 2, spread: 3 },
      portamento: 0,
      filter: { Q: 1.7, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.002, decay: 0.16, sustain: 0.3, release: 0.19 },
      filterEnvelope: { attack: 0.001, decay: 0.11, sustain: 0.18, release: 0.16, baseFrequency: 520, octaves: 3.15 },
      volume: sound.melody.volume - 0.25,
    });
    this.guitarString = new Tone.PluckSynth({ attackNoise: 0.72, dampening: 4300, resonance: 0.82, release: 0.22, volume: sound.melody.volume - 8 });
    this.guitarFretNoise = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.026, sustain: 0, release: 0.012 }, volume: -25 });
    this.guitarDrive = new Tone.Distortion({ distortion: 0.17, wet: 0.52 });
    this.guitarPresence = new Tone.Filter({ type: "peaking", frequency: 1480, Q: 1.2, gain: 5.4 });
    this.texture = new Tone.NoiseSynth({ noise: { type: sound.texture.noise }, envelope: sound.texture.envelope, volume: sound.texture.volume });

    this.kick.connect(this.drumDrive);
    this.snare.connect(this.drumDrive);
    this.hat.connect(this.drumDrive);
    this.drumDrive.chain(this.drumFilter, this.grooveGain);
    this.bass.chain(this.bassDrive, this.grooveGain);
    this.bassAccent.connect(this.bassDrive);
    this.bassMute.connect(this.bassDrive);
    this.grooveGain.connect(this.master);
    this.harmony.chain(this.harmonyFilter, this.harmonyChorus, this.harmonyGain);
    this.harmonyGain.connect(this.master);
    this.harmonyGain.connect(this.reverbSend);
    this.melody.chain(this.melodyFilter, this.melodyChorus, this.melodyGain);
    this.melodyLead.connect(this.melodyFilter);
    this.melodyMute.connect(this.melodyFilter);
    this.reedLead.chain(this.reedDrive, this.reedBody, this.reedPresence, this.melodyFilter);
    this.reedLeadAlt.connect(this.reedDrive);
    this.reedBreath.connect(this.reedBody);
    this.guitarBody.chain(this.guitarDrive, this.guitarPresence, this.melodyFilter);
    this.guitarString.connect(this.guitarPresence);
    this.guitarFretNoise.connect(this.guitarPresence);
    this.melodyGain.connect(this.master);
    this.melodyGain.connect(this.delaySend);
    this.melodyGain.connect(this.reverbSend);
    this.texture.chain(this.textureFilter, this.textureGain);
    this.textureGain.connect(this.master);
    this.textureGain.connect(this.reverbSend);

    this.cueGain = new Tone.Volume(-8);
    this.cueMelody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0.2, release: 0.35 },
      volume: -10,
    });
    this.cueReed = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 1.1, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.025, decay: 0.12, sustain: 0.62, release: 0.22 },
      filterEnvelope: { attack: 0.015, decay: 0.14, sustain: 0.5, release: 0.18, baseFrequency: 420, octaves: 3 },
      volume: -11,
    });
    this.cueGuitar = new Tone.PluckSynth({ attackNoise: 1.1, dampening: 3400, resonance: 0.88, release: 0.42, volume: -9 });
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
    this.cueReed.connect(this.cueGain);
    this.cueGuitar.connect(this.cueGain);
    this.cueHat.connect(this.cueGain);
    this.cueKick.connect(this.cueGain);
    this.cueGain.connect(Tone.getDestination());

    const transport = Tone.getTransport();
    transport.bpm.value = this.baseBpm * this.tempoMultiplier;
    transport.timeSignature = 4;
    transport.loop = false;

    this.scheduledId = transport.scheduleRepeat((time: number) => {
      const callbackGeneration = this.playbackGeneration;
      // Tone's repeat callback is the musical clock. Count those callbacks
      // directly so a stop/position reset cannot inherit absolute audio-time
      // ticks from an earlier run in the same browser runtime.
      const totalSixteenths = this.transportSixteenthCounter;
      this.transportSixteenthCounter += 1;
      const bar = Math.floor(totalSixteenths / 16);
      const beat = Math.floor((totalSixteenths % 16) / 4);
      const sixteenth = totalSixteenths % 4;
      const step = beat * 4 + sixteenth;
      if (beat === 0 && sixteenth === 0) {
        const tempoChange = this.tempoMap.find((entry) => entry.bar === bar);
        if (tempoChange) {
          this.baseBpm = tempoChange.bpm;
          Tone.getTransport().bpm.setValueAtTime(this.baseBpm * this.tempoMultiplier, time);
        }
        this.callbacks.onBeforeBoundary?.(bar, time);
        const launchSceneId = this.launchAtBar.get(bar);
        if (launchSceneId) this.callbacks.onLaunchAtBar?.(bar, launchSceneId, time);
      }
      const scene = this.currentAct === "livePerformance"
        ? (this.sceneAuthority?.playingScene ?? this.playingScene)
        : this.playingScene;

      this.playStep(scene, bar, step, time);
      this.masterStepCount += 1;

      Tone.getDraw().schedule(() => {
        if (callbackGeneration !== this.playbackGeneration) return;
        if (bar !== this.lastBar && beat === 0 && sixteenth === 0) {
          this.lastBar = bar;
          this.callbacks.onBoundary?.(bar);
        }
        this.callbacks.onStep(bar, beat, sixteenth);
        if (shouldAudioEngineFinishAtStep(this.currentAct, bar, this.totalBars, beat, sixteenth)) {
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

  setTotalBars(totalBars: number): void {
    if (!Number.isInteger(totalBars) || totalBars <= 0) {
      throw new Error("totalBars must be a positive integer");
    }
    this.totalBars = totalBars;
  }

  getTotalBars(): number {
    return this.totalBars;
  }

  setTempoMultiplier(multiplier: number): void {
    const safeMultiplier = Math.max(0.25, Math.min(8, multiplier));
    this.tempoMultiplier = safeMultiplier;
    if (this.initialized) Tone.getTransport().bpm.value = this.baseBpm * safeMultiplier;
  }

  setBaseBpm(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error("bpm must be positive");
    this.baseBpm = bpm;
    if (this.initialized) Tone.getTransport().bpm.value = this.baseBpm * this.tempoMultiplier;
  }

  setTempoMap(tempoMap: readonly { bar: number; bpm: number }[]): void {
    if (tempoMap.length === 0) throw new Error("tempoMap must not be empty");
    const next = tempoMap.map((entry) => ({ ...entry })).sort((a, b) => a.bar - b.bar);
    if (next[0]?.bar !== 0) throw new Error("tempoMap must start at bar 0");
    if (next.some((entry, index) => !Number.isInteger(entry.bar)
      || entry.bar < 0
      || !Number.isFinite(entry.bpm)
      || entry.bpm <= 0
      || (index > 0 && entry.bar === next[index - 1]?.bar))) {
      throw new Error("tempoMap entries require unique non-negative integer bars and positive BPM values");
    }
    this.tempoMap = next;
    this.setBaseBpm(next[0].bpm);
  }

  getTempoMap(): { bar: number; bpm: number }[] {
    return structuredClone(this.tempoMap);
  }

  getCurrentBaseBpm(): number {
    return this.baseBpm;
  }

  getMasterLevelDb(): number {
    if (!this.initialized || !this.masterMeter) return Number.NEGATIVE_INFINITY;
    const value = this.masterMeter.getValue();
    return Array.isArray(value) ? Math.max(...value) : value;
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
      this.delaySend.gain.linearRampToValueAtTime(delayUiToWet(params.delayWet), targetTime);
    }
    if (params.reverbWet !== undefined) {
      this.currentMix.reverbWet = params.reverbWet;
      this.reverbSend.gain.linearRampToValueAtTime(params.reverbWet, targetTime);
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
    // Tone's transport can report a tiny negative epsilon at the zero boundary.
    // Web Audio rejects any negative AudioParam time, even one caused only by
    // floating-point rounding.
    this.cueGain.volume.setValueAtTime(-8, Math.max(0, transport.seconds));

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

    if (this.cueOwnsTransport) {
      this.transportSixteenthCounter = startPos.bar * 16 + startPos.beat * 4 + startPos.sixteenth;
      transport.start("+0.02");
    }
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
    this.delaySend.gain.setValueAtTime(delayUiToWet(mix.delayWet), t);
    this.reverbSend.gain.setValueAtTime(mix.reverbWet, t);
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
    this.transportSixteenthCounter = 0;
    this.playbackGeneration += 1;
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
    this.delaySend.gain.linearRampToValueAtTime(delayUiToWet(scene.fx.delayWet), targetTime);
    this.reverbSend.gain.linearRampToValueAtTime(scene.fx.reverbWet, targetTime);
    this.master.volume.linearRampToValueAtTime(scene.fx.masterGain, targetTime);
    if (includeFaders) this.setMixParams({ faders: scene.fx.faders }, rampDuration, startTime);
  }

  private playStep(scene: SceneDefinition, bar: number, step: number, time: number): void {
    const localBar = Math.max(0, bar - scene.startBar);
    const consumer = this.currentAct === "canonicalPlayback" ? "canonical" : "live";
    for (const layer of ["drums", "bass", "harmony", "melody", "texture"] as const) {
      this.playLayer(scene.id, layer, scene.layers[layer], localBar, step, time, consumer, 0);
      for (const [index, ref] of (scene.layerStacks?.[layer] ?? []).entries()) {
        this.playLayer(scene.id, layer, ref, localBar, step, time, consumer, index + 1);
      }
    }
  }

  private playLayer(
    sceneId: string,
    layer: LayerId,
    ref: MaterialRef | null,
    localBar: number,
    globalStep: number,
    time: number,
    consumer: "canonical" | "live",
    voiceIndex: number,
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
    const patternStep = (patternBars: number) => (localBar % Math.max(1, patternBars)) * 16 + globalStep;
    if (content.kind === "drums") {
      const currentStep = patternStep(content.patternBars);
      for (const hit of content.hits) {
        if (hit.bar * 16 + hit.step !== currentStep) continue;
        if (hit.voice === "kick") this.kick.triggerAttackRelease("C1", hit.duration ?? "8n", time, hit.velocity);
        else if (hit.voice === "snare") this.snare.triggerAttackRelease(hit.duration ?? "16n", time, hit.velocity * 0.35);
        else this.hat.triggerAttackRelease(hit.duration ?? "32n", time, hit.velocity * 0.5);
      }
    } else if (content.kind === "bass") {
      const currentStep = patternStep(content.patternBars);
      const note = content.notes.find((n) => (n.bar ?? 0) * 16 + n.step === currentStep);
      if (note) this.playExpressiveNote("bass", note, voiceIndex, time);
    } else if (content.kind === "harmony") {
      const currentStep = patternStep(content.patternBars);
      const chords = content.chords.filter((chord) => chord.bar * 16 + (chord.step ?? 0) === currentStep);
      for (const chord of chords) {
        const durationSeconds = Math.max(0.03, Tone.Time(chord.duration ?? "1m").toSeconds() - 0.012);
        this.harmony.triggerAttackRelease(chord.notes, durationSeconds, time, chord.velocity ?? 0.3);
      }
    } else if (content.kind === "melody") {
      const currentStep = patternStep(content.patternBars);
      const note = content.notes.find((n) => (n.bar ?? 0) * 16 + n.step === currentStep);
      if (note) this.playExpressiveNote("melody", note, voiceIndex, time);
    } else if (content.kind === "texture") {
      if (globalStep !== 0) return;
      this.texture.triggerAttackRelease(content.duration, time, content.level);
    }
  }

  private playExpressiveNote(layer: "bass" | "melody", note: NoteEvent, voiceIndex: number, time: number): void {
    const sixteenth = Tone.Time("16n").toSeconds();
    const scheduledTime = time + (note.timingOffset ?? 0) * sixteenth;
    const durationSeconds = Math.max(0.03, Tone.Time(note.duration).toSeconds());
    const velocityScale = note.articulation === "ghost" ? 0.5 : note.articulation === "accent" ? 1.12 : 1;
    const velocity = Math.max(0.02, Math.min(1, note.velocity * velocityScale));

    if (layer === "melody" && note.instrument === "guitar") {
      this.playGuitarNote(note, scheduledTime, durationSeconds, velocity);
      return;
    }

    if (note.articulation === "muted") {
      (layer === "bass" ? this.bassMute : this.melodyMute).triggerAttackRelease("32n", scheduledTime, velocity);
      return;
    }

    if (layer === "melody" && note.instrument === "reed") {
      this.playReedNote(note, voiceIndex, scheduledTime, durationSeconds, velocity);
      return;
    }

    if (note.articulation === "slide" || note.articulation === "legato") {
      const voice = layer === "bass" ? (voiceIndex > 0 ? this.bassAccent : this.bass) : this.melodyLead;
      voice.triggerAttack(note.glideFrom ?? note.note, scheduledTime, velocity);
      voice.setNote(note.note, scheduledTime + Math.min(sixteenth * 0.55, durationSeconds * 0.4));
      voice.triggerRelease(scheduledTime + durationSeconds);
      return;
    }

    if (layer === "bass") {
      // Adjacent notes otherwise schedule the previous release at exactly the
      // next attack. Web Audio may process that release last and immediately
      // silence the new note, which made connected eighth-note lines collapse
      // into isolated downbeats.
      const collisionSafeDuration = Math.max(0.03, durationSeconds - 0.012);
      (voiceIndex > 0 ? this.bassAccent : this.bass).triggerAttackRelease(note.note, collisionSafeDuration, scheduledTime, velocity);
    }
    else this.melody.triggerAttackRelease(note.note, note.duration, scheduledTime, velocity);
  }

  private playReedNote(note: NoteEvent, voiceIndex: number, scheduledTime: number, durationSeconds: number, velocity: number): void {
    const voice = voiceIndex > 0 ? this.reedLeadAlt : this.reedLead;
    const isConnected = note.articulation === "slide" || note.articulation === "legato";
    if (!isConnected && durationSeconds >= Tone.Time("8n").toSeconds() * 0.9) {
      this.reedBreath.triggerAttackRelease("32n", scheduledTime, velocity * 0.24);
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

  private playGuitarNote(note: NoteEvent, scheduledTime: number, durationSeconds: number, velocity: number): void {
    const releaseAt = scheduledTime + durationSeconds;
    const isMuted = note.articulation === "muted";
    const isSlide = note.articulation === "slide" || note.articulation === "legato";
    this.guitarFretNoise.triggerAttackRelease(isSlide ? "16n" : "32n", scheduledTime, velocity * (isSlide ? 0.62 : 0.38));

    const stringPitch = note.glideFrom ?? note.note;
    this.guitarString.triggerAttack(stringPitch, scheduledTime);
    this.guitarString.triggerRelease(scheduledTime + Math.min(durationSeconds, isMuted ? 0.055 : 0.34));
    if (isMuted) return;

    if (isSlide) {
      this.guitarBody.triggerAttack(stringPitch, scheduledTime, velocity);
      // A real fret slide keeps the pick transient and reaches the destination
      // quickly; a long portamento is what made the previous triangle voice round.
      this.guitarBody.setNote(note.note, scheduledTime + Math.min(0.052, durationSeconds * 0.22));
      this.guitarBody.triggerRelease(releaseAt);
      return;
    }
    this.guitarBody.triggerAttackRelease(note.note, durationSeconds, scheduledTime, velocity * 0.72);
  }

  private scheduleMaterialHits(
    material: import("./domain/materialTypes").ProducedMaterial,
    schedule: (offset: number, play: (t: number) => void) => void,
    isCue: boolean,
  ): void {
    const content = material.content;
    if (content.kind === "melody" || content.kind === "bass") {
      const cueOrigin = isCue && content.notes.length
        ? Math.min(...content.notes.map((note) => (note.bar ?? 0) * 16 + note.step))
        : 0;
      for (const note of content.notes) {
        schedule((note.bar ?? 0) * 16 + note.step - cueOrigin, (t) => {
          if (isCue) {
            if (note.instrument === "guitar") {
              this.cueGuitar.triggerAttack(note.note, t);
              this.cueGuitar.triggerRelease(t + Tone.Time(note.duration ?? "8n").toSeconds());
            } else {
              const voice = note.instrument === "reed" ? this.cueReed : this.cueMelody;
              voice.triggerAttackRelease(note.note, note.duration ?? "8n", t, note.velocity ?? 0.6);
            }
            this.cueNoteCount += 1;
          }
        });
      }
    } else if (content.kind === "drums") {
      const cueOrigin = isCue && content.hits.length
        ? Math.min(...content.hits.map((hit) => hit.bar * 16 + hit.step))
        : 0;
      for (const hit of content.hits) {
        schedule(hit.bar * 16 + hit.step - cueOrigin, (t) => {
          if (hit.voice === "kick") this.cueKick.triggerAttackRelease("C2", "8n", t, hit.velocity);
          else this.cueHat.triggerAttackRelease("32n", t, hit.velocity * 0.5);
          this.cueNoteCount += 1;
        });
      }
    } else if (content.kind === "harmony") {
      const cueOrigin = isCue && content.chords.length
        ? Math.min(...content.chords.map((chord) => chord.bar * 16 + (chord.step ?? 0)))
        : 0;
      for (const chord of content.chords) {
        schedule(chord.bar * 16 + (chord.step ?? 0) - cueOrigin, (t) => {
          this.cueMelody.triggerAttackRelease(chord.notes[0] ?? "C4", chord.duration ?? "4n", t, chord.velocity ?? 0.5);
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
    [this.kick, this.snare, this.hat, this.bass, this.bassAccent, this.bassMute,
      this.harmony, this.melody, this.melodyLead, this.melodyMute,
      this.reedLead, this.reedLeadAlt, this.reedBreath, this.reedDrive, this.reedBody, this.reedPresence, this.reedVibrato, this.texture,
      this.guitarBody, this.guitarString, this.guitarFretNoise, this.guitarDrive, this.guitarPresence,
      this.grooveGain, this.harmonyGain, this.melodyGain, this.textureGain,
      this.delay, this.reverb, this.delaySend, this.reverbSend, this.masterFilter, this.masterCompressor, this.master, this.limiter, this.masterMeter,
      this.drumDrive, this.drumFilter, this.bassDrive, this.harmonyFilter, this.harmonyChorus,
      this.melodyFilter, this.melodyChorus, this.textureFilter,
      this.cueMelody, this.cueReed, this.cueGuitar, this.cueHat, this.cueKick, this.cueGain]
      .filter(Boolean).forEach((n) => n.dispose());
  }
}

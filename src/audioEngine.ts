import * as Tone from "tone";
import { BPM, TOTAL_BARS } from "./musicalConstants";
import { createIdleScene, IDLE_SCENE_ID, type SceneExecutionAuthority } from "./sceneExecution";
import {
  createMasterAudioGraph,
  prepareMasterAudioGraph,
  type MasterAudioGraph,
} from "./audio/masterAudioGraph";
import {
  applyMixAutomationEventToGraph,
  applyMixParamsToGraph,
  applySceneFxToGraph,
  resetMixToBaseline,
} from "./audio/mixApplication";
import { audioNow, clampAudioTime, rampLinear } from "./audio/audioParamScheduling";
import {
  configurePlaybackAudioContext,
  notePlayDeferSeconds,
  transportStartOffsetSeconds,
} from "./audio/browserAudioProfile";
import { indexMixAutomationByTick } from "./demo/mixAutomationSchedule";
import { playLayerOnGraph } from "./audio/voicePlayback";
import type { LayerId, MaterialRef, MixParams, SceneDefinition } from "./types";
import type { SessionMaterialBank } from "./domain/sessionMaterialBank";
import { resolveMaterial } from "./domain/sessionMaterialBank";
import type { MaterialResolutionEvidence, MissingMaterialDiagnostic } from "./domain/materialTypes";
import type { DemoAct } from "./domain/sessionTypes";
import { DEFAULT_SOUND_DESIGN, type MixAutomationEvent, type SoundDesignPreset } from "./domain/reconstructionPack";
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

export interface MixAutomationEvidence {
  id: string;
  at: string;
  act: DemoAct;
  appliedAtTransport: string;
  rampSeconds: number;
  patch: MixAutomationEvent["patch"];
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
  private sceneAtBar = new Map<number, SceneDefinition>();
  private mixAutomationByTick = new Map<number, MixAutomationEvent[]>();
  private mixDirtyAtCurrentTick = false;
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
  readonly mixAutomationLog: MixAutomationEvidence[] = [];

  private graph!: MasterAudioGraph;
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
  private drumBus!: Tone.Gain;
  private drumTrim!: Tone.Volume;
  private drumReverbSend!: Tone.Gain;
  private bassDrive!: Tone.Distortion;
  private bassTrim!: Tone.Volume;
  private harmonyFilter!: Tone.Filter;
  private harmonyChorus!: Tone.Gain;
  private melodyFilter!: Tone.Filter;
  private melodyChorus!: Tone.Gain;
  private textureFilter!: Tone.Filter;
  private kick!: Tone.MembraneSynth;
  private snare!: Tone.NoiseSynth;
  private hat!: Tone.NoiseSynth;
  private rim!: Tone.NoiseSynth;
  private tomLow!: Tone.MembraneSynth;
  private tomMid!: Tone.MembraneSynth;
  private tomHigh!: Tone.MembraneSynth;
  private crash!: Tone.NoiseSynth;
  private ride!: Tone.NoiseSynth;
  private bass!: Tone.MonoSynth;
  private bassAccent!: Tone.MonoSynth;
  private bassMute!: Tone.NoiseSynth;
  private harmony!: Tone.PolySynth;
  private harmonyComp!: Tone.PolySynth;
  private melody!: Tone.PolySynth;
  private melodyCounter!: Tone.PolySynth;
  private melodyLead!: Tone.MonoSynth;
  private melodyLeadAlt!: Tone.MonoSynth;
  private melodyMute!: Tone.NoiseSynth;
  private reedLead!: Tone.MonoSynth;
  private reedLeadAlt!: Tone.MonoSynth;
  private reedBreath!: Tone.NoiseSynth;
  private reedBreathAlt!: Tone.NoiseSynth;
  private reedDrive!: Tone.Distortion;
  private reedBody!: Tone.Filter;
  private reedPresence!: Tone.Filter;
  private guitarBody!: Tone.MonoSynth;
  private guitarString!: Tone.PluckSynth;
  private guitarFretNoise!: Tone.NoiseSynth;
  private guitarDrive!: Tone.Distortion;
  private guitarPresence!: Tone.Filter;
  private texture!: Tone.NoiseSynth;
  private cueMelody!: Tone.Synth;
  private cueReed!: Tone.MonoSynth;
  private cueGuitar!: Tone.PluckSynth;
  private cueHat!: Tone.NoiseSynth;
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

  setArrangementSceneBoundaries(scenes: readonly { startBar: number; scene: SceneDefinition }[]): void {
    this.sceneAtBar.clear();
    for (const { startBar, scene } of scenes) {
      this.sceneAtBar.set(startBar, scene);
    }
  }

  clearArrangementSceneBoundaries(): void {
    this.sceneAtBar.clear();
  }

  setPackMixAutomation(events: readonly MixAutomationEvent[] | undefined, act: DemoAct): void {
    this.mixAutomationByTick = indexMixAutomationByTick(events, act);
  }

  clearPackMixAutomation(): void {
    this.mixAutomationByTick.clear();
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
    // Larger render buffer must be requested before any node exists.
    configurePlaybackAudioContext();
    // Do not await Tone.start() here — browsers block AudioContext resume without
    // a user gesture. Shell playback paths call Tone.start() on the click gesture.

    const initMix = this.baselineMix ?? this.currentMix;
    this.graph = createMasterAudioGraph({
      soundDesign: this.soundDesign,
      baselineMix: initMix,
      destination: Tone.getDestination(),
    });
    await prepareMasterAudioGraph(this.graph);
    this.bindGraphFields();
    this.masterMeter = new Tone.Meter({ normalRange: false, smoothing: 0.8 });
    this.limiter.connect(this.masterMeter);

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
    this.cueHat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      volume: -22,
    });
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
      const tick = totalSixteenths;
      this.mixDirtyAtCurrentTick = false;
      let mixChangedThisTick = false;
      if (beat === 0 && sixteenth === 0) {
        const tempoChange = this.tempoMap.find((entry) => entry.bar === bar);
        if (tempoChange) {
          this.baseBpm = tempoChange.bpm;
          Tone.getTransport().bpm.setValueAtTime(this.baseBpm * this.tempoMultiplier, time);
        }
        this.callbacks.onBeforeBoundary?.(bar, time);
        const launchSceneId = this.launchAtBar.get(bar);
        if (launchSceneId) this.callbacks.onLaunchAtBar?.(bar, launchSceneId, time);
        const arrangementScene = this.sceneAtBar.get(bar);
        if (arrangementScene) {
          this.playingScene = arrangementScene;
          this.applySceneFx(arrangementScene, time, true);
          mixChangedThisTick = true;
        }
      }
      const automationEvents = this.mixAutomationByTick.get(tick);
      if (automationEvents?.length) {
        for (const event of automationEvents) {
          this.applyMixAutomationEvent(event, time);
        }
        mixChangedThisTick = true;
      }
      if (this.mixDirtyAtCurrentTick) mixChangedThisTick = true;
      const scene = this.currentAct === "livePerformance"
        ? (this.sceneAuthority?.playingScene ?? this.playingScene)
        : this.playingScene;

      const noteTime = mixChangedThisTick ? time + notePlayDeferSeconds() : time;
      this.playStep(scene, bar, step, noteTime);
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
    const ramp = time ?? audioNow() + 0.01;
    this.applySceneFx(scene, ramp, true);
  }

  setMixParams(params: Partial<MixParams>, rampTime = 0.18, atTime?: number): void {
    this.currentMix = applyMixParamsToGraph(this.graph, this.currentMix, params, rampTime, atTime);
  }

  applyMixAutomationEvent(event: MixAutomationEvent, atTime: number): void {
    this.mixDirtyAtCurrentTick = true;
    this.currentMix = applyMixAutomationEventToGraph(this.graph, this.currentMix, event, atTime);
    this.mixAutomationLog.push({
      id: event.id,
      at: event.at,
      act: this.currentAct,
      appliedAtTransport: Tone.getTransport().position.toString(),
      rampSeconds: event.rampSeconds,
      patch: structuredClone(event.patch),
    });
  }

  clearMixAutomationLog(): void {
    this.mixAutomationLog.length = 0;
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
    rampLinear(this.cueGain.volume, -8, audioNow(), 0.001);

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
    const time = at ?? audioNow();
    const stoppedAt = atTransportPosition ?? parseTransportPosition(transport.position.toString());
    const transportStartedByCue = this.cueOwnsTransport;

    this.cueScheduleIds.forEach((id) => transport.clear(id));
    this.cueScheduleIds = [];
    if (this.cueStopScheduleId !== null) {
      transport.clear(this.cueStopScheduleId);
      this.cueStopScheduleId = null;
    }
    this.cueMelody.triggerRelease(time);
    rampLinear(this.cueGain.volume, -60, clampAudioTime(time), 0.08);

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
    resetMixToBaseline(this.graph, mix, this.soundDesign, audioNow() + 0.01);
  }

  start(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = "0:0:0";
    this.transportSixteenthCounter = 0;
    this.playbackGeneration += 1;
    this.lastBar = -1;
    this.masterStepCount = 0;
    this.clearMixAutomationLog();
    this.resetPrivateCue();
    if (this.initialized) {
      const fadeAt = audioNow();
      rampLinear(this.graph.outputFade.gain, 0, fadeAt, 0.02);
      rampLinear(
        this.graph.outputFade.gain,
        1,
        fadeAt + 0.025,
        0.08,
      );
    }
    transport.start(transportStartOffsetSeconds());
  }

  pause(): void { Tone.getTransport().pause(); }
  resume(): void {
    void Tone.start().then(() => {
      if (Tone.getContext().state === "running") {
        Tone.getTransport().start(transportStartOffsetSeconds());
      }
    });
  }

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
    this.mixDirtyAtCurrentTick = true;
    this.currentMix = applySceneFxToGraph(this.graph, this.soundDesign, scene, startTime, includeFaders);
  }

  private playStep(scene: SceneDefinition, bar: number, step: number, time: number): void {
    if (!this.materialBank) return;
    const localBar = Math.max(0, bar - scene.startBar);
    for (const layer of ["drums", "bass", "harmony", "melody", "texture"] as const) {
      this.playLayer(scene, layer, scene.layers[layer], localBar, step, time, 0);
      for (const [index, ref] of (scene.layerStacks?.[layer] ?? []).entries()) {
        this.playLayer(scene, layer, ref, localBar, step, time, index + 1);
      }
    }
  }

  private playLayer(
    scene: SceneDefinition,
    layer: LayerId,
    ref: MaterialRef | null,
    localBar: number,
    globalStep: number,
    time: number,
    voiceIndex: number,
  ): void {
    if (!ref || !this.materialBank) {
      if (ref) this.emitMissing(this.currentAct === "canonicalPlayback" ? "canonical" : "live", scene.id, layer, ref);
      return;
    }
    const material = resolveMaterial(this.materialBank, ref);
    if (!material) {
      this.emitMissing(this.currentAct === "canonicalPlayback" ? "canonical" : "live", scene.id, layer, ref);
      return;
    }
    this.logResolution(this.currentAct === "canonicalPlayback" ? "canonical" : "live", scene.id, layer, ref);
    playLayerOnGraph(this.graph, this.materialBank, scene, layer, ref, localBar, globalStep, time, voiceIndex);
  }

  private bindGraphFields(): void {
    ({
      master: this.master,
      limiter: this.limiter,
      masterFilter: this.masterFilter,
      masterCompressor: this.masterCompressor,
      delay: this.delay,
      reverb: this.reverb,
      delaySend: this.delaySend,
      reverbSend: this.reverbSend,
      grooveGain: this.grooveGain,
      harmonyGain: this.harmonyGain,
      melodyGain: this.melodyGain,
      textureGain: this.textureGain,
      drumDrive: this.drumDrive,
      drumFilter: this.drumFilter,
      drumBus: this.drumBus,
      drumTrim: this.drumTrim,
      drumReverbSend: this.drumReverbSend,
      bassDrive: this.bassDrive,
      bassTrim: this.bassTrim,
      harmonyFilter: this.harmonyFilter,
      harmonyChorus: this.harmonyChorus,
      melodyFilter: this.melodyFilter,
      melodyChorus: this.melodyChorus,
      textureFilter: this.textureFilter,
      kick: this.kick,
      snare: this.snare,
      hat: this.hat,
      rim: this.rim,
      tomLow: this.tomLow,
      tomMid: this.tomMid,
      tomHigh: this.tomHigh,
      crash: this.crash,
      ride: this.ride,
      bass: this.bass,
      bassAccent: this.bassAccent,
      bassMute: this.bassMute,
      harmony: this.harmony,
      harmonyComp: this.harmonyComp,
      melody: this.melody,
      melodyCounter: this.melodyCounter,
      melodyLead: this.melodyLead,
      melodyLeadAlt: this.melodyLeadAlt,
      melodyMute: this.melodyMute,
      reedLead: this.reedLead,
      reedLeadAlt: this.reedLeadAlt,
      reedBreath: this.reedBreath,
      reedBreathAlt: this.reedBreathAlt,
      reedDrive: this.reedDrive,
      reedBody: this.reedBody,
      reedPresence: this.reedPresence,
      guitarBody: this.guitarBody,
      guitarString: this.guitarString,
      guitarFretNoise: this.guitarFretNoise,
      guitarDrive: this.guitarDrive,
      guitarPresence: this.guitarPresence,
      texture: this.texture,
    } = this.graph);
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
              const voice = note.instrument === "reed"
                || note.instrument === "reed-alto"
                || note.instrument === "reed-tenor"
                ? this.cueReed
                : this.cueMelody;
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
    [this.kick, this.snare, this.hat, this.rim, this.tomLow, this.tomMid, this.tomHigh, this.crash, this.ride,
      this.bass, this.bassAccent, this.bassMute,
      this.harmony, this.harmonyComp, this.melody, this.melodyCounter, this.melodyLead, this.melodyLeadAlt, this.melodyMute,
      this.reedLead, this.reedLeadAlt, this.reedBreath, this.reedBreathAlt, this.reedDrive, this.reedBody, this.reedPresence, this.texture,
      this.guitarBody, this.guitarString, this.guitarFretNoise, this.guitarDrive, this.guitarPresence,
      this.grooveGain, this.harmonyGain, this.melodyGain, this.textureGain,
      this.delay, this.reverb, this.delaySend, this.reverbSend, this.drumBus, this.drumTrim, this.drumReverbSend,
      this.masterFilter, this.masterCompressor, this.master, this.limiter, this.masterMeter,
      this.drumDrive, this.drumFilter, this.bassDrive, this.bassTrim, this.harmonyFilter, this.harmonyChorus,
      this.melodyFilter, this.melodyChorus, this.textureFilter,
      this.cueMelody, this.cueReed, this.cueGuitar, this.cueHat, this.cueKick, this.cueGain]
      .filter(Boolean).forEach((n) => n.dispose());
  }
}

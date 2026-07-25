import * as Tone from "tone";
import { delayUiToWet, faderUiToDb, filterUiToHz } from "../mixMapping";
import type { DeskBusId, MixParams } from "../types";
import {
  resolveMixDrumDefaults,
  resolveMixSubgroupTrims,
  resolveReedSoundDesign,
  type SoundDesignPreset,
} from "../domain/reconstructionPack";
import { reverbDecaySeconds } from "./browserAudioProfile";

export interface MasterAudioGraph {
  master: Tone.Volume;
  outputFade: Tone.Gain;
  limiter: Tone.Limiter;
  masterFilter: Tone.Filter;
  masterCompressor: Tone.Compressor;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  delaySend: Tone.Gain;
  reverbSend: Tone.Gain;
  grooveGain: Tone.Volume;
  harmonyGain: Tone.Volume;
  melodyGain: Tone.Volume;
  textureGain: Tone.Volume;
  drumDrive: Tone.Distortion;
  drumFilter: Tone.Filter;
  drumBus: Tone.Gain;
  drumTrim: Tone.Volume;
  drumReverbSend: Tone.Gain;
  bassDrive: Tone.Distortion;
  bassTrim: Tone.Volume;
  harmonyFilter: Tone.Filter;
  harmonyChorus: Tone.Gain;
  melodyFilter: Tone.Filter;
  melodyChorus: Tone.Gain;
  textureFilter: Tone.Filter;
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hat: Tone.NoiseSynth;
  rim: Tone.NoiseSynth;
  tomLow: Tone.MembraneSynth;
  tomMid: Tone.MembraneSynth;
  tomHigh: Tone.MembraneSynth;
  crash: Tone.NoiseSynth;
  ride: Tone.NoiseSynth;
  bass: Tone.MonoSynth;
  bassAccent: Tone.MonoSynth;
  bassMute: Tone.NoiseSynth;
  harmony: Tone.PolySynth;
  harmonyComp: Tone.PolySynth;
  melody: Tone.PolySynth;
  melodyCounter: Tone.PolySynth;
  melodyLead: Tone.MonoSynth;
  melodyLeadAlt: Tone.MonoSynth;
  melodyMute: Tone.NoiseSynth;
  reedLead: Tone.MonoSynth;
  reedLeadAlt: Tone.MonoSynth;
  reedBreath: Tone.NoiseSynth;
  reedBreathAlt: Tone.NoiseSynth;
  reedDrive: Tone.Distortion;
  reedBody: Tone.Filter;
  reedPresence: Tone.Filter;
  guitarBody: Tone.MonoSynth;
  guitarString: Tone.PluckSynth;
  guitarFretNoise: Tone.NoiseSynth;
  guitarDrive: Tone.Distortion;
  guitarPresence: Tone.Filter;
  texture: Tone.NoiseSynth;
  rhythmDeskGain: Tone.Volume;
  rhythmDeskFilter: Tone.Filter;
  rhythmDeskDelaySend: Tone.Gain;
  rhythmDeskReverbSend: Tone.Gain;
  keysDeskGain: Tone.Volume;
  keysDeskFilter: Tone.Filter;
  keysDeskDelaySend: Tone.Gain;
  keysDeskReverbSend: Tone.Gain;
  hornsDeskGain: Tone.Volume;
  hornsDeskFilter: Tone.Filter;
  hornsDeskDelaySend: Tone.Gain;
  hornsDeskReverbSend: Tone.Gain;
  guitarDeskGain: Tone.Volume;
  guitarDeskFilter: Tone.Filter;
  guitarDeskDelaySend: Tone.Gain;
  guitarDeskReverbSend: Tone.Gain;
}

export interface MasterAudioGraphOptions {
  soundDesign: SoundDesignPreset;
  baselineMix: MixParams;
  destination: Tone.InputNode;
}

interface CymbalOptions {
  envelope: { attack: number; decay: number; release: number };
  volume: number;
}

function createCymbalSynth(
  options: CymbalOptions,
  noiseType: "white" | "pink",
): Tone.NoiseSynth {
  return new Tone.NoiseSynth({
    noise: { type: noiseType },
    envelope: { ...options.envelope, sustain: 0 },
    volume: options.volume,
  });
}

function deskDefaults(deskId: DeskBusId, mix: MixParams): {
  gainDb: number;
  mute: boolean;
  filterHz: number;
  delaySend: number;
  reverbSend: number;
} {
  const desk = mix.desk?.[deskId];
  const defaults: Record<DeskBusId, { delaySend: number; reverbSend: number }> = {
    rhythm: { delaySend: 0, reverbSend: 0.05 },
    keys: { delaySend: 0.15, reverbSend: 0.2 },
    horns: { delaySend: 0.45, reverbSend: 0.25 },
    guitar: { delaySend: 0.3, reverbSend: 0.1 },
  };
  return {
    gainDb: desk?.gainDb ?? 0,
    mute: desk?.mute ?? false,
    filterHz: desk?.filterHz ?? 12_000,
    delaySend: desk?.delaySend ?? defaults[deskId].delaySend,
    reverbSend: desk?.reverbSend ?? defaults[deskId].reverbSend,
  };
}

export function createMasterAudioGraph(options: MasterAudioGraphOptions): MasterAudioGraph {
  const { soundDesign: sound, baselineMix: initMix, destination } = options;
  const drumDefaults = resolveMixDrumDefaults(initMix, sound);
  const subgroupTrims = resolveMixSubgroupTrims(initMix);
  const reed = resolveReedSoundDesign(sound);

  const master = new Tone.Volume(initMix.masterGain);
  const outputFade = new Tone.Gain(0);
  const limiter = new Tone.Limiter(-1);
  const masterCompressor = new Tone.Compressor({
    threshold: sound.master.compressorThreshold,
    ratio: sound.master.compressorRatio,
    attack: 0.03,
    release: 0.22,
  });
  const masterFilter = new Tone.Filter({
    frequency: filterUiToHz(initMix.filter),
    type: "lowpass",
    rolloff: sound.master.filterRolloff,
  });
  const delay = new Tone.FeedbackDelay({
    delayTime: sound.master.delayTime,
    feedback: sound.master.delayFeedback,
    wet: 1,
  });
  const reverb = new Tone.Reverb({
    decay: reverbDecaySeconds(sound.master.reverbDecay),
    preDelay: sound.master.reverbPreDelay,
    wet: 1,
  });
  const delaySend = new Tone.Gain(delayUiToWet(initMix.delayWet));
  const reverbSend = new Tone.Gain(initMix.reverbWet);
  const grooveGain = new Tone.Volume(faderUiToDb(initMix.faders.groove));
  const harmonyGain = new Tone.Volume(faderUiToDb(initMix.faders.harmony));
  const melodyGain = new Tone.Volume(faderUiToDb(initMix.faders.melody));
  const textureGain = new Tone.Volume(faderUiToDb(initMix.faders.texture));

  const drumDrive = new Tone.Distortion({ distortion: sound.drums.drive, wet: sound.drums.drive > 0 ? 1 : 0 });
  const drumFilter = new Tone.Filter({ frequency: drumDefaults.drumFilter, type: "lowpass", rolloff: -24 });
  const drumBus = new Tone.Gain(1);
  const drumTrim = new Tone.Volume(subgroupTrims.drumTrimDb);
  const drumReverbSend = new Tone.Gain(drumDefaults.drumReverbWet);
  const bassDrive = new Tone.Distortion({ distortion: sound.bass.drive, wet: sound.bass.drive > 0 ? 1 : 0 });
  const bassTrim = new Tone.Volume(subgroupTrims.bassTrimDb);
  const harmonyFilter = new Tone.Filter({ frequency: sound.harmony.filterFrequency, type: "lowpass", rolloff: -24 });
  const harmonyChorus = new Tone.Gain(1);
  const melodyFilter = new Tone.Filter({ frequency: sound.melody.filterFrequency, type: "lowpass", rolloff: -24 });
  const melodyChorus = new Tone.Gain(1);
  const textureFilter = new Tone.Filter({ frequency: sound.texture.filterFrequency, type: "lowpass", rolloff: -24 });

  master.chain(masterFilter, masterCompressor, limiter, outputFade, destination);
  delaySend.chain(delay, master);
  reverbSend.chain(reverb, master);

  const kick = new Tone.MembraneSynth({
    pitchDecay: sound.drums.kickPitchDecay,
    octaves: sound.drums.kickOctaves,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: sound.drums.kickDecay, sustain: 0, release: 0.08 },
  });
  const snare = new Tone.NoiseSynth({
    noise: { type: sound.drums.snareNoise },
    envelope: { attack: 0.002, decay: sound.drums.snareDecay, sustain: 0, release: 0.05 },
  });
  const hat = createCymbalSynth({
    envelope: { attack: 0.001, decay: sound.drums.hatDecay, release: 0.01 },
    volume: -18,
  }, "white");
  const rim = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.015 },
    volume: -14,
  });
  const tomOptions = {
    pitchDecay: 0.025,
    octaves: 1.4,
    oscillator: { type: "sine" as const },
    envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.08 },
    volume: -7,
  };
  const tomLow = new Tone.MembraneSynth(tomOptions);
  const tomMid = new Tone.MembraneSynth(tomOptions);
  const tomHigh = new Tone.MembraneSynth(tomOptions);
  const cymbalOptions = {
    envelope: { attack: 0.001, decay: 0.42, release: 0.08 },
    volume: -22,
  };
  const crash = createCymbalSynth(cymbalOptions, "pink");
  const ride = createCymbalSynth({
    ...cymbalOptions,
    envelope: { attack: 0.001, decay: 0.2, release: 0.04 },
    volume: -24,
  }, "white");
  const bass = new Tone.MonoSynth({
    oscillator: { type: sound.bass.oscillator },
    filter: { Q: sound.bass.filterQ, type: "lowpass", rolloff: -24 },
    envelope: sound.bass.envelope,
    filterEnvelope: {
      attack: 0.005,
      decay: 0.18,
      sustain: 0.2,
      release: 0.25,
      baseFrequency: sound.bass.filterBaseFrequency,
      octaves: sound.bass.filterOctaves,
    },
    volume: sound.bass.volume,
  });
  const bassAccent = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    filter: { Q: 1, type: "lowpass", rolloff: -24 },
    envelope: {
      ...sound.bass.envelope,
      sustain: Math.min(0.35, sound.bass.envelope.sustain),
      release: Math.min(0.16, sound.bass.envelope.release),
    },
    filterEnvelope: {
      attack: 0.003,
      decay: 0.1,
      sustain: 0.1,
      release: 0.14,
      baseFrequency: sound.bass.filterBaseFrequency * 1.8,
      octaves: 1,
    },
    volume: sound.bass.volume - 5,
  });
  const bassMute = new Tone.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.015 },
    volume: -27,
  });
  const harmony = sound.harmony.generator === "fm"
    ? new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.5,
      modulationIndex: 1.2,
      oscillator: { type: sound.harmony.oscillator },
      envelope: sound.harmony.envelope,
      modulationEnvelope: { attack: 0.002, decay: 0.08, sustain: 0.05, release: 0.15 },
      volume: sound.harmony.volume,
    })
    : new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: sound.harmony.oscillator },
      envelope: sound.harmony.envelope,
      volume: sound.harmony.volume,
    });
  const harmonyComp = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.004, decay: 0.11, sustain: 0.16, release: 0.2 },
    volume: sound.harmony.volume - 4,
  });
  const melody = sound.melody.generator === "fm"
    ? new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.5,
      oscillator: { type: sound.melody.oscillator },
      envelope: sound.melody.envelope,
      modulationEnvelope: { attack: 0.005, decay: 0.12, sustain: 0.08, release: 0.2 },
      volume: sound.melody.volume,
    })
    : new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: sound.melody.oscillator },
      envelope: sound.melody.envelope,
      volume: sound.melody.volume,
    });
  const melodyCounter = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.012, decay: 0.16, sustain: 0.18, release: 0.26 },
    volume: sound.melody.volume - 5,
  });
  const melodyLead = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    portamento: 0.055,
    filter: { Q: 1.5, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.004, decay: 0.12, sustain: 0.28, release: 0.16 },
    filterEnvelope: { attack: 0.003, decay: 0.1, sustain: 0.16, release: 0.15, baseFrequency: 260, octaves: 3.4 },
    volume: sound.melody.volume - 2,
  });
  const melodyLeadAlt = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    portamento: 0.045,
    filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.006, decay: 0.11, sustain: 0.22, release: 0.15 },
    filterEnvelope: { attack: 0.004, decay: 0.1, sustain: 0.14, release: 0.14, baseFrequency: 320, octaves: 3 },
    volume: sound.melody.volume - 6,
  });
  const melodyMute = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.012 },
    volume: -30,
  });
  const reedLead = new Tone.MonoSynth({
    oscillator: { type: "fattriangle", count: 2, spread: 2 },
    portamento: 0.045,
    filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
    envelope: { attack: reed.attack, decay: 0.11, sustain: 0.68, release: reed.release },
    filterEnvelope: { attack: 0.012, decay: 0.14, sustain: 0.52, release: 0.17, baseFrequency: 360, octaves: 3.45 },
    volume: sound.melody.volume - 0.5,
  });
  const reedLeadAlt = new Tone.MonoSynth({
    oscillator: { type: "fattriangle", count: 2, spread: 2 },
    portamento: 0.04,
    filter: { Q: 1.05, type: "lowpass", rolloff: -24 },
    envelope: { attack: reed.altAttack, decay: 0.1, sustain: 0.64, release: reed.altRelease },
    filterEnvelope: { attack: 0.01, decay: 0.13, sustain: 0.5, release: 0.16, baseFrequency: 390, octaves: 3.3 },
    volume: sound.melody.volume - 2.5,
  });
  const reedBreath = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.004, decay: 0.045, sustain: 0, release: 0.02 },
    volume: reed.breathVolume,
  });
  const reedBreathAlt = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.004, decay: 0.04, sustain: 0, release: 0.02 },
    volume: reed.altBreathVolume,
  });
  const reedDrive = new Tone.Distortion({ distortion: reed.drive, wet: reed.drive > 0 ? 0.24 : 0 });
  const reedBody = new Tone.Filter({ type: "peaking", frequency: 690, Q: 0.72, gain: reed.bodyGain });
  const reedPresence = new Tone.Filter({ type: "peaking", frequency: 1850, Q: 0.95, gain: reed.presenceGain });
  const guitarBody = new Tone.MonoSynth({
    oscillator: { type: "fattriangle", count: 2, spread: 3 },
    portamento: 0,
    filter: { Q: 1.7, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.002, decay: 0.16, sustain: 0.3, release: 0.19 },
    filterEnvelope: { attack: 0.001, decay: 0.11, sustain: 0.18, release: 0.16, baseFrequency: 520, octaves: 3.15 },
    volume: sound.melody.volume - 0.25,
  });
  const guitarString = new Tone.PluckSynth({
    attackNoise: 0.72,
    dampening: 4300,
    resonance: 0.82,
    release: 0.22,
    volume: sound.melody.volume - 8,
  });
  const guitarFretNoise = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.026, sustain: 0, release: 0.012 },
    volume: -25,
  });
  const guitarDrive = new Tone.Distortion({ distortion: 0.17, wet: 0.52 });
  const guitarPresence = new Tone.Filter({ type: "peaking", frequency: 1480, Q: 1.2, gain: 5.4 });
  const texture = new Tone.NoiseSynth({
    noise: { type: sound.texture.noise },
    envelope: sound.texture.envelope,
    volume: sound.texture.volume,
  });

  const rhythmDesk = deskDefaults("rhythm", initMix);
  const keysDesk = deskDefaults("keys", initMix);
  const hornsDesk = deskDefaults("horns", initMix);
  const guitarDesk = deskDefaults("guitar", initMix);

  const rhythmDeskGain = new Tone.Volume(rhythmDesk.mute ? -100 : rhythmDesk.gainDb);
  const rhythmDeskFilter = new Tone.Filter({ frequency: rhythmDesk.filterHz, type: "lowpass", rolloff: -24 });
  const rhythmDeskDelaySend = new Tone.Gain(rhythmDesk.delaySend);
  const rhythmDeskReverbSend = new Tone.Gain(rhythmDesk.reverbSend);
  const keysDeskGain = new Tone.Volume(keysDesk.mute ? -100 : keysDesk.gainDb);
  const keysDeskFilter = new Tone.Filter({ frequency: keysDesk.filterHz, type: "lowpass", rolloff: -24 });
  const keysDeskDelaySend = new Tone.Gain(keysDesk.delaySend);
  const keysDeskReverbSend = new Tone.Gain(keysDesk.reverbSend);
  const hornsDeskGain = new Tone.Volume(hornsDesk.mute ? -100 : hornsDesk.gainDb);
  const hornsDeskFilter = new Tone.Filter({ frequency: hornsDesk.filterHz, type: "lowpass", rolloff: -24 });
  const hornsDeskDelaySend = new Tone.Gain(hornsDesk.delaySend);
  const hornsDeskReverbSend = new Tone.Gain(hornsDesk.reverbSend);
  const guitarDeskGain = new Tone.Volume(guitarDesk.mute ? -100 : guitarDesk.gainDb);
  const guitarDeskFilter = new Tone.Filter({ frequency: guitarDesk.filterHz, type: "lowpass", rolloff: -24 });
  const guitarDeskDelaySend = new Tone.Gain(guitarDesk.delaySend);
  const guitarDeskReverbSend = new Tone.Gain(guitarDesk.reverbSend);

  kick.connect(drumDrive);
  snare.connect(drumDrive);
  hat.connect(drumDrive);
  rim.connect(drumDrive);
  tomLow.connect(drumDrive);
  tomMid.connect(drumDrive);
  tomHigh.connect(drumDrive);
  crash.connect(drumDrive);
  ride.connect(drumDrive);
  drumDrive.chain(drumFilter, drumBus);
  drumBus.connect(drumReverbSend);
  drumBus.connect(drumTrim);
  drumReverbSend.chain(reverb, master);
  bass.chain(bassDrive, bassTrim);
  bassAccent.connect(bassDrive);
  bassMute.connect(bassDrive);
  drumTrim.connect(rhythmDeskFilter);
  bassTrim.connect(rhythmDeskFilter);
  rhythmDeskFilter.chain(rhythmDeskGain, grooveGain);
  rhythmDeskGain.connect(rhythmDeskDelaySend);
  rhythmDeskGain.connect(rhythmDeskReverbSend);
  rhythmDeskDelaySend.chain(delay, master);
  rhythmDeskReverbSend.chain(reverb, master);
  grooveGain.connect(master);
  harmony.chain(harmonyFilter, harmonyChorus, keysDeskFilter);
  harmonyComp.connect(harmonyFilter);
  keysDeskFilter.chain(keysDeskGain, harmonyGain);
  keysDeskGain.connect(keysDeskDelaySend);
  keysDeskGain.connect(keysDeskReverbSend);
  keysDeskDelaySend.chain(delay, master);
  keysDeskReverbSend.chain(reverb, master);
  harmonyGain.connect(master);
  harmonyGain.connect(reverbSend);
  melody.chain(melodyFilter, melodyChorus, melodyGain);
  melodyCounter.connect(melodyFilter);
  melodyLead.connect(melodyFilter);
  melodyLeadAlt.connect(melodyFilter);
  melodyMute.connect(melodyFilter);
  reedLead.chain(reedDrive, reedBody, reedPresence, hornsDeskFilter);
  reedLeadAlt.connect(reedDrive);
  reedBreath.connect(reedBody);
  reedBreathAlt.connect(reedBody);
  hornsDeskFilter.chain(hornsDeskGain, melodyFilter);
  hornsDeskGain.connect(hornsDeskDelaySend);
  hornsDeskGain.connect(hornsDeskReverbSend);
  hornsDeskDelaySend.chain(delay, master);
  hornsDeskReverbSend.chain(reverb, master);
  guitarBody.chain(guitarDrive, guitarPresence, guitarDeskFilter);
  guitarString.connect(guitarPresence);
  guitarFretNoise.connect(guitarPresence);
  guitarDeskFilter.chain(guitarDeskGain, melodyFilter);
  guitarDeskGain.connect(guitarDeskDelaySend);
  guitarDeskGain.connect(guitarDeskReverbSend);
  guitarDeskDelaySend.chain(delay, master);
  guitarDeskReverbSend.chain(reverb, master);
  melodyGain.connect(master);
  melodyGain.connect(delaySend);
  melodyGain.connect(reverbSend);
  texture.chain(textureFilter, textureGain);
  textureGain.connect(master);
  textureGain.connect(reverbSend);

  return {
    master,
    outputFade,
    limiter,
    masterFilter,
    masterCompressor,
    delay,
    reverb,
    delaySend,
    reverbSend,
    grooveGain,
    harmonyGain,
    melodyGain,
    textureGain,
    drumDrive,
    drumFilter,
    drumBus,
    drumTrim,
    drumReverbSend,
    bassDrive,
    bassTrim,
    harmonyFilter,
    harmonyChorus,
    melodyFilter,
    melodyChorus,
    textureFilter,
    kick,
    snare,
    hat,
    rim,
    tomLow,
    tomMid,
    tomHigh,
    crash,
    ride,
    bass,
    bassAccent,
    bassMute,
    harmony,
    harmonyComp,
    melody,
    melodyCounter,
    melodyLead,
    melodyLeadAlt,
    melodyMute,
    reedLead,
    reedLeadAlt,
    reedBreath,
    reedBreathAlt,
    reedDrive,
    reedBody,
    reedPresence,
    guitarBody,
    guitarString,
    guitarFretNoise,
    guitarDrive,
    guitarPresence,
    texture,
    rhythmDeskGain,
    rhythmDeskFilter,
    rhythmDeskDelaySend,
    rhythmDeskReverbSend,
    keysDeskGain,
    keysDeskFilter,
    keysDeskDelaySend,
    keysDeskReverbSend,
    hornsDeskGain,
    hornsDeskFilter,
    hornsDeskDelaySend,
    hornsDeskReverbSend,
    guitarDeskGain,
    guitarDeskFilter,
    guitarDeskDelaySend,
    guitarDeskReverbSend,
  };
}

export function disposeMasterAudioGraph(graph: MasterAudioGraph): void {
  [
    graph.kick, graph.snare, graph.hat, graph.rim, graph.tomLow, graph.tomMid, graph.tomHigh, graph.crash, graph.ride,
    graph.bass, graph.bassAccent, graph.bassMute,
    graph.harmony, graph.melody, graph.melodyLead, graph.melodyMute,
    graph.reedLead, graph.reedLeadAlt, graph.reedBreath, graph.reedBreathAlt, graph.reedDrive, graph.reedBody,
    graph.reedPresence, graph.texture,
    graph.guitarBody, graph.guitarString, graph.guitarFretNoise, graph.guitarDrive, graph.guitarPresence,
    graph.grooveGain, graph.harmonyGain, graph.melodyGain, graph.textureGain,
    graph.delay, graph.reverb, graph.delaySend, graph.reverbSend, graph.drumBus, graph.drumTrim, graph.drumReverbSend,
    graph.masterFilter, graph.masterCompressor, graph.master, graph.limiter, graph.outputFade,
    graph.drumDrive, graph.drumFilter, graph.bassDrive, graph.bassTrim, graph.harmonyFilter, graph.harmonyChorus,
    graph.melodyFilter, graph.melodyChorus, graph.textureFilter,
    graph.rhythmDeskGain, graph.rhythmDeskFilter, graph.rhythmDeskDelaySend, graph.rhythmDeskReverbSend,
    graph.keysDeskGain, graph.keysDeskFilter, graph.keysDeskDelaySend, graph.keysDeskReverbSend,
    graph.hornsDeskGain, graph.hornsDeskFilter, graph.hornsDeskDelaySend, graph.hornsDeskReverbSend,
    graph.guitarDeskGain, graph.guitarDeskFilter, graph.guitarDeskDelaySend, graph.guitarDeskReverbSend,
  ].forEach((node) => node.dispose());
}

/** Tone.Reverb requires a generated impulse before first use; skipping this causes clicks on Safari. */
export async function prepareMasterAudioGraph(graph: MasterAudioGraph): Promise<void> {
  await graph.reverb.generate();
}

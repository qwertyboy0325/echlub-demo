import * as Tone from "tone";
import { delayUiToWet, faderUiToDb } from "../mixMapping";
import type { MixParams } from "../types";
import {
  resolveMixDrumDefaults,
  resolveMixSubgroupTrims,
  resolveReedSoundDesign,
  type SoundDesignPreset,
} from "../domain/reconstructionPack";

export interface MasterAudioGraph {
  master: Tone.Volume;
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
  harmonyChorus: Tone.Chorus;
  melodyFilter: Tone.Filter;
  melodyChorus: Tone.Chorus;
  textureFilter: Tone.Filter;
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hat: Tone.MetalSynth;
  rim: Tone.NoiseSynth;
  tomLow: Tone.MembraneSynth;
  tomMid: Tone.MembraneSynth;
  tomHigh: Tone.MembraneSynth;
  crash: Tone.MetalSynth;
  ride: Tone.MetalSynth;
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
  reedVibrato: Tone.LFO;
  guitarBody: Tone.MonoSynth;
  guitarString: Tone.PluckSynth;
  guitarFretNoise: Tone.NoiseSynth;
  guitarDrive: Tone.Distortion;
  guitarPresence: Tone.Filter;
  texture: Tone.NoiseSynth;
}

export interface MasterAudioGraphOptions {
  soundDesign: SoundDesignPreset;
  baselineMix: MixParams;
  destination: Tone.InputNode;
}

export function createMasterAudioGraph(options: MasterAudioGraphOptions): MasterAudioGraph {
  const { soundDesign: sound, baselineMix: initMix, destination } = options;
  const drumDefaults = resolveMixDrumDefaults(initMix, sound);
  const subgroupTrims = resolveMixSubgroupTrims(initMix);
  const reed = resolveReedSoundDesign(sound);

  const master = new Tone.Volume(initMix.masterGain);
  const limiter = new Tone.Limiter(-1);
  const masterCompressor = new Tone.Compressor({
    threshold: sound.master.compressorThreshold,
    ratio: sound.master.compressorRatio,
    attack: 0.03,
    release: 0.22,
  });
  const masterFilter = new Tone.Filter({
    frequency: initMix.filter,
    type: "lowpass",
    rolloff: sound.master.filterRolloff,
  });
  const delay = new Tone.FeedbackDelay({
    delayTime: sound.master.delayTime,
    feedback: sound.master.delayFeedback,
    wet: 1,
  });
  const reverb = new Tone.Reverb({
    decay: sound.master.reverbDecay,
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
  const harmonyChorus = new Tone.Chorus({
    frequency: sound.harmony.chorusFrequency,
    delayTime: 3.5,
    depth: sound.harmony.chorusDepth,
    wet: sound.harmony.chorusWet,
  }).start();
  const melodyFilter = new Tone.Filter({ frequency: sound.melody.filterFrequency, type: "lowpass", rolloff: -24 });
  const melodyChorus = new Tone.Chorus({
    frequency: sound.melody.chorusFrequency,
    delayTime: 2.8,
    depth: sound.melody.chorusDepth,
    wet: sound.melody.chorusWet,
  }).start();
  const textureFilter = new Tone.Filter({ frequency: sound.texture.filterFrequency, type: "lowpass", rolloff: -24 });

  master.chain(masterFilter, masterCompressor, limiter, destination);
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
  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: sound.drums.hatDecay, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: sound.drums.hatResonance,
    octaves: 1.5,
    volume: -18,
  } as Tone.MetalSynthOptions);
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
    harmonicity: 5.1,
    modulationIndex: 18,
    resonance: 5200,
    octaves: 1.8,
    volume: -22,
  } as Tone.MetalSynthOptions;
  const crash = new Tone.MetalSynth(cymbalOptions);
  const ride = new Tone.MetalSynth({
    ...cymbalOptions,
    envelope: { attack: 0.001, decay: 0.2, release: 0.04 },
    resonance: 6800,
    volume: -24,
  } as Tone.MetalSynthOptions);
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
  const reedVibrato = new Tone.LFO({ frequency: 5.05, min: -3, max: 3 }).start();
  reedVibrato.connect(reedLead.detune);
  reedVibrato.connect(reedLeadAlt.detune);
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
  drumTrim.connect(grooveGain);
  drumReverbSend.chain(reverb, master);
  bass.chain(bassDrive, bassTrim);
  bassAccent.connect(bassDrive);
  bassMute.connect(bassDrive);
  bassTrim.connect(grooveGain);
  grooveGain.connect(master);
  harmony.chain(harmonyFilter, harmonyChorus, harmonyGain);
  harmonyComp.connect(harmonyFilter);
  harmonyGain.connect(master);
  harmonyGain.connect(reverbSend);
  melody.chain(melodyFilter, melodyChorus, melodyGain);
  melodyCounter.connect(melodyFilter);
  melodyLead.connect(melodyFilter);
  melodyLeadAlt.connect(melodyFilter);
  melodyMute.connect(melodyFilter);
  reedLead.chain(reedDrive, reedBody, reedPresence, melodyFilter);
  reedLeadAlt.connect(reedDrive);
  reedBreath.connect(reedBody);
  reedBreathAlt.connect(reedBody);
  guitarBody.chain(guitarDrive, guitarPresence, melodyFilter);
  guitarString.connect(guitarPresence);
  guitarFretNoise.connect(guitarPresence);
  melodyGain.connect(master);
  melodyGain.connect(delaySend);
  melodyGain.connect(reverbSend);
  texture.chain(textureFilter, textureGain);
  textureGain.connect(master);
  textureGain.connect(reverbSend);

  return {
    master,
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
    reedVibrato,
    guitarBody,
    guitarString,
    guitarFretNoise,
    guitarDrive,
    guitarPresence,
    texture,
  };
}

export function disposeMasterAudioGraph(graph: MasterAudioGraph): void {
  [
    graph.kick, graph.snare, graph.hat, graph.rim, graph.tomLow, graph.tomMid, graph.tomHigh, graph.crash, graph.ride,
    graph.bass, graph.bassAccent, graph.bassMute,
    graph.harmony, graph.melody, graph.melodyLead, graph.melodyMute,
    graph.reedLead, graph.reedLeadAlt, graph.reedBreath, graph.reedBreathAlt, graph.reedDrive, graph.reedBody,
    graph.reedPresence, graph.reedVibrato, graph.texture,
    graph.guitarBody, graph.guitarString, graph.guitarFretNoise, graph.guitarDrive, graph.guitarPresence,
    graph.grooveGain, graph.harmonyGain, graph.melodyGain, graph.textureGain,
    graph.delay, graph.reverb, graph.delaySend, graph.reverbSend, graph.drumBus, graph.drumTrim, graph.drumReverbSend,
    graph.masterFilter, graph.masterCompressor, graph.master, graph.limiter,
    graph.drumDrive, graph.drumFilter, graph.bassDrive, graph.bassTrim, graph.harmonyFilter, graph.harmonyChorus,
    graph.melodyFilter, graph.melodyChorus, graph.textureFilter,
  ].forEach((node) => node.dispose());
}

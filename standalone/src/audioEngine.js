import * as Tone from "tone";
import { BPM, sceneForBar, TOTAL_BARS } from "./musicData.js";
const harmonyVoicings = {
    "harmony-soft": [
        ["A3", "E4", "B4"],
        ["F3", "C4", "G4"],
        ["C4", "G4", "D5"],
        ["G3", "D4", "A4"],
    ],
    "harmony-main": [
        ["A3", "C4", "E4", "B4"],
        ["F3", "A3", "C4", "G4"],
        ["C4", "E4", "G4", "D5"],
        ["G3", "B3", "D4", "A4"],
    ],
    "harmony-open": [
        ["A2", "E3", "C4", "B4"],
        ["F2", "C3", "A3", "G4"],
        ["C3", "G3", "E4", "D5"],
        ["G2", "D3", "B3", "A4"],
    ],
};
const bassPatterns = {
    "bass-main": ["A2", "A2", "F2", "F2", "C3", "C3", "G2", "G2"],
    "bass-alt": ["A2", "C3", "F2", "A2", "C3", "E3", "G2", "B2"],
};
const melodyPatterns = {
    "memory-opening": [
        { step: 0, note: "E4", duration: "8n", velocity: 0.62 },
        { step: 3, note: "G4", duration: "8n", velocity: 0.58 },
        { step: 6, note: "A4", duration: "4n", velocity: 0.68 },
        { step: 12, note: "G4", duration: "8n", velocity: 0.52 },
    ],
    "memory-main": [
        { step: 0, note: "A4", duration: "8n", velocity: 0.72 },
        { step: 2, note: "C5", duration: "8n", velocity: 0.68 },
        { step: 4, note: "B4", duration: "8n", velocity: 0.64 },
        { step: 6, note: "G4", duration: "4n", velocity: 0.66 },
        { step: 10, note: "E4", duration: "8n", velocity: 0.55 },
        { step: 12, note: "G4", duration: "8n", velocity: 0.62 },
        { step: 14, note: "A4", duration: "4n", velocity: 0.74 },
    ],
    "memory-response": [
        { step: 1, note: "C5", duration: "8n", velocity: 0.58 },
        { step: 5, note: "B4", duration: "8n", velocity: 0.54 },
        { step: 9, note: "A4", duration: "8n", velocity: 0.56 },
        { step: 13, note: "E5", duration: "8n", velocity: 0.62 },
    ],
};
const drumPatterns = {
    "pulse-sparse": [0, 6, 8, 14],
    "pulse-full": [0, 3, 6, 8, 11, 14],
    "pulse-break": [4, 8, 11, 14],
};
export class AudioEngine {
    callbacks;
    initialized = false;
    scheduledId = null;
    lastSceneId = "";
    master;
    limiter;
    masterFilter;
    delay;
    reverb;
    kick;
    snare;
    hat;
    bass;
    harmony;
    melody;
    texture;
    constructor(callbacks) {
        this.callbacks = callbacks;
    }
    async initialize() {
        if (this.initialized)
            return;
        await Tone.start();
        this.master = new Tone.Volume(-3);
        this.limiter = new Tone.Limiter(-1);
        this.masterFilter = new Tone.Filter({ frequency: 1200, type: "lowpass", rolloff: -24 });
        this.delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.26, wet: 0.2 });
        this.reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.03, wet: 0.42 });
        this.master.chain(this.masterFilter, this.limiter, Tone.getDestination());
        this.delay.connect(this.master);
        this.reverb.connect(this.master);
        this.kick = new Tone.MembraneSynth({
            pitchDecay: 0.03,
            octaves: 5,
            oscillator: { type: "sine" },
            envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.08 },
        }).connect(this.master);
        this.snare = new Tone.NoiseSynth({
            noise: { type: "pink" },
            envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 },
        }).connect(this.reverb);
        this.hat = new Tone.MetalSynth({
            frequency: 230,
            envelope: { attack: 0.001, decay: 0.045, release: 0.01 },
            harmonicity: 5.1,
            modulationIndex: 24,
            resonance: 4200,
            octaves: 1.5,
            volume: -18,
        }).connect(this.master);
        this.bass = new Tone.MonoSynth({
            oscillator: { type: "fatsawtooth", count: 2, spread: 10 },
            filter: { Q: 2, type: "lowpass", rolloff: -24 },
            envelope: { attack: 0.01, decay: 0.18, sustain: 0.32, release: 0.2 },
            filterEnvelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.25, baseFrequency: 100, octaves: 2.3 },
            volume: -11,
        }).connect(this.master);
        this.harmony = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.08, decay: 0.25, sustain: 0.45, release: 1.2 },
            volume: -16,
        });
        this.harmony.connect(this.reverb);
        this.melody = new Tone.Synth({
            oscillator: { type: "fatsine", count: 2, spread: 8 },
            envelope: { attack: 0.02, decay: 0.16, sustain: 0.25, release: 0.5 },
            volume: -13,
        });
        this.melody.connect(this.delay);
        this.melody.connect(this.reverb);
        this.texture = new Tone.NoiseSynth({
            noise: { type: "brown" },
            envelope: { attack: 0.2, decay: 0.8, sustain: 0.1, release: 1.8 },
            volume: -31,
        }).connect(this.reverb);
        const transport = Tone.getTransport();
        transport.bpm.value = BPM;
        transport.timeSignature = 4;
        transport.loop = false;
        this.scheduledId = transport.scheduleRepeat((time) => {
            const position = transport.position.toString().split(":").map(Number);
            const bar = Number.isFinite(position[0]) ? position[0] : 0;
            const beat = Number.isFinite(position[1]) ? position[1] : 0;
            const sixteenth = Number.isFinite(position[2]) ? Math.floor(position[2]) : 0;
            const step = beat * 4 + sixteenth;
            const scene = sceneForBar(bar);
            this.applySceneFx(scene, time);
            this.playStep(scene, bar, step, time);
            Tone.getDraw().schedule(() => {
                if (scene.id !== this.lastSceneId) {
                    this.lastSceneId = scene.id;
                    this.callbacks.onScene(scene);
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
    start() {
        const transport = Tone.getTransport();
        transport.stop();
        transport.position = "0:0:0";
        this.lastSceneId = "";
        transport.start("+0.08");
    }
    pause() {
        Tone.getTransport().pause();
    }
    resume() {
        Tone.getTransport().start("+0.05");
    }
    stop() {
        const transport = Tone.getTransport();
        transport.stop();
        transport.position = "0:0:0";
    }
    seek(position) {
        Tone.getTransport().position = position;
    }
    get state() {
        return Tone.getTransport().state;
    }
    applySceneFx(scene, time) {
        this.masterFilter.frequency.exponentialRampToValueAtTime(Math.max(80, scene.fx.filter), time + 0.18);
        this.delay.wet.linearRampToValueAtTime(scene.fx.delayWet, time + 0.18);
        this.reverb.wet.linearRampToValueAtTime(scene.fx.reverbWet, time + 0.18);
        this.master.volume.linearRampToValueAtTime(scene.fx.masterGain, time + 0.18);
    }
    playStep(scene, bar, step, time) {
        const localBar = Math.max(0, bar - scene.startBar);
        this.playDrums(scene.layers.drums, step, time);
        this.playBass(scene.layers.bass, localBar, step, time);
        this.playHarmony(scene.layers.harmony, localBar, step, time);
        this.playMelody(scene.layers.melody, step, time);
        this.playTexture(scene.layers.texture, step, time);
    }
    playDrums(patternId, step, time) {
        if (!patternId)
            return;
        const pattern = drumPatterns[patternId] ?? [];
        if (pattern.includes(step)) {
            const isKick = step === 0 || step === 8 || step === 4;
            if (isKick)
                this.kick.triggerAttackRelease("C1", "8n", time, 0.8);
            else
                this.hat.triggerAttackRelease("32n", time, 0.36);
        }
        if (step === 4 || step === 12)
            this.snare.triggerAttackRelease("16n", time, 0.28);
        if (step % 2 === 0 && patternId === "pulse-full")
            this.hat.triggerAttackRelease("32n", time, 0.18);
    }
    playBass(patternId, localBar, step, time) {
        if (!patternId || step % 2 !== 0)
            return;
        const pattern = bassPatterns[patternId] ?? bassPatterns["bass-main"];
        const index = (localBar * 8 + step / 2) % pattern.length;
        this.bass.triggerAttackRelease(pattern[index], "8n", time, 0.48);
    }
    playHarmony(patternId, localBar, step, time) {
        if (!patternId || step !== 0)
            return;
        const voicings = harmonyVoicings[patternId] ?? harmonyVoicings["harmony-main"];
        const chord = voicings[localBar % voicings.length];
        this.harmony.triggerAttackRelease(chord, "1m", time, 0.3);
    }
    playMelody(patternId, step, time) {
        if (!patternId)
            return;
        const note = (melodyPatterns[patternId] ?? []).find((event) => event.step === step);
        if (!note)
            return;
        this.melody.triggerAttackRelease(note.note, note.duration, time, note.velocity);
    }
    playTexture(patternId, step, time) {
        if (!patternId || step !== 0)
            return;
        const velocity = patternId === "texture-dust" ? 0.16 : 0.1;
        this.texture.triggerAttackRelease("2n", time, velocity);
    }
    dispose() {
        if (this.scheduledId !== null)
            Tone.getTransport().clear(this.scheduledId);
        this.stop();
        [this.kick, this.snare, this.hat, this.bass, this.harmony, this.melody, this.texture, this.delay, this.reverb, this.masterFilter, this.master, this.limiter]
            .filter(Boolean)
            .forEach((node) => node.dispose());
    }
}

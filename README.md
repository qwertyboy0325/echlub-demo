# EchLub Four-Brain DJ Lab — Round 1

Round 1 of the scripted, recordable Four-Brain DJ concept demo.

## What is implemented

- One-page recording-oriented interface.
- Four simultaneous Brain windows:
  - Memory / Cue
  - Pulse / Timing
  - Blend / Space
  - Story / Structure
- Tone.js transport as the musical timing authority.
- Original placeholder MIDI/pattern material rendered with browser synthesis.
- Six scenes across a 40-bar arrangement.
- Scripted semantic actions such as edit, private preview, offer, queue and launch.
- Basic GSAP virtual cursor choreography.
- Visible Draft lifecycle and Jam Memory moments.
- Start, pause/resume and restart controls.

## Deliberate Round 1 limits

- This is not yet a faithful reconstruction of `四季ノ唄`.
- The musical material is original placeholder content.
- Cursor choreography is foundational rather than fully humanized.
- There is no real multi-user networking.
- There is no Rust/WASM integration.
- There is no editable persistence or export.

## Run

```bash
npm install
npm run dev
```

Open the **exact** local URL printed by Vite (do not guess the port). Normally:

```text
http://localhost:4173/
```

For the Phase 5 live-collab demo (seven progressive lanes, Ryo/Kai/Mei/Ren cast):

```bash
npm run dev:live-collab
# or: VITE_SHIKI_PACK_MODE=live-collab npm run dev
```

You should see **Global Studio · Participant · Mixer** tabs, a **Play** transport bar, and arrangement lanes. Audio requires a user click (**Play** or **Preview clip** in Participant → Create) to unlock the browser AudioContext.

If the page stays blank for 5+ seconds, you are likely on the wrong URL or base path.

## Build

```bash
npm run build
npm run preview
```

Preview is served under the production base path:

```text
http://localhost:4173/echlub-demo/
```

(Vite may pick another port if `4173` is already in use — always use the URL it prints.)

## Architecture

```text
musicData.ts
  patterns, drafts, scenes

performanceScript.ts
  semantic four-brain decisions

audioEngine.ts
  Tone.js transport, synth graph and scene rendering

presentation.ts
  GSAP cursor and visual emphasis

main.ts
  runtime state and UI projection
```

The intended authority split is:

```text
Tone transport      = musical clock
performance script  = semantic decision source
GSAP                 = visual projection
```

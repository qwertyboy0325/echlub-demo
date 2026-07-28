# EchLub Four-Brain DJ Lab — Archived Experiment

This repository preserves a scripted, recordable Four-Brain DJ concept demo.

> **Status: failed product-narrative experiment.**
>
> Owner review on 2026-07-28 found that persistent multi-cursor choreography reads as visual noise rather than collaboration, and that scripted workflow transitions do not make collaborative composition perceptible to a cold viewer. The implementation remains useful engineering and research evidence, but this demo is not current proof of an EchLub product direction or differentiator.

## What was implemented

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
- GSAP virtual cursor choreography.
- Visible Draft lifecycle and Jam Memory moments.
- Start, pause/resume and restart controls.

## Why the product narrative failed

The demo shows several scripted actors and state transitions, but it does not clearly show one musician's decision changing another musician's work. The cursors signal activity without creating a feeling of collaboration, and captions and lifecycle labels carry too much of the explanation.

Collaborative composition is therefore not treated as a current EchLub selling point. This does not claim that musical collaboration can never have value; it records that this demo did not establish that value or differentiation.

## Historical limits

- This is not a faithful reconstruction of `四季ノ唄`.
- The musical material is original placeholder content.
- There is no real multi-user networking.
- There is no Rust/WASM integration.
- There is no editable persistence or export.
- The recording and Git history are retained as failed-experiment evidence.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite and click the start control once to unlock browser audio.

## Build

```bash
npm run build
npm run preview
```

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

The intended authority split was:

```text
Tone transport      = musical clock
performance script  = semantic decision source
GSAP                 = visual projection
```

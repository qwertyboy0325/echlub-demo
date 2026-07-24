# Reference Analysis — Pattern Extraction (Not Visual Copy)

Sources: `design-research/reference-study.md`, prior skeleton frames, 5ece39e shell critique input, rejected dashboard evidence.

## Rejected baseline: 5ece39e / skeleton B frames

Prior static frames (`design-research/frames/option-b-*.html`) exhibit:

- `#7eb6ff` brand accent — reads SaaS, not studio
- `border-radius: 8px` on all panels — card dashboard
- Gradient meters — decorative
- Blue selection on everything — no participant/workflow separation

**Verdict:** Useful IA proof; **reject as visual direction.**

## Ableton Live — extract only

| Extract | EchLub mapping |
|---------|----------------|
| Flat dark gray canvas, thin dividers | Direction A precision baseline |
| Clip color = track identity | Track/clip chroma separate from UI chrome |
| Session vs Arrangement split | Global arrangement vs Participant editor |
| Minimal branding in workspace | "EchLub" wordmark only in presenter nav |

**Do not copy:** Device rack skeuomorphism, yellow/black clip aesthetic, browser chrome.

## Bitwig — extract only

| Extract | EchLub mapping |
|---------|----------------|
| Warm dark neutrals | Direction B canvas family |
| Larger modulation controls | Live Control Dock slot sizing |
| Colored modulation routing lines | Devices chain connectors (1px, semantic) |

**Do not copy:** Panel gloss, holographic accents, grid dot backgrounds.

## Figma — extract only

| Extract | EchLub mapping |
|---------|----------------|
| Follow mode affordance | Follow chip + break/resume |
| Collaborator color on cursor | Participant identity colors (#e76f51, #2a9d8f, #e9c46a) |
| Multiplayer presence rail | Left presence strip |

**Do not copy:** White canvas, purple selection, comment bubbles, UI density of design tool.

## Broadcast / editorial control surfaces

| Extract | EchLub mapping |
|---------|----------------|
| Strong typographic hierarchy | Direction C section headers |
| Monospace timecode | Transport readout |
| Single live/recording accent | `--recording` token |
| Grid-visible edit surfaces | Piano roll / arrangement lanes |

**Do not copy:** Tally light skeuomorphism, skeuomorphic VU needles.

## Professional mixer surfaces

| Extract | EchLub mapping |
|---------|----------------|
| Channel strip width for touch | Direction B fader/meter scale |
| Meter always adjacent to fader | Mixer room layout |
| Send/return topology clarity | Devices chain → Preview vs Master split |

## Synthesized hierarchy (all directions)

```text
Presenter nav     — wayfinding, Follow, transport readout (48px)
Presence rail     — who, task profile, active state (200px / 48px compact)
Center            — musical work (≥60% height)
Exchange          — artifact queue (320px / overlay)
Bottom            — transport OR Live Control Dock (48–140px)
```

## What references explicitly do NOT justify

- Installing shadcn or admin templates
- Copying any single product's color hex values
- Photoreal knob textures or 3D faders
- Light-mode studio (all directions remain dark for recording contrast)

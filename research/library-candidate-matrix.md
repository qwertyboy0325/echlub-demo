# Library Candidate Matrix — EchLub V2

## Workspace docking and panel layout

| Package | Maintainer | License | TS | Framework | Bundle | A11y | Touch | EchLub use | Risks | Recommendation |
|---------|------------|---------|-----|-----------|--------|------|-------|------------|-------|----------------|
| **dockview** v7 | mathuo | MIT | Yes | Vanilla/React/Vue/Angular | ~50–80 KB | Partial (keyboard module) | Supported | Participant/Mixer panel tabs, float, popout | v7 rename migration; theming work | **Selected** |
| golden-layout v2 | golden-layout | MIT | Yes | Virtual components only | ~40 KB | Limited | Partial | — | No React; dev branch unstable; dropped features | **Rejected** |
| flexlayout-react | caplin | ISC | Yes | React only | ~30 KB | Limited | Partial | — | Requires React migration | **Rejected** |
| split.js | nathancahill | MIT | Yes | Agnostic | ~3 KB | N/A | Yes | Simple split panes inside dock panels | No tabs/popouts alone | **Supplement** |
| Custom CSS grid | — | — | — | Vanilla | 0 | DIY | DIY | Global Studio fixed regions | High build cost for popouts | Fallback only |

## Spatial drag, drop, snapping

| Package | Maintainer | License | TS | Bundle | EchLub use | Boundary | Recommendation |
|---------|------------|---------|-----|--------|------------|----------|----------------|
| **@interactjs/* ** | taye | MIT | Yes | Modular ~20–40 KB | Clip Exchange spatial drag, arrangement placement, dock slot mapping | Spatial only | **Selected** |
| **sortablejs** | SortableJS | MIT | Yes | ~15 KB | Queue ordering, list reorder in Exchange | Lists only — already in repo | **Retain** |
| HTML5 DnD | Native | — | — | 0 | Simple clip handoff | Poor touch, flaky | Avoid primary |
| @dnd-kit | clauderic | MIT | Yes | ~25 KB | — | React-only | Rejected |

**Boundary rule:** interact.js = spatial/snap/grid; SortableJS = ordered lists and clone-to-fork queue rows. Never both on same element.

## Floating inspectors and popouts

| Package | Maintainer | License | EchLub use | Recommendation |
|---------|------------|---------|------------|----------------|
| **@floating-ui/dom** | floating-ui | MIT | Device inspector, clip preview popover, mapping picker | **Selected** |
| Popover API | Native | — | Simple tooltips where supported | Progressive enhancement |
| Dockview floating groups | mathuo | MIT | Large inspector panels | Use for panel-level float |

## MIDI input

| Package | Maintainer | License | EchLub use | Recommendation |
|---------|------------|---------|------------|----------------|
| **Web MIDI API** | W3C | — | Real device input when present | **Primary** |
| webmidi.js | djipco | Apache-2.0 | Thin wrapper, device enumeration | Optional thin layer |
| Simulated input | Custom | — | Demo without device | **Required fallback** |

Browser limits: HTTPS/localhost only; no iOS Safari MIDI; permission prompt required.

## MIDI and timeline rendering

| Approach | Maintainer | License | Bundle | EchLub use | Recommendation |
|----------|------------|---------|--------|------------|----------------|
| **Canvas 2D custom** | In-house | — | 0 | Piano roll, step grid, playhead, velocity | **Selected** |
| SVG + DOM | — | — | Low | Automation lanes, static rulers | Supplement |
| PixiJS | Goodboy | MIT | ~100 KB+ | — | Overkill; no WebGL requirement | Rejected |
| wavesurfer.js | katspaugh | BSD-3 | ~30 KB | Clip waveform preview only | Optional later |

Requirements: note move/resize, selection, velocity, playhead, full-size professional appearance.

## Audio controls

| Package | Maintainer | License | Bundle | EchLub use | Recommendation |
|---------|------------|---------|--------|------------|----------------|
| **Custom Web Components** | In-house | — | ~5–15 KB | Knobs, faders, toggles, meters for Live Control Dock | **Selected** |
| Wrapped `<input type="range">` | Native | — | 0 | Fallback + a11y baseline | **Required base** |
| NexusUI | nexus-js | LGPL | ~50 KB | — | LGPL concern; unmaintained feel | Rejected |
| rotary-gui | — | Various | Varies | — | Inconsistent a11y | Rejected |

Research knobs, faders, pads independently — do not import large lib for one knob.

## State semantics

| Approach | EchLub use | Recommendation |
|----------|------------|----------------|
| **Typed domain events + reducer** | Clip lifecycle, mix, presenter viewpoint | **Selected** |
| XState v5 | Optional subgraph for exchange lifecycle | Defer unless complexity proves need |
| Zustand/Jotai | — | React-only | Rejected |

State machine only if it clarifies: draft → preview → share → fork → revise → stage → activate → arrange → restart.

## Existing repo dependencies

| Package | Version | Verdict |
|---------|---------|---------|
| tone | 15.1.22 | **Retain** — transport authority |
| gsap | 3.15.0 | **Retain** — presenter cursor/choreography only; not musical clock |
| fflate | 0.8.3 | **Retain** — export zip |
| sortablejs | 1.15.7 (archive) | **Retain** — queue lists |
| puppeteer-core | 24.8.0 | **Retain** — existing gates until Playwright migration |

## Summary selections

| Category | Selected | Rejected alternatives |
|----------|----------|----------------------|
| Framework | Vite + vanilla TS | React, Svelte |
| Docking | dockview | golden-layout, flexlayout |
| Spatial DnD | interact.js | HTML5 DnD, @dnd-kit |
| List DnD | sortablejs | interact.js on lists |
| Float UI | @floating-ui/dom | — |
| MIDI in | Web MIDI + simulated | webmidi.js required |
| Timeline | Canvas 2D custom | PixiJS, full DAW lib |
| Controls | Custom WC + range | NexusUI |
| State | Typed reducer + domain events | XState (defer) |

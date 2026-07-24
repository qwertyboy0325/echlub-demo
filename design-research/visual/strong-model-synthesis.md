# Strong-Model Synthesis — Visual Direction Gate

**Role:** STRONG_ARCHITECT / Sol synthesis (design-only; no implementation authorization)  
**Inputs:** Directions A/B/C frames, token comparison, anti-AI kill list, owner hypothesis (A global + B accents)

## Executive summary

Three directions on identical IA successfully diverge on **temperature, control scale, and typographic authority** without violating the kill list. The 5ece39e / skeleton-B baseline fails primarily on **monochrome blue SaaS accent + card radii**, not on layout.

## Direction assessment

| Criterion | A Precision | B Hardware | C Editorial |
|-----------|-------------|------------|-------------|
| Anti-AI compliance | ★★★★★ | ★★★★☆ | ★★★★★ |
| Studio credibility | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| 1280×720 legibility | ★★★★☆ | ★★★★★ | ★★★★★ |
| Musical focus | ★★★★★ | ★★★★☆ | ★★★★☆ |
| Implementation discipline | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| Presenter/demo impact | ★★★☆☆ | ★★★★☆ | ★★★★★ |

## Owner hypothesis evaluation: A global + B accents

**Verdict: Supported with constraints.**

| Layer | Recommendation |
|-------|----------------|
| Focus Shell chrome | **A tokens** — canvas, panel, separator, nav, Exchange, typography |
| Global / Participant Create | **A** — flat arrangement, piano grid, minimal radii |
| Devices / Mixer / Dock | **B control anatomy** — 64px knobs, 12px faders, warm `--focus` on controls only |
| Presenter readouts | **C typography patterns** — mono transport, bold section labels (without C's red accent) |

**Constraint:** B warm accent (`#c4956a`) must **not** propagate to Global arrangement or Exchange chrome — only control surfaces in Devices/Mixer rooms.

## Primitive foundation

**React Aria Components** over Radix Primitives.

| Factor | React Aria | Radix |
|--------|--------------|-------|
| Slider/knob/fader semantics | First-class `Slider`, `NumberField` | Primitive-only; more custom work |
| Focus management for Follow lock | Built-in focus scope | Manual |
| Bundle for purpose-built controls | Composable slots | Often pulls shadcn ecosystem pressure |
| Dockview theming | CSS vars compatible | CSS vars compatible |

**Icon:** Lucide · **Fonts:** Inter + IBM Plex Mono · **Tokens:** CSS custom properties · **Shell libs:** Existing Dockview/interactjs/sortablejs at 5ece39e — theme only, no new installs.

## Implementation cost (relative)

| Approach | Effort | Risk |
|----------|--------|------|
| Pure A | 1.0× baseline | Cold presenter demos |
| Pure B | 1.4× | Skeuomorphism drift |
| Pure C | 1.2× | Harsh long-session editing |
| **Hybrid A+B (+C type)** | **1.25×** | Accent bleed if unscoped |

Hybrid cost breakdown:
- Token CSS file + room-scoped overrides: ~2–3 days
- Purpose-built Knob/Fader/Toggle/Trigger: ~3–4 days
- Dockview theme pass: ~1 day
- Frame-to-component parity validation: ~1 day

## Risks if owner picks wrong

| Choice | Failure mode |
|--------|--------------|
| Pure B everywhere | Global reads as toy mixer, not collaboration hub |
| Pure C everywhere | Editing surfaces feel punitive; red accent fatigue |
| Revert to 5ece39e visuals | SaaS dashboard regression at Gate 2 |

## Recording

Puppeteer unavailable; ffmpeg present. **Recording deferred** — contact sheets are primary review vehicle. Owner may run `npm run preview` + manual capture if walkthrough video required.

## Artifacts produced

- 42 HTML frames (14 × 3 directions)
- 3 direction contact sheets + 1 comparison sheet
- 14 markdown specification files
- Token CSS: `tokens/direction-{a,b,c}.css`

## Sol position

Recommend **Hybrid A+B with C typography borrow** as default pending owner override. Do not resume Phase 3A `src/**` until owner selects direction or confirms hybrid scope.

# Anti-AI Kill List — EchLub Visual Directions

**Enforcement:** All frames A/B/C and all future implementation MUST pass this list.  
**Rationale:** These patterns signal "AI-generated SaaS demo" and destroy studio credibility.

## Forbidden unless functional need demonstrated

| Pattern | Why banned | Allowed alternative |
|---------|------------|---------------------|
| Purple/cyan gradients | Default AI palette | Flat semantic fills from token set |
| Glassmorphism / frosted blur | Decorative, hurts contrast | Solid panel surfaces |
| Blurred card backgrounds | Hides hierarchy | 1px separator + flat raised surface |
| Neon glows on controls | Fake "pro" signal | Border-color focus ring only |
| Rounded-card everything | Dashboard template feel | Small radii (0–4px); controls may be round |
| Excessive pills/badges | Noise | Lifecycle chips (4 only) + slot badges (3 only) |
| Marketing headlines in studio | Breaks immersion | Section labels: 10px uppercase, muted |
| Sparkle / magic icons | Consumer app | Lucide functional icons only |
| Emoji in nav | Unprofessional | Text + icon |
| Giant margins / whitespace theater | Wastes 1280×720 | Tight grid; presence 200px max |
| Competing accent colors | No single focus grammar | One focus accent + participant identity |
| Unnecessary drop shadows | Floating card SaaS | `shadow: none` or 1px inset only |
| Gradient buttons | CTA template | Flat border + hover surface shift |
| Floating explanatory cards | Tutorial UI | Activity feed (provenance strings) |
| Decorative disconnected waveforms | Fake audio | Exchange thumbnail bars OR real data later |
| shadcn dashboard composition | Admin template | Purpose-built EchLub primitives |
| Ableton/Bitwig/Figma/Linear chrome copy | Legal + wrong product | Extract patterns only (see reference-analysis) |

## Required positive signals

- **Operational density:** Controls show value state (knob position, fader level, meter peak)
- **Semantic color:** Color encodes participant, lifecycle, preview/master/recording — never decoration
- **Numeric typography:** Transport, BPM, param values in monospace tabular figures
- **Flat hierarchy:** Canvas → panel → raised; separators not shadows
- **Human fixture content:** Real clip names (pulse-r1, melody-draft, shiki-hook), real participants (Alex, Jordan, Sam)

## Frame review checklist

Before owner approval, each HTML frame must answer NO to:

1. Would this appear on an AI landing-page generator?
2. Are there more than two accent hues unrelated to data?
3. Could a non-musician confuse this for a project-management app?
4. At 1280×720, is any lifecycle chip below 9px effective size?

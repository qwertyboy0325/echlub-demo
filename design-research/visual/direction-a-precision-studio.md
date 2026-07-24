# Direction A — Precision Studio

**Character:** Graphite-neutral, flat surfaces, 1px separators, 2px radii, semantic color only.

## Design intent

A **calibration-first** studio: every pixel serves state readability. No warmth, no gloss, no decorative motion. Feels like a serious desktop tool for people who already know DAWs — not a consumer app, not a SaaS dashboard.

## Token summary

| Token | Value | Use |
|-------|-------|-----|
| `--canvas` | `#131313` | Outermost background |
| `--panel` | `#1a1a1a` | Side rails, transport |
| `--raised` | `#222222` | Lanes, slots, rows |
| `--separator` | `#333333` | All 1px borders |
| `--text` | `#e6e6e6` | Primary labels |
| `--muted` | `#8a8a8a` | Section labels, idle |
| `--selection` | `#3d6a8a` | Staged clip, secondary focus |
| `--focus` | `#4a7fa8` | Active control, tab underline |
| `--preview` | `#5a7a5a` | Preview badge/meter |
| `--recording` | `#a84848` | Playhead, Review lifecycle |
| `--ready` | `#6a8a5a` | Ready lifecycle |
| `--master` | `#7a6a4a` | Shared Master accent |
| `--radius` | `2px` | Panels, chips |
| `--shadow` | `none` | — |

## Control anatomy

- **Knob:** 48px, flat disk, 2px ring, index tick (no gradient)
- **Fader:** 8px wide, rectangular cap implied by fill level
- **Toggle:** 2px radius rectangle (not pill)
- **Meter:** Solid fill bar, no gradient

## Room emphasis

| Room | A-specific treatment |
|------|---------------------|
| Global | Arrangement lanes as flat rows; staged = selection border; active = 8% shared tint |
| Participant | Piano grid lines `#2a2a2a`; notes at 60% selection opacity |
| Mixer | Compact controls; dock slots equal grid; MASTER border only |

## Strengths

- Lowest SaaS/dashboard risk
- Best token discipline for long-term maintenance
- Clearest separation of semantic color systems

## Risks

- Can feel cold or "enterprise" without B-style tactile scaling in Mixer
- Insufficient warmth for presenter/demo emotional engagement

## Frames

`design-research/visual/frames/a/` — 14 frames + contact sheet

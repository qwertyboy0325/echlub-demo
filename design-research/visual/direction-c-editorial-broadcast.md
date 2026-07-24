# Direction C — Editorial Broadcast Studio

**Character:** Neutral editorial grid, strong typography, presentation legibility — professional broadcast, not consumer SaaS.

## Design intent

Optimize for **presenter recording and viewer comprehension**: what room am I in, who is active, what lifecycle state, what's on Master. Typography carries hierarchy; color is sparse and intentional (broadcast red for live/recording).

## Token summary

| Token | Value | Use |
|-------|-------|-----|
| `--canvas` | `#0e0e0e` | Deep neutral |
| `--panel` | `#161616` | Rails |
| `--raised` | `#1c1c1c` | Content blocks |
| `--separator` | `#2e2e2e` | Grid rules |
| `--text` | `#f2f2f2` | Primary — Source Sans 3 |
| `--muted` | `#9a9a9a` | Metadata |
| `--selection` | `#d44d2a` | Broadcast accent |
| `--focus` | `#e85a34` | Active tab, follow |
| `--recording` | `#d44d2a` | Live, Review, playhead |
| `--master` | `#c4a035` | Shared Master tally |
| `--radius` | `0px` | Sharp editorial panels |
| `--radius-control` | `2px` | Minimal on controls only |

## Typography-led hierarchy

- **Brand / room:** Source Sans 3, 600 weight, tight tracking
- **Section labels:** 10px uppercase, 0.1em tracking
- **Transport / timecode:** Source Code Pro tabular
- **Participant avatars:** 2px radius squares (not circles) — editorial ID badges

## Room emphasis

| Room | C-specific treatment |
|------|---------------------|
| Global | Activity feed as headline strip; lifecycle chips high contrast |
| Participant | Clip header context bar persistent; grid-forward editor |
| Mixer | Controls smaller but labels bolder; tally badges prominent |

## Strengths

- Best presenter/demo legibility at 1280×720
- Sharpest anti-SaaS stance via zero-radius editorial grid
- Clear live/recording semantics (broadcast red)

## Risks

- Sharp/zero-radius can feel harsh in long editing sessions
- Red accent overuse triggers "recording" anxiety if not scoped
- Weakest tactile affordance for Live Control Dock

## Frames

`design-research/visual/frames/c/` — 14 frames + contact sheet

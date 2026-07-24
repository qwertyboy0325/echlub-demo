# Direction B — Modern Hardware Console

**Character:** Warmer dark neutrals, tactile controls, larger faders/knobs/meters — **no photoreal skeuomorphism**.

## Design intent

Evoke **physical mixer/console ergonomics** through scale and warmth, not texture maps. The Mixer room and Live Control Dock should feel touchable at 1440×900 and legible at 1280×720 recording resolution.

## Token summary

| Token | Value | Use |
|-------|-------|-----|
| `--canvas` | `#181614` | Warm black base |
| `--panel` | `#211e1c` | Side rails |
| `--raised` | `#2a2623` | Controls background |
| `--separator` | `#3d3834` | Warm gray borders |
| `--text` | `#ece8e4` | Primary |
| `--muted` | `#9a928a` | Secondary |
| `--selection` | `#c4956a` | Staged, hardware accent |
| `--focus` | `#d4a574` | Active control highlight |
| `--preview` | `#6a9a7a` | Preview path |
| `--recording` | `#c45a4a` | Review / live |
| `--ready` | `#8aaa6a` | Ready chip |
| `--master` | `#c4956a` | Shared Master (shared with selection — intentional warmth) |
| `--radius` | `4px` | Panels |
| `--radius-control` | `6px` | Slots, fader tracks |
| `--shadow` | `0 1px 0 rgba(0,0,0,0.4)` | Subtle depth on controls only |

## Control anatomy

- **Knob:** 64px (vs 48px in A), thicker ring `#6a6058`
- **Fader:** 12px wide, 90px tall — primary Mixer affordance
- **Toggle:** 10px radius pill (hardware switch metaphor)
- **Meter:** 4px LED strip beside fader channel

## Room emphasis

| Room | B-specific treatment |
|------|---------------------|
| Global | Retains A-like flat arrangement; slightly warmer panel |
| Participant Devices | Chain nodes with rounded tactile pads |
| Mixer | **Hero room** — channel strips + 8-slot dock at maximum control size |

## Strengths

- Best Live Control Dock legibility for recording
- Warmth differentiates EchLub from generic dark dashboards
- Natural fit for Devices/Mixer accent hypothesis

## Risks

- Warm accent on MASTER + selection can merge if not carefully bounded
- Slightly higher implementation cost (per-control size variants)
- Must guard against sliding into skeuomorphic textures

## Frames

`design-research/visual/frames/b/` — 14 frames + contact sheet

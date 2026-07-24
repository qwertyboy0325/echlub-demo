# Recommended Skeleton — Three Rooms + Focus Shell

**Status: LOCKED by owner 2026-07-24**

## Architecture

Three explicit Rooms, each rendered inside the same **Focus Shell** grid:

| Room | Route | Center dominance |
|------|-------|------------------|
| **Global Studio** | `global` | Arrangement / Launcher — sole home for Stage + Activate |
| **Participant Workspace** | `participant` | Full editor (Create, Devices, Automation, Mix, Queue) |
| **Mixer / Performance** | `mixer` | Channel strips + Live Control Dock |

Focus Shell regions (all Rooms):

| Region | Size | Content |
|--------|------|---------|
| Left rail | 200px (48px icon-only at compact) | Presence, task profiles, room nav |
| Center | `1fr` | One dominant surface per Room |
| Right rail | 320px if ≥1360px; drawer if 1280–1359px | Shared Clip Exchange |
| Bottom | 48px transport OR 112–140px Live Control Dock | Room-dependent |

## Viewport collapse

| Mode | Width | Exchange | Presence |
|------|-------|----------|----------|
| `wide` | ≥1360px | Fixed 320px rail | Full 200px |
| `drawer` | 1280–1359px | Overlay drawer | Full 200px |
| `compact` | 1280×720 | Drawer | 48px icons |

## Lifecycle chips (4 only)

`Available` | `In Progress` | `Review` | `Ready`

No Jira-style 8-state rows. Detail on select/hover.

## Participant tabs (max 5)

Create | Devices | Automation | Mix | Queue

Create sub-modes (not separate tabs): Piano Roll | Step | Clip editor.

## Presenter + Follow Active

- Top nav: Global / Participant picker / Mixer
- **Follow Active** lock highlights active participant; manual room/participant select breaks follow until explicit Resume Follow
- Follow frozen during drag, knob hold, open popover

## Stage / Activate authority

- **Only** in Global arrangement surface
- Exchange cards never expose stage/activate
- Human select → stage → activate (no scene launch)

## Why this replaces rejected dashboard

- Rejected: grid of 7 miniature workspaces + story panel
- Approved: one primary center surface + Exchange rail per Room
- No scene cards, no guided focus, no simultaneous mini editors

## Library support

| Surface | Library |
|---------|---------|
| Outer shell | CSS Grid (not Dockview) |
| Participant center | dockview-react |
| Exchange → timeline drag | interact.js |
| Queue ordering | sortablejs |
| Inspector popover | @floating-ui/dom |
| Piano roll | canvas/SVG custom |

## Visual baseline

Static frames: `design-research/frames/option-b-*.html` — adapted to Three-Room routing.

## Canonical spec

See `design-research/owner-approved-architecture.md`.

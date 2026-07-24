# Recommended Skeleton — Option B: Exchange-Anchored Focus Shell

## Recommendation

**Adopt Skeleton Option B** for Phase 3A browser shell implementation.

## Why B over A and C

| Criterion | A Stage&Booths | **B Focus Shell** | C Dual Canvas |
|-----------|----------------|-------------------|---------------|
| Full-size editor | Yes (in booth) | **Yes (center)** | Yes (half) |
| Exchange visibility | Good | **Always on** | Good |
| Presenter spatial memory | Low (teleport) | **High (persistent rails)** | Medium |
| Arrangement prominence | High | **High (center global)** | Medium (half) |
| Mixer dock size | Good in booth | **Excellent (45% height)** | Cramped |
| 1280×720 survivability | Good | **Good (collapsible exchange)** | Poor |
| Distance from rejected dashboard | High | **Highest** | Medium |

## Why it no longer resembles rejected dashboard

- Rejected: grid of 7 miniature workspaces + story panel
- B: **one** primary center surface + fixed Exchange rail
- No scene cards, no guided focus, no simultaneous mini editors

## Screen-space justification

| Area | Allocation | Purpose |
|------|------------|---------|
| Center | 55% width × 45–65% height | Arrangement or primary editor — deserves dominance |
| Exchange rail | 25% width | Collaboration anchor — always visible |
| Presence rail | 200px / 14% | Figma-like who + task |
| Transport | 48px | Musical position — never competes with editors |
| Live Control Dock | 45% height in Mixer mode | Performance credibility |

## Presenter switching

```text
Global     → center = arrangement + master scope
Participant→ center = editor tabs; rails unchanged
Follow     → highlights active participant in presence rail; optional auto-scroll Exchange
```

Viewpoint change = CSS projection swap on center panel group only. Domain state untouched.

## Shared Clip Exchange workflow

1. Creator shares from Participant → row appears in Exchange
2. Contributor claims → fork created, lineage shown
3. Review/revise loops update row state chip
4. Drag to arrangement → staged slot (non-destructive)
5. Human activate → Shared Master consumes clip

## Human arrangement replaces scenes

- Timeline shows clip slots, not "Entry" / "Return A" labels
- Activation is click/Launch on staged slot
- Pack scene boundaries drive timing internally at Phase 4

## Live Control Dock during playback

- Enter Mixer workspace preset for any participant
- 8 slots visible without scroll at 1440×900
- Drag filter cutoff from Devices → slot 1; turn knob → master graph updates
- Badge: `PREVIEW` | `CAPTURE` | `MASTER` per slot

## Library support

| Surface | Library |
|---------|---------|
| Shell tabs | dockview |
| Exchange → timeline drag | interact.js |
| Queue ordering | sortablejs |
| Inspector popover | @floating-ui/dom |
| Piano roll | canvas custom |
| Dock controls | custom web components |

## Custom semantics (not from libraries)

- Clip lifecycle states
- Fork/claim/review vocabulary
- Shared Master vs Bleed vs Preview
- Presenter projection model

## Sol synthesis (accepted)

- Framework: Vite + vanilla TS
- Docking: dockview v7 vanilla package
- Defer XState until exchange edge cases demand it

## Grok critique (accepted findings)

- **Risk:** Exchange rail at 25% may feel like "sidebar CRM" if rows are text-heavy → mitigate with waveform thumbs and color state chips
- **Risk:** Persistent rails reduce editor width → at 1280×720 collapse Exchange to overlay drawer
- **Valid:** Kanban (Option C) risks project-management aesthetic — rejected for demo
- **Valid:** Teleport (Option A) risks presenter disorientation during recording

## Grok critique (rejected)

- "Remove Exchange from Participant view" — rejected; Exchange must remain visible during personal work to show collaboration continuity (filtered to relevant rows)

## Owner decision required

Approve **Option B** as skeleton for Phase 3A shell, or select A/C with stated tradeoff acceptance.

# Skeleton Option B — "Exchange-Anchored Focus Shell" (Recommended)

## Concept

A **persistent three-zone shell**: left presence rail, center primary surface, right Shared Clip Exchange. Global and Participant modes reuse the same shell — only the center surface changes. Mixer mode expands dock into center-bottom. Figma-like presence + Bitwig-like single focus editor.

## Layout — Global Studio (1440×900)

```text
┌─────────────────────────────────────────────────────────────┐
│ EchLub │ Global ▾ │ Follow ○ │ Transport │ Master │ Bleed  │
├────┬──────────────────────────────────────────────┬─────────┤
│ P  │                                              │ EXCHANGE│
│ R  │   ARRANGEMENT + ACTIVE CLIP LANES            │ + QUEUE │
│ E  │   (45% height — launcher-style slots)        │         │
│ S  │                                              │ share   │
│ E  │──────────────────────────────────────────────│ fork    │
│ N  │   SHARED MASTER SCOPE / METERING (15%)       │ review  │
│ C  │                                              │ stage   │
│ E  │   ACTIVITY FEED: who did what (10%)          │         │
│    │                                              │         │
│rail│                                              │ 25% w   │
│200 │              55% center                      │         │
└────┴──────────────────────────────────────────────┴─────────┘
```

## Layout — Participant Workspace (same shell)

```text
├────┬──────────────────────────────────────────────┬─────────┤
│ P  │  [Clip][MIDI][Step][Devices][Arrange] tabs   │ EXCHANGE│
│ R  │                                              │ (same   │
│ E  │     PRIMARY EDITOR — full center (65%)       │  panel, │
│ S  │     piano roll / step grid / device rack     │ filtered│
│ E  │                                              │ to user)│
│ N  │──────────────────────────────────────────────│         │
│ C  │  Queue inspector │ clip metadata (20%)       │         │
│ E  │                                              │         │
└────┴──────────────────────────────────────────────┴─────────┘
```

## Layout — Mixer / Performance (same shell)

```text
├────┬──────────────────────────────────────────────┬─────────┤
│ P  │  CHANNELS + METERS (top 40%)                 │ EXCHANGE│
│ R  │  selected sources, FX chains                 │ staging │
│ E  │──────────────────────────────────────────────│         │
│ S  │  LIVE CONTROL DOCK — 8 large slots (45%)     │ map src │
│ E  │  [K][K][F][F][T][T][M][M]  snap grid         │         │
│ N  │  preview │ capture │ master badges           │         │
└────┴──────────────────────────────────────────────┴─────────┘
```

## Presenter navigation

- Top bar: Global | Participant picker | Follow
- Center morphs; rails persist → spatial memory
- No full-screen teleport — reduces disorientation

## Collaboration without mini editors

- Exchange always visible (25% right rail)
- Presence rail shows avatars + task profile chip
- Activity feed narrates clip state changes with links

## Exchange as anchor

Every fork/claim/review action starts in Exchange panel; arrangement accepts drops from Exchange only.

## Live Control Dock during playback

- Mixer mode: dock is hero surface (45% height)
- Bidirectional sync; drag param from Devices into empty slot
- Slot focus ring shows master-bound vs preview-only

## Why not rejected dashboard

- One primary surface, not grid of mini DAWs
- Exchange is rail, not buried card
- No story beat panel
- Scene names absent

## Library fit

- `dockview` — center panel tabs (MIDI/Step/Devices)
- `interact.js` — Exchange → arrangement drag
- `@floating-ui/dom` — mapping popover
- Custom canvas — piano roll in center panel

## Risks

- 25% Exchange may feel tight at 1280×720 — collapsible to overlay
- Shell complexity — must keep one integration owner (Composer)

## First-impression

"Professional tool with collaboration sidebar" — fastest comprehension for DAW-literate viewers.

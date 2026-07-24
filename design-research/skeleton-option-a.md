# Skeleton Option A — "Stage & Booths"

## Concept

Global Studio is a **performance stage**: arrangement timeline + Shared Master dominate. Participant work happens in full-screen **booths** entered via presenter teleport. Collaboration is visible through Exchange ticker and presence orbs on the stage — not miniature editors.

## Layout — Global Studio (1440×900)

```text
┌─────────────────────────────────────────────────────────────┐
│ Transport │ Shared Master meter │ Bleed │ Presenter: Global │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ARRANGEMENT TIMELINE (active clips, 55% height)            │
│  ████░░░░████ — staged slots, playhead                      │
│                                                             │
├──────────────────────┬──────────────────────────────────────┤
│ SHARED CLIP EXCHANGE │ PRESENCE + ACTIVITY RAIL             │
│ (35% width)          │ avatars, task badges, "MIDI editing" │
│ queue rows           │ click → teleport to booth              │
└──────────────────────┴──────────────────────────────────────┘
```

## Layout — Participant Booth (full viewport)

```text
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Stage │ Alex │ Task: MIDI │ Clip: drums-r2         │
├────────┬──────────────────────────────────────────┬───────────┤
│ Clip   │                                          │ Queue   │
│ browser│     PIANO ROLL / PRIMARY EDITOR (70%)    │ Inspector│
│ (15%)  │                                          │ (15%)   │
├────────┴──────────────────────────────────────────┴───────────┤
│ Device chain strip │ Live Control Dock (compact, 6 slots)     │
└─────────────────────────────────────────────────────────────┘
```

## Layout — Mixer Booth

- 60% channel strips + meters
- 40% bottom: **large** Live Control Dock (8 slots, snap grid)
- Source mapping drawer from floating popover

## Presenter navigation

- Global = stage view
- Click avatar or Exchange row → booth teleport (full screen swap)
- Follow Active = auto-teleport on participant activity

## Collaboration without mini editors

- Exchange rows show waveform thumb, state chip, lineage arrow
- Stage timeline shows who owns active clips (color bar)
- Activity rail shows live task text

## Exchange as anchor

All handoffs appear on Exchange first; staging to timeline is explicit drag from Exchange → arrangement lane.

## Live Control Dock during playback

Mixer booth only; slots large; values sync to Devices; preview/capture/master badges in transport.

## Risks

- Teleport may disorient if transition not clear
- Compact dock in participant booth may violate "large dock" for mix tasks

## First-impression

"Concert stage with backstage booths" — clear separation, strong demo narrative.

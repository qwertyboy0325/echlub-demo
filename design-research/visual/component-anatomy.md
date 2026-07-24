# Component Anatomy — EchLub Visual Primitives

Applies to all directions; dimensions scale per `token-comparison.md`.

## Focus Shell regions

```text
┌─ PresenterNav (48px) ─────────────────────────────────────┐
│ Brand · Room · Follow chip · transport readout · bleed     │
├─ Presence (200/48) ─┬─ Center (flex) ────────┬─ Exchange ─┤
│ Avatar + task       │ Room-specific surface  │ 320 / drawer│
├─────────────────────┴────────────────────────┴─────────────┤
│ TransportBar (48px) OR LiveControlDock (112–140px)         │
└────────────────────────────────────────────────────────────┘
```

## PresenterNav

- **Height:** 48px fixed
- **Contents:** EchLub wordmark, room label, Follow chip (○ off / ● on / locked), transport readout (mono), Bleed level
- **Global-only:** Stage + Activate buttons (border-only, no gradient)
- **Forbidden:** Scene names, story beat labels

## Presence rail

- **Wide:** 200px — avatar + name + task profile + idle/active
- **Compact (1280×720):** 48px — avatar only
- **Active row:** raised background + separator border
- **Avatar:** circle (A/B) or 2px square (C)

## Shared Clip Exchange row

```text
┌─ lifecycle chip (9px uppercase) ─────────────┐
│ clip title (11px medium)                    │
│ author name (10px muted)                    │
│ waveform thumbnail (18px bar repeat)        │
│ [expanded: lineage metadata border-top]     │
└─ 3px left stripe = author participant color ┘
```

- **Lifecycle chips:** exactly 4 — Available | In Progress | Review | Ready
- **No Stage/Activate** on exchange rows

## Arrangement lane (Global)

- **Height:** 44px
- **States:** empty (muted), staged (selection border), active (shared-master tint)
- **Actions:** drag from Exchange → staged; human Activate → active

## Participant header context

Persistent bar: `Clip · rev · creator · source` — never collapses on tab switch.

## Tabs (Participant)

- Max 5: Create | Devices | Automation | Mix | Queue
- Active: 2px bottom border in `--focus`
- Create sub-modes: chips (Piano Roll | Step | Clip editor), not nested tabs

## Piano roll / MIDI

- Grid: 24×20px cells, `--grid-line`
- Notes: `--selection` at 40–60% opacity; velocity = height
- Playhead: 1px `--recording`
- Numeric overlay: mono font, bottom-left

## Devices chain

- Nodes: raised surface, 80px min-width, label + type subtitle
- Selected device: `--focus` border
- Connector: `→` character, muted — no animated cables

## Mixer channel strip

- Meter (4px) + fader + label
- B direction: 72px strip width; A/C: 56px

## Live Control Dock slot (8 slots)

```text
┌─────────────┐
│   control   │  knob | fader | toggle | trigger
│   label     │  10px
│   badge     │  PREVIEW | CAPTURE | MASTER (one max)
└─────────────┘
```

- **Empty slot:** dashed border, muted label
- **Snap target:** dashed `--focus` border during drag
- **MASTER slot:** `--master` border (Direction A uses distinct gold-brown; B shares warm accent)

## Control primitives (see frame 11)

| Control | Anatomy |
|---------|---------|
| Knob | Flat disk, ring, index tick at 12 o'clock |
| Fader | Vertical track, fill from bottom, no cap skeuomorph |
| Toggle | Binary fill shift |
| Trigger | Square momentary pad |
| Meter | Horizontal or vertical solid fill |

## Follow / cursor

- Cursor: 8px dot + 10px name label on participant color
- Selection: 2px `--focus` on active note/lane
- Follow locked: chip on + Resume Follow button in transport

## Preview vs Shared Master

- Side-by-side panels; PREVIEW badge uses `--preview`; MASTER uses `--master`
- Meter fill width indicates level (fixture)

## Drag / snap states

- Dragging row: 60% opacity, dashed border
- Snap target lane/slot: dashed `--focus`
